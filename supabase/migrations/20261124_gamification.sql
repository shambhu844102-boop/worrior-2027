-- WORRIOR 2027 gamification upgrade
-- This migration is intentionally NOT applied automatically.
-- Apply only after the project owner reviews and approves it.
-- Existing profiles, auth users, and existing study data are not modified.

create table if not exists public.user_gamification (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  total_focus_minutes integer not null default 0 check (total_focus_minutes >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_study_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes in (25, 45, 60)),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'abandoned')),
  xp_awarded integer not null default 0 check (xp_awarded >= 0)
);


create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'award',
  rule_key text not null check (rule_key in ('sessions', 'focus_minutes', 'streak', 'total_xp')),
  threshold integer not null check (threshold > 0)
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

insert into public.achievements(id, title, description, icon, rule_key, threshold)
values
  ('first-focus', 'First Focus', 'Complete your first verified focus session.', 'target', 'sessions', 1),
  ('five-sessions', 'Focus Builder', 'Complete five verified focus sessions.', 'flame', 'sessions', 5),
  ('five-hours', 'Deep Work', 'Complete five hours of focused study.', 'clock', 'focus_minutes', 300),
  ('three-day-streak', 'Three-Day Rhythm', 'Study on three consecutive days.', 'calendar-check', 'streak', 3),
  ('week-streak', 'One-Week Warrior', 'Study on seven consecutive days.', 'calendar-days', 'streak', 7),
  ('first-thousand', 'XP Trailblazer', 'Earn your first 1,000 XP.', 'zap', 'total_xp', 1000)
on conflict (id) do nothing;

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- These tables are not granted to browser roles; authenticated RPCs below
-- expose only the progress data required by the application.


create index if not exists study_sessions_user_completed_idx
  on public.study_sessions (user_id, completed_at desc)
  where status = 'completed';

-- A member can have only one live timer session at a time.
create unique index if not exists one_running_study_session_per_user
  on public.study_sessions (user_id)
  where status = 'running';

create index if not exists study_sessions_leaderboard_idx
  on public.user_gamification (total_xp desc, current_streak desc);

alter table public.user_gamification enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "Members can view gamification totals" on public.user_gamification;
create policy "Members can view own gamification totals"
  on public.user_gamification for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Members can view own study sessions" on public.study_sessions;
create policy "Members can view own study sessions"
  on public.study_sessions for select to authenticated using (auth.uid() = user_id);

revoke all on public.user_gamification from anon, authenticated;
revoke all on public.study_sessions from anon, authenticated;
revoke all on public.achievements from anon, authenticated;
revoke all on public.user_achievements from anon, authenticated;

create or replace function public.start_study_session(p_duration_minutes integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_duration_minutes not in (25, 45, 60) then
    raise exception 'Choose a 25, 45, or 60 minute session';
  end if;

  update public.study_sessions
     set status = 'abandoned', paused_at = null
   where user_id = v_user and status = 'running';

  insert into public.study_sessions(user_id, duration_minutes)
  values (v_user, p_duration_minutes)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.pause_study_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.study_sessions
     set paused_at = now()
   where id = p_session_id and user_id = v_user
     and status = 'running' and paused_at is null;
  return found;
end;
$$;

create or replace function public.resume_study_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.study_sessions
     set paused_seconds = paused_seconds + greatest(0, floor(extract(epoch from (now() - paused_at)))::integer),
         paused_at = null
   where id = p_session_id and user_id = v_user
     and status = 'running' and paused_at is not null;
  return found;
end;
$$;

create or replace function public.abandon_study_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.study_sessions
     set status = 'abandoned', paused_at = null
   where id = p_session_id and user_id = v_user and status = 'running';
  return found;
end;
$$;

create or replace function public.complete_study_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.study_sessions%rowtype;
  v_elapsed integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_xp integer;
  v_streak integer;
  v_longest integer;
  v_total_xp integer;
  v_badge record;
  v_new_badges jsonb := '[]'::jsonb;
  v_session_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_session
    from public.study_sessions
   where id = p_session_id and user_id = v_user
   for update;

  if not found then
    raise exception 'Study session was not found';
  end if;

  -- Safe retry: if the completion committed but the client missed the response,
  -- return the already-awarded result instead of awarding XP a second time.
  if v_session.status = 'completed' then
    select total_xp, current_streak, longest_streak
      into v_total_xp, v_streak, v_longest
      from public.user_gamification where user_id = v_user;
    return jsonb_build_object(
      'xp_earned', v_session.xp_awarded,
      'total_xp', coalesce(v_total_xp, 0),
      'current_streak', coalesce(v_streak, 0),
      'longest_streak', coalesce(v_longest, 0),
      'level', floor(coalesce(v_total_xp, 0) / 500.0)::integer + 1,
      'new_achievements', '[]'::jsonb,
      'already_completed', true
    );
  end if;

  if v_session.status <> 'running' then
    raise exception 'Study session is no longer active';
  end if;
  if v_session.paused_at is not null then
    raise exception 'Resume the timer before completing the session';
  end if;

  v_elapsed := floor(extract(epoch from (now() - v_session.started_at)))::integer
               - v_session.paused_seconds;
  if v_elapsed < (v_session.duration_minutes * 60 - 3) then
    raise exception 'The focus session has not reached its full duration yet';
  end if;

  v_xp := v_session.duration_minutes * 2;

  update public.study_sessions
     set status = 'completed', completed_at = now(), xp_awarded = v_xp
   where id = p_session_id;

  insert into public.user_gamification(user_id, total_xp, total_focus_minutes, current_streak, longest_streak, last_study_date)
  values (v_user, v_xp, v_session.duration_minutes, 1, 1, v_today)
  on conflict (user_id) do update
    set total_xp = public.user_gamification.total_xp + excluded.total_xp,
        total_focus_minutes = public.user_gamification.total_focus_minutes + excluded.total_focus_minutes,
        current_streak = case
          when public.user_gamification.last_study_date = v_today then public.user_gamification.current_streak
          when public.user_gamification.last_study_date = v_today - 1 then public.user_gamification.current_streak + 1
          else 1
        end,
        longest_streak = greatest(
          public.user_gamification.longest_streak,
          case
            when public.user_gamification.last_study_date = v_today then public.user_gamification.current_streak
            when public.user_gamification.last_study_date = v_today - 1 then public.user_gamification.current_streak + 1
            else 1
          end
        ),
        last_study_date = v_today,
        updated_at = now();

  select total_xp, current_streak, longest_streak
    into v_total_xp, v_streak, v_longest
    from public.user_gamification where user_id = v_user;

  select count(*) into v_session_count from public.study_sessions
   where user_id = v_user and status = 'completed';

  for v_badge in
    select a.id, a.title
      from public.achievements a
     where not exists (
       select 1 from public.user_achievements ua
        where ua.user_id = v_user and ua.achievement_id = a.id
     )
       and (
         (a.rule_key = 'sessions' and v_session_count >= a.threshold) or
         (a.rule_key = 'focus_minutes' and (select total_focus_minutes from public.user_gamification where user_id = v_user) >= a.threshold) or
         (a.rule_key = 'streak' and v_streak >= a.threshold) or
         (a.rule_key = 'total_xp' and v_total_xp >= a.threshold)
       )
  loop
    insert into public.user_achievements(user_id, achievement_id)
    values (v_user, v_badge.id) on conflict do nothing;
    v_new_badges := v_new_badges || jsonb_build_array(v_badge.title);
  end loop;

  return jsonb_build_object(
    'xp_earned', v_xp,
    'total_xp', v_total_xp,
    'current_streak', v_streak,
    'longest_streak', v_longest,
    'level', floor(v_total_xp / 500.0)::integer + 1,
    'new_achievements', v_new_badges
  );
end;
$$;


create or replace function public.get_gamification_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_total_xp integer := 0;
  v_minutes integer := 0;
  v_streak integer := 0;
  v_longest integer := 0;
  v_sessions_today integer := 0;
  v_minutes_today integer := 0;
  v_messages_today integer := 0;
  v_badges jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select coalesce(total_xp,0), coalesce(total_focus_minutes,0),
         case when last_study_date >= v_today - 1 then coalesce(current_streak,0) else 0 end,
         coalesce(longest_streak,0)
    into v_total_xp, v_minutes, v_streak, v_longest
    from public.user_gamification where user_id = v_user;
  if not found then
    v_total_xp := 0; v_minutes := 0; v_streak := 0; v_longest := 0;
  end if;

  select count(*), coalesce(sum(duration_minutes),0)
    into v_sessions_today, v_minutes_today
    from public.study_sessions
   where user_id = v_user and status = 'completed'
     and (completed_at at time zone 'Asia/Kolkata')::date = v_today;

  select count(*) into v_messages_today
    from public.messages
   where user_id = v_user
     and (created_at at time zone 'Asia/Kolkata')::date = v_today;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'description', a.description,
      'icon', a.icon,
      'rule_key', a.rule_key,
      'threshold', a.threshold,
      'unlocked', ua.unlocked_at is not null,
      'unlocked_at', ua.unlocked_at
    ) order by a.threshold, a.title), '[]'::jsonb)
    into v_badges
    from public.achievements a
    left join public.user_achievements ua
      on ua.achievement_id = a.id and ua.user_id = v_user;

  return jsonb_build_object(
    'total_xp', v_total_xp,
    'level', floor(v_total_xp / 500.0)::integer + 1,
    'level_xp', mod(v_total_xp, 500),
    'xp_to_next_level', 500 - mod(v_total_xp, 500),
    'total_focus_minutes', v_minutes,
    'current_streak', v_streak,
    'longest_streak', v_longest,
    'today_sessions', v_sessions_today,
    'today_focus_minutes', v_minutes_today,
    'today_messages', v_messages_today,
    'achievements', v_badges,
    'missions', jsonb_build_array(
      jsonb_build_object('id','focus-one','title','Complete one focus session','detail','Finish any full focus timer','progress',least(v_sessions_today,1),'target',1,'complete',v_sessions_today >= 1),
      jsonb_build_object('id','focus-45','title','Study for 45 focused minutes','detail','Accumulate 45 minutes in completed sessions','progress',least(v_minutes_today,45),'target',45,'complete',v_minutes_today >= 45),
      jsonb_build_object('id','say-hello','title','Contribute to the group','detail','Send at least one group message','progress',least(v_messages_today,1),'target',1,'complete',v_messages_today >= 1)
    )
  );
end;
$$;

create or replace function public.get_gamification_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  total_xp integer,
  current_streak integer,
  longest_streak integer,
  total_focus_minutes integer,
  level integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.full_name,
         coalesce(g.total_xp, 0),
         case when g.last_study_date >= (now() at time zone 'Asia/Kolkata')::date - 1 then coalesce(g.current_streak, 0) else 0 end,
         coalesce(g.longest_streak, 0),
         coalesce(g.total_focus_minutes, 0),
         floor(coalesce(g.total_xp, 0) / 500.0)::integer + 1
    from public.profiles p
    left join public.user_gamification g on g.user_id = p.id
   where auth.uid() is not null
   order by coalesce(g.total_xp, 0) desc, p.full_name asc;
$$;


create or replace function public.get_weekly_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  weekly_xp integer,
  weekly_focus_minutes integer,
  current_streak integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with weekly as (
    select ss.user_id,
           coalesce(sum(ss.xp_awarded), 0)::integer as weekly_xp,
           coalesce(sum(ss.duration_minutes), 0)::integer as weekly_focus_minutes
      from public.study_sessions ss
     where ss.status = 'completed'
       and (ss.completed_at at time zone 'Asia/Kolkata')::date >= (now() at time zone 'Asia/Kolkata')::date - 6
       and (ss.completed_at at time zone 'Asia/Kolkata')::date <= (now() at time zone 'Asia/Kolkata')::date
     group by ss.user_id
  )
  select p.id,
         p.full_name,
         coalesce(w.weekly_xp, 0),
         coalesce(w.weekly_focus_minutes, 0),
         case when g.last_study_date >= (now() at time zone 'Asia/Kolkata')::date - 1 then coalesce(g.current_streak, 0) else 0 end
    from public.profiles p
    left join weekly w on w.user_id = p.id
    left join public.user_gamification g on g.user_id = p.id
   where auth.uid() is not null
   order by coalesce(w.weekly_xp, 0) desc, coalesce(w.weekly_focus_minutes, 0) desc, p.full_name asc;
$$;

revoke all on function public.start_study_session(integer) from public, anon;
revoke all on function public.pause_study_session(uuid) from public, anon;
revoke all on function public.resume_study_session(uuid) from public, anon;
revoke all on function public.abandon_study_session(uuid) from public, anon;
revoke all on function public.complete_study_session(uuid) from public, anon;
revoke all on function public.get_gamification_leaderboard() from public, anon;
revoke all on function public.get_gamification_dashboard() from public, anon;
revoke all on function public.get_weekly_leaderboard() from public, anon;
grant execute on function public.start_study_session(integer) to authenticated;
grant execute on function public.pause_study_session(uuid) to authenticated;
grant execute on function public.resume_study_session(uuid) to authenticated;
grant execute on function public.abandon_study_session(uuid) to authenticated;
grant execute on function public.complete_study_session(uuid) to authenticated;
grant execute on function public.get_gamification_leaderboard() to authenticated;
grant execute on function public.get_gamification_dashboard() to authenticated;
grant execute on function public.get_weekly_leaderboard() to authenticated;
