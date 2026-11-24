import React, { useEffect, useRef, useState } from "react";
import { Award, Bell, CheckCircle2, Clock3, Flame, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import { supabase } from "./supabase";

const PRESETS = [25, 45, 60];

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

export default function StudyTimer({ profile }) {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [pausedOnServer, setPausedOnServer] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [alarmType, setAlarmType] = useState("bell");
  const [alarming, setAlarming] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [databaseReady, setDatabaseReady] = useState(null);
  const [status, setStatus] = useState("");
  const [completion, setCompletion] = useState(null);
  const endTime = useRef(null);
  const audioContext = useRef(null);
  const alarmInterval = useRef(null);

  async function refreshDashboard() {
    const { data, error } = await supabase.rpc("get_gamification_dashboard");
    if (error) {
      setDatabaseReady(false);
      return false;
    }
    setDashboard(data);
    setDatabaseReady(true);
    return true;
  }

  useEffect(() => {
    refreshDashboard();
  }, [profile?.id]);

  function stopAlarm() {
    window.clearInterval(alarmInterval.current);
    alarmInterval.current = null;
    setAlarming(false);
  }

  function playTone() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext.current) audioContext.current = new AudioCtx();
    const ctx = audioContext.current;
    if (ctx.state === "suspended") ctx.resume();

    const note = (frequency, duration, startAt = ctx.currentTime) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    };

    if (alarmType === "bell") {
      note(880, 0.32);
      note(660, 0.32, ctx.currentTime + 0.38);
      note(880, 0.32, ctx.currentTime + 0.76);
    } else {
      note(1000, 0.18);
      note(1000, 0.18, ctx.currentTime + 0.28);
    }
  }

  function startAlarm() {
    setAlarming(true);
    playTone();
    alarmInterval.current = window.setInterval(playTone, 1700);
  }

  async function finishSession() {
    setRunning(false);
    setRemaining(0);
    startAlarm();

    if (!sessionId) {
      setStatus("Timer completed. XP will be enabled after the secure progress database setup.");
      return;
    }

    const { data, error } = await supabase.rpc("complete_study_session", {
      p_session_id: sessionId,
    });
    if (error) {
      setStatus("Timer completed, but XP confirmation failed: " + error.message);
      return;
    }

    setCompletion(data);
    setSessionId(null);
    setPausedOnServer(false);
    setStatus("Focus session verified. XP added to your profile.");
    await refreshDashboard();
  }

  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(interval);
        finishSession();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [running, sessionId]);

  useEffect(() => () => {
    window.clearInterval(alarmInterval.current);
    if (audioContext.current) audioContext.current.close();
  }, []);

  async function startTimer() {
    if (remaining <= 0) return;
    stopAlarm();
    setCompletion(null);
    setStatus("");

    if (sessionId && pausedOnServer) {
      const { error } = await supabase.rpc("resume_study_session", { p_session_id: sessionId });
      if (error) {
        setStatus("Could not resume verified session: " + error.message);
        return;
      }
      setPausedOnServer(false);
    } else if (!sessionId && databaseReady) {
      const { data, error } = await supabase.rpc("start_study_session", { p_duration_minutes: minutes });
      if (error) {
        setDatabaseReady(false);
        setStatus("Verified XP tracking is not available yet. The timer can still be used.");
      } else {
        setSessionId(data);
      }
    }

    endTime.current = Date.now() + remaining * 1000;
    setRunning(true);
  }

  async function pauseTimer() {
    if (sessionId) {
      const { error } = await supabase.rpc("pause_study_session", { p_session_id: sessionId });
      if (error) {
        setStatus("Could not pause the verified session: " + error.message);
        return;
      }
      setPausedOnServer(true);
    }
    if (endTime.current) {
      setRemaining(Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000)));
    }
    setRunning(false);
  }

  async function resetTimer() {
    if (sessionId) {
      const { error } = await supabase.rpc("abandon_study_session", { p_session_id: sessionId });
      if (error) setStatus("Timer reset locally. The server session may need cleanup: " + error.message);
    }
    setRunning(false);
    stopAlarm();
    setRemaining(minutes * 60);
    endTime.current = null;
    setSessionId(null);
    setPausedOnServer(false);
    setCompletion(null);
  }

  async function choosePreset(value) {
    if (running || sessionId) await resetTimer();
    setMinutes(value);
    setRemaining(value * 60);
    setStatus("");
  }

  const levelProgress = dashboard ? Math.max(0, Math.min(100, (dashboard.level_xp / 500) * 100)) : 0;

  return (
    <div className="focus-page">
      <div className="focus-hero">
        <div>
          <p className="eyebrow">WORRIOR FOCUS ZONE</p>
          <h1>Make focus count.</h1>
          <p>Complete a full, verified session to earn XP and build your study streak.</p>
        </div>
        <div className="focus-hero-icon"><Target size={34} /></div>
      </div>

      {dashboard && (
        <div className="focus-mini-stats">
          <div><Zap size={17} /><strong>{dashboard.total_xp} XP</strong><small>Total XP</small></div>
          <div><Flame size={17} /><strong>{dashboard.current_streak} days</strong><small>Current streak</small></div>
          <div><Award size={17} /><strong>Level {dashboard.level}</strong><small>Current level</small></div>
        </div>
      )}

      <div className="focus-workspace">
        <section className="timer-card panel">
          <div className="timer-card-top">
            <span className="timer-status"><i className={running ? "live" : ""} />{alarming ? "Session complete" : running ? "Focus session running" : pausedOnServer ? "Session paused" : "Ready when you are"}</span>
            <span className="timer-verified"><ShieldCheck size={14} /> Server verified XP</span>
          </div>
          <div className="timer-dial" style={{ "--timer-progress": ((minutes * 60 - remaining) / (minutes * 60)) * 360 + "deg" }}>
            <div className="timer-dial-inner">
              <small>{running ? "STAY FOCUSED" : remaining === 0 ? "WELL DONE" : "FOCUS TIME"}</small>
              <strong>{formatTime(remaining)}</strong>
              <span>{minutes} minute session</span>
            </div>
          </div>
          <div className="timer-presets">
            {PRESETS.map(value => (
              <button key={value} type="button" className={minutes === value ? "selected" : ""} disabled={running || Boolean(sessionId)} onClick={() => choosePreset(value)}>{value} min</button>
            ))}
          </div>
          <div className="timer-actions">
            {!running ? (
              <button className="btn primary" type="button" disabled={remaining <= 0} onClick={startTimer}><Play size={17} /> {pausedOnServer ? "Resume focus" : "Start focus"}</button>
            ) : (
              <button className="btn primary" type="button" onClick={pauseTimer}><Pause size={17} /> Pause</button>
            )}
            <button className="btn" type="button" onClick={resetTimer}><RotateCcw size={16} /> Reset</button>
          </div>
          {status && <p className="timer-status-message" role="status">{status}</p>}
          {completion && <div className="xp-earned"><Sparkles size={18} /><div><strong>+{completion.xp_earned} XP earned!</strong><small>New total: {completion.total_xp} XP · Level {completion.level}</small></div></div>}
          {alarming && <button className="stop-alarm" type="button" onClick={stopAlarm}><Bell size={15} /> Stop alarm</button>}
          <p className="timer-footnote">XP is awarded only after the server verifies the full timer duration. A reset or abandoned session earns no points.</p>
        </section>

        <aside className="focus-side">
          <section className="panel focus-next">
            <div className="panel-head"><div><h3>Focus routine</h3><p className="muted">One session at a time</p></div><Clock3 size={19} /></div>
            <div className="routine-step"><span>01</span><div><strong>Choose your duration</strong><small>25, 45 or 60 minutes</small></div></div>
            <div className="routine-step"><span>02</span><div><strong>Focus without rushing</strong><small>Pause when you genuinely need a break</small></div></div>
            <div className="routine-step"><span>03</span><div><strong>Earn your progress</strong><small>XP and streak update after verification</small></div></div>
          </section>
          <section className="panel focus-level">
            <div className="panel-head"><div><h3>Your next level</h3><p className="muted">500 XP per level</p></div><Zap size={19} /></div>
            {dashboard ? (
              <>
                <div className="level-line"><strong>Level {dashboard.level}</strong><span>{dashboard.level_xp} / 500 XP</span></div>
                <div className="level-track"><span style={{ width: levelProgress + "%" }} /></div>
                <small>{dashboard.xp_to_next_level} XP to the next level</small>
              </>
            ) : (
              <div className="gamification-locked"><ShieldCheck size={18} /><p>Secure XP tracking is waiting for the approved database setup.</p></div>
            )}
          </section>
          <section className="panel alarm-card">
            <div className="panel-head"><div><h3>Session alarm</h3><p className="muted">Choose your finish sound</p></div><Bell size={18} /></div>
            <div className="alarm-options">
              <button type="button" className={alarmType === "bell" ? "selected" : ""} disabled={running || alarming} onClick={() => setAlarmType("bell")}>School bell</button>
              <button type="button" className={alarmType === "digital" ? "selected" : ""} disabled={running || alarming} onClick={() => setAlarmType("digital")}>Digital</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
