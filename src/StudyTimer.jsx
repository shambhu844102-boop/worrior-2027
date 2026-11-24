import React, { useEffect, useRef, useState } from "react";
export default function StudyTimer() {
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [alarmType, setAlarmType] = useState("digital");
  const [alarming, setAlarming] = useState(false);

  const endTime = useRef(null);
  const audioContext = useRef(null);
  const alarmInterval = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  function stopAlarm() {
    clearInterval(alarmInterval.current);
    alarmInterval.current = null;
    setAlarming(false);
  }

  function playTone() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext.current) {
      audioContext.current = new AudioCtx();
    }

    const ctx = audioContext.current;
    if (ctx.state === "suspended") ctx.resume();

    const playNote = (frequency, duration) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    };

    if (alarmType === "bell") {
      playNote(880, 0.35);
      setTimeout(() => playNote(660, 0.35), 400);
      setTimeout(() => playNote(880, 0.35), 800);
    } else {
      playNote(1000, 0.2);
      setTimeout(() => playNote(1000, 0.2), 300);
    }
  }

  function startAlarm() {
    setAlarming(true);
    playTone();
    alarmInterval.current = setInterval(playTone, 1600);
  }

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((endTime.current - Date.now()) / 1000)
      );

      setRemaining(seconds);

      if (seconds <= 0) {
        clearInterval(interval);
        setRunning(false);
        startAlarm();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    return () => {
      clearInterval(alarmInterval.current);
      if (audioContext.current) audioContext.current.close();
    };
  }, []);

  function startTimer() {
    if (remaining <= 0) return;
    stopAlarm();
    endTime.current = Date.now() + remaining * 1000;
    setRunning(true);
  }

  function pauseTimer() {
    if (endTime.current) {
      setRemaining(Math.max(
        0,
        Math.ceil((endTime.current - Date.now()) / 1000)
      ));
    }
    setRunning(false);
  }

  function resetTimer() {
    setRunning(false);
    stopAlarm();
    setRemaining(minutes * 60);
    endTime.current = null;
  }

  function choosePreset(value) {
    setRunning(false);
    stopAlarm();
    setMinutes(value);
    setRemaining(value * 60);
    endTime.current = null;
  }

  return (
    <div className="panel" style={{
      maxWidth: 650,
      margin: "20px auto",
      padding: 28,
      textAlign: "center"
    }}>
      <div style={{ fontSize: 13, letterSpacing: 3, color: "#a78bfa" }}>
        WORRIOR 2027 • FOCUS ZONE
      </div>

      <h2>Study Timer & Alarm</h2>
      <p className="muted">Focus on your goals. One session at a time.</p>

      <div style={{
        fontSize: "clamp(55px, 12vw, 90px)",
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
        margin: "30px 0 10px"
      }}>
        {formatTime(remaining)}
      </div>

      <p style={{ color: alarming ? "#f87171" : "#a78bfa" }}>
        {alarming ? "⏰ TIME IS UP!" : running ? "● FOCUS SESSION RUNNING" : "READY TO FOCUS"}
      </p>

      <div style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 10,
        margin: "24px 0"
      }}>
        {[25, 45, 60].map(value => (
          <button
            key={value}
            className={`btn ${minutes === value ? "primary" : ""}`}
            disabled={running}
            onClick={() => choosePreset(value)}
          >
            {value} min
          </button>
        ))}
      </div>

      <div style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 10
      }}>
        {!running ? (
          <button className="btn primary" onClick={startTimer} disabled={remaining <= 0}>
            ▶ Start
          </button>
        ) : (
          <button className="btn primary" onClick={pauseTimer}>
            ⏸ Pause
          </button>
        )}

        <button className="btn" onClick={resetTimer}>
          ↻ Reset
        </button>
      </div>

      <hr style={{ margin: "28px 0", opacity: 0.15 }} />

      <h3>Alarm Settings 🔔</h3>
      <p className="muted">Choose your preferred alarm sound.</p>

      <div style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 12,
        margin: 16
      }}>
        <button
          className={`btn ${alarmType === "bell" ? "primary" : ""}`}
          onClick={() => setAlarmType("bell")}
          disabled={running || alarming}
        >
          🔔 School Bell
        </button>

        <button
          className={`btn ${alarmType === "digital" ? "primary" : ""}`}
          onClick={() => setAlarmType("digital")}
          disabled={running || alarming}
        >
          ⏰ Digital Alarm
        </button>
      </div>

      {alarming && (
        <button
          className="btn primary"
          style={{ marginTop: 12 }}
          onClick={stopAlarm}
        >
          Stop Alarm
        </button>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 25 }}>
        Keep this browser tab open for the timer and alarm to work reliably.
      </p>
    </div>
  );
}
