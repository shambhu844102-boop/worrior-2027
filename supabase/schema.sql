-- WORRIOR 2027 database schema
-- Run this in Supabase SQL Editor before using the app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.study_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  details text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.study_files enable row level security;
alter table public.assignments enable row level security;

-- All authenticated group members can see member profiles.
create policy "Members can view profiles" on public.profiles
for select to authenticated using (true);

-- Profile editing is disabled in this starter. This prevents members from changing
-- their own role; add a carefully scoped update policy if profile editing is added.

create policy "Members can read messages" on public.messages
for select to authenticated using (true);
create policy "Members can send messages as themselves" on public.messages
for insert to authenticated with check (auth.uid() = user_id);
create policy "Members can delete own messages" on public.messages
for delete to authenticated using (auth.uid() = user_id);

create policy "Members can read file records" on public.study_files
for select to authenticated using (true);
create policy "Members can create file records as themselves" on public.study_files
for insert to authenticated with check (auth.uid() = user_id);
create policy "Uploader can delete own file record" on public.study_files
for delete to authenticated using (auth.uid() = user_id);

create policy "Members can read assignments" on public.assignments
for select to authenticated using (true);
create policy "Members can create assignments" on public.assignments
for insert to authenticated with check (auth.uid() = created_by);
create policy "Creator can delete assignment" on public.assignments
for delete to authenticated using (auth.uid() = created_by);

-- Storage bucket: private, 20 MB max. Configure allowed MIME types in Dashboard if desired.
insert into storage.buckets (id, name, public, file_size_limit)
values ('study-files', 'study-files', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create policy "Authenticated members can view study files" on storage.objects
for select to authenticated using (bucket_id = 'study-files');
create policy "Members upload into own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'study-files' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Members delete own uploaded files" on storage.objects
for delete to authenticated using (
  bucket_id = 'study-files' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable realtime for group chat.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when others then null;
end $$;

-- IMPORTANT: After creating your first user in Supabase Auth,
-- promote that user to admin by running:
-- update public.profiles set role = 'admin' where id = 'YOUR_AUTH_USER_UUID';
