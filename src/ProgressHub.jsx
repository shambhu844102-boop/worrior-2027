import React, { useEffect, useState } from "react";
import {
  Award, CalendarDays, CheckCircle2, Clock3, Flame, LockKeyhole,
  Medal, MessageCircle, ShieldCheck, Sparkles, Target, Trophy, Zap
} from "lucide-react";
import { supabase } from "./supabase";

function formatFocus(minutes = 0) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? hours + "h " + mins + "m" : mins + "m";
}

function PageTitle({ eyebrow, title, description }) {
  return (
    <div className="page-heading progress-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>
      <div className="progress-title-mark"><Trophy size={24} /></div>
    </div>
  );
}

export default function ProgressHub({ profile }) {
  const [data, setData] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [dashboardResult, leaderboardResult, catalogueResult, unlockedResult] = await Promise.all([
        supabase.rpc("get_gamification_dashboard"),
        supabase.rpc("get_weekly_leaderboard"),
        supabase.from("achievements").select("id,title,description,icon,rule_key,threshold").order("threshold", { ascending: true }),
        supabase.from("user_achievements").select("achievement_id,unlocked_at").eq("user_id", profile.id),
      ]);
      if (!active) return;
      if (dashboardResult.error) {
        setError("Progress tracking is not active yet. The secure XP and streak database upgrade needs to be approved and applied first.");
        setLoading(false);
        return;
      }
      if (leaderboardResult.error || catalogueResult.error || unlockedResult.error) {
        setError("Some progress information could not be loaded. Please try again.");
        setLoading(false);
        return;
      }
      setData(dashboardResult.data);
      setWeekly(leaderboardResult.data || []);
      setCatalogue(catalogueResult.data || []);
      setUnlocked(unlockedResult.data || []);
      setError("");
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [profile.id]);

  const unlockedIds = new Set(unlocked.map(item => item.achievement_id));
  const rank = weekly.findIndex(item => item.user_id === profile.id) + 1;
  const progress = data ? Math.min(100, (data.level_xp / 500) * 100) : 0;

  return (
    <div className="progress-hub">
      <PageTitle eyebrow="YOUR LEARNING JOURNEY" title="Progress & rewards" description="Earn real XP, build a consistent streak and celebrate every milestone." />

      {loading ? (
        <div className="panel progress-loading"><div className="brand-mark">W</div><p>Loading your progress…</p></div>
      ) : error ? (
        <section className="panel progress-setup-card">
          <div className="progress-setup-icon"><ShieldCheck size={25} /></div>
          <div><h2>Progress system awaiting setup</h2><p>{error}</p><small>No sample scores or fake streaks are shown. Your real progress will appear after the database migration is approved.</small></div>
        </section>
      ) : (
        <>
          <section className="xp-hero">
            <div className="xp-hero-copy">
              <p className="eyebrow">YOUR CURRENT RANK</p>
              <div className="xp-level-line"><span className="xp-level-number">LVL {data.level}</span><span className="xp-total">{data.total_xp.toLocaleString()} XP</span></div>
              <h2>Consistency builds momentum.</h2>
              <p>Every completed focus session moves you closer to the next level.</p>
              <div className="xp-track"><span style={{ width: progress + "%" }} /></div>
              <div className="xp-track-caption"><span>{data.level_xp} / 500 XP in this level</span><strong>{data.xp_to_next_level} XP to next level</strong></div>
            </div>
            <div className="xp-hero-emblem"><div><Trophy size={35} /><strong>{data.level}</strong><small>LEVEL</small></div></div>
          </section>

          <div className="progress-stat-grid">
            <div className="progress-stat"><div className="progress-stat-icon xp"><Zap size={19} /></div><strong>{data.total_xp.toLocaleString()}</strong><span>Total XP</span></div>
            <div className="progress-stat"><div className="progress-stat-icon streak"><Flame size={19} /></div><strong>{data.current_streak} days</strong><span>Current streak</span></div>
            <div className="progress-stat"><div className="progress-stat-icon time"><Clock3 size={19} /></div><strong>{formatFocus(data.total_focus_minutes)}</strong><span>Focused study time</span></div>
            <div className="progress-stat"><div className="progress-stat-icon record"><CalendarDays size={19} /></div><strong>{data.longest_streak} days</strong><span>Best streak</span></div>
          </div>

          <div className="progress-content-grid">
            <section className="panel mission-panel">
              <div className="panel-head"><div><h3>Today's missions</h3><p className="muted">Small goals measured from real activity</p></div><Target size={20} /></div>
              <div className="mission-list">
                {(data.missions || []).map(mission => (
                  <div className={"mission-row " + (mission.complete ? "complete" : "")} key={mission.id}>
                    <div className="mission-status">{mission.complete ? <CheckCircle2 size={20} /> : <Target size={19} />}</div>
                    <div className="mission-copy"><strong>{mission.title}</strong><small>{mission.detail}</small><div className="mission-track"><span style={{ width: Math.min(100, mission.progress / mission.target * 100) + "%" }} /></div></div>
                    <span className="mission-count">{mission.progress}/{mission.target}</span>
                  </div>
                ))}
              </div>
              <p className="mission-footnote">Missions refresh each day using completed focus sessions and group activity.</p>
            </section>

            <section className="panel weekly-panel">
              <div className="panel-head"><div><h3>Weekly leaderboard</h3><p className="muted">Verified XP earned in the last 7 days</p></div><Trophy size={20} /></div>
              <div className="weekly-rank-card"><span>Your weekly position</span><strong>{rank ? "#" + rank : "—"}</strong><small>of {weekly.length} members</small></div>
              <div className="leaderboard-list">
                {weekly.map((member, index) => (
                  <div className={"leaderboard-row " + (member.user_id === profile.id ? "you" : "")} key={member.user_id}>
                    <div className={"rank-number rank-" + (index + 1)}>{index === 0 ? <Trophy size={16} /> : index === 1 ? <Medal size={16} /> : index === 2 ? <Award size={16} /> : index + 1}</div>
                    <div className="leader-member"><strong>{member.full_name}{member.user_id === profile.id ? " (You)" : ""}</strong><small><Flame size={12} /> {member.current_streak} day streak · {formatFocus(member.weekly_focus_minutes)}</small></div>
                    <b className="leader-xp">{member.weekly_xp} XP</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel achievements-panel">
            <div className="panel-head"><div><h3>Achievement collection</h3><p className="muted">{unlocked.length} of {catalogue.length} badges unlocked</p></div><Sparkles size={20} /></div>
            <div className="achievement-grid">
              {catalogue.map(badge => {
                const won = unlockedIds.has(badge.id);
                return (
                  <article className={"achievement-card " + (won ? "unlocked" : "locked")} key={badge.id}>
                    <div className="achievement-icon">{won ? <Award size={23} /> : <LockKeyhole size={21} />}</div>
                    <div><strong>{badge.title}</strong><p>{badge.description}</p><small>{won ? "UNLOCKED" : badge.rule_key === "sessions" ? badge.threshold + " completed sessions" : badge.rule_key === "focus_minutes" ? formatFocus(badge.threshold) + " of focus" : badge.rule_key === "streak" ? badge.threshold + " day streak" : badge.threshold.toLocaleString() + " XP"}</small></div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
