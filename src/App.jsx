import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, CalendarDays, CheckSquare, ChevronRight, Clock, FileText,
  FolderOpen, Home, LogOut, Menu, MessageCircle, Plus, Send, Settings,
  ShieldCheck, Users, Video, X, Paperclip, Download, Search, Hash, LockKeyhole, Pencil, Trash2,Megaphone, Trophy, Flame, Zap, Award,
} from "lucide-react";
import { supabase, supabaseReady } from "./supabase";
import StudyTimer from "./StudyTimer";
import NotificationBell from "./components/NotificationBell";
import ThemeToggle from "./components/ThemeToggle";
import { getInitialTheme, saveTheme } from "./theme";
import ProgressHub from "./ProgressHub";

const nav = [
  ["Overview", Home], ["Messages", MessageCircle], ["Live room", Video],
  ["Study materials", FolderOpen], ["Assignments", CheckSquare],
  ["Study Timer", Clock], ["Members", Users], ["Schedule", CalendarDays],["Announcements", Megaphone], ["Progress & Rewards", Trophy],
];

const mobileNavItems = [
  ["Overview", Home], ["Messages", MessageCircle], ["Live room", Video],
  ["Study Timer", Clock], ["Members", Users],
];

function initials(s = "Student") {
  return s.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();
}
function prettyDate(v) {
  return new Date(v).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) loadProfile(next.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadProfile(id) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) setNotice("Your profile is not ready. Ask the admin to check the Supabase setup.");
    setProfile(data || null);
    setLoading(false);
  }

  async function signIn(e) {
    e.preventDefault(); setNotice("Signing in…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setNotice(error ? error.message : "");
  }
  async function signOut() { await supabase.auth.signOut(); setPage("Overview"); }

  if (!supabaseReady) return <SetupScreen />;
  if (loading) return <div className="loading"><div className="brand-mark">W</div><p>Loading WORRIOR 2027…</p></div>;
  if (!session) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={signIn} notice={notice} theme={theme} onToggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")} />;
  if (!profile) return <div className="loading"><p>Account found, but member profile is missing. Ask your admin to check the database setup.</p><button className="btn secondary" onClick={signOut}>Sign out</button></div>;

  return <div className="app-shell">
    {mobileNav && <div className="mobile-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="brand"><img
        src="/logo.png"
        alt="WORRIOR 2027 Logo"
        className="brand-logo"
      /><div><b>WORRIOR</b><small>2027 · STUDY CAMPUS</small></div><button className="icon-btn close-nav" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace"><div className="workspace-icon">W</div><div><b>Class of 2027</b><small>Private study group</small></div><ChevronRight size={16} /></div>
      <div className="nav-label">STUDY SPACE</div>
      <nav>{nav.map(([name, Icon]) => <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => { setPage(name); setMobileNav(false) }}><Icon size={18} /><span>{name}</span>{name === "Messages" && <i className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="online-card"><span className="green-dot" /><div><b>Private workspace</b><small>Members only</small></div></div><button className="nav-item" onClick={() => setPage("Settings")}><Settings size={18} />Settings</button></div>
      <div className="user-mini"><div className="avatar">{initials(profile.full_name)}</div><div className="user-copy"><b>{profile.full_name}</b><small>{profile.role === "admin" ? "Administrator" : "Student"}</small></div><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button>
        <div className="crumb">WORRIOR 2027 <ChevronRight size={14} /> <b>{page}</b></div>
        <div className="top-actions">
          <ThemeToggle theme={theme} onToggle={() => setTheme(current => current === "dark" ? "light" : "dark")} />
          <NotificationBell user={session.user} />

          <span className="secure-label">
            <ShieldCheck size={15} /> Private group
          </span>

          <div className="avatar small">
            {initials(profile.full_name)}
          </div>
        </div>
      </header>
      <div className="page-wrap">
        {page === "Overview" && <Overview profile={profile} setPage={setPage} />}
        {page === "Messages" && <Messages profile={profile} />}
        {page === "Announcements" && <AnnouncementPage profile={profile} />}
        {page === "Live room" && <LiveRoom profile={profile} />}
        {page === "Study materials" && <Materials profile={profile} />}
        {page === "Assignments" && <Assignments profile={profile} />}
        {page === "Study Timer" && <StudyTimer profile={profile} />}
        {page === "Progress & Rewards" && <ProgressHub profile={profile} />}
        {page === "Members" && <Members profile={profile} />}
        {page === "Schedule" && <Schedule profile={profile} />}
        {page === "Settings" && <AdminPanel profile={profile} />}
      </div>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {mobileNavItems.map(([name, Icon]) => (
          <button key={name} type="button" className={page === name ? "active" : ""} aria-current={page === name ? "page" : undefined} onClick={() => setPage(name)}>
            <Icon size={18} /><span>{name === "Overview" ? "Home" : name === "Study Timer" ? "Focus" : name === "Live room" ? "Live" : name}</span>
          </button>
        ))}
      </nav>
    </main>
  </div>;
}

function LiveRoom({ profile }) {
  const meetLink = import.meta.env.VITE_GOOGLE_MEET_URL;

  const openMeeting = () => {
    if (!meetLink) {
      alert("Google Meet link is not configured. Please add VITE_GOOGLE_MEET_URL in Vercel Environment Variables.");
      return;
    }

    window.open(meetLink, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <PageHeading
        eyebrow="LIVE COLLABORATION"
        title="Permanent Study Room"
        description="One shared Google Meet room for all WORRIOR 2027 members."
      />

      <div className="live-warning">
        <ShieldCheck size={18} />
        <div>
          <b>Private group reminder</b>
          <p>
            This is the shared study room. Only invite your group members
            and trusted participants to this meeting.
          </p>
        </div>
      </div>

      <div className="live-controls panel">
        <div>
          <span className="live-indicator" />
          <b>Permanent Study Room</b>
          <p className="muted">
            One shared Google Meet link for all group members.
          </p>
        </div>

        <div className="live-actions">
          <button
            className="btn primary"
            onClick={openMeeting}
            disabled={!meetLink}
          >
            <Video size={17} />
            Join Study Room
          </button>
        </div>
      </div>

      <div className="meeting-placeholder">
        <div className="meeting-icon">
          <Video size={34} />
        </div>

        <h2>Your study room is ready</h2>

        <p>
          Open the shared Google Meet room. All members can use
          the same link to join the meeting.
        </p>

        <button className="btn primary" onClick={openMeeting} disabled={!meetLink}>
          Join Google Meet
          <ChevronRight size={17} />
        </button>
        {!meetLink && (
          <p className="muted" role="status">
            Google Meet link is not configured yet.
          </p>
        )}
      </div>
    </>
  );
}

function SetupScreen() {
  return <div className="center-screen"><div className="login-card"><div className="brand-mark large">W</div><p className="eyebrow">PROJECT SETUP</p><h1>Connect your Supabase project</h1><p className="muted">Copy <code>.env.example</code> to <code>.env</code>, add your Supabase project URL and anon key, then restart the development server.</p><div className="setup-steps"><span>1. Create a Supabase project</span><span>2. Run <code>supabase/schema.sql</code></span><span>3. Configure environment variables</span><span>4. Start with <code>npm run dev</code></span></div></div></div>;
}
function Login({ email, setEmail, password, setPassword, onSubmit, notice, theme, onToggleTheme }) {
  return <div className="login-screen">
    <div className="login-theme-control"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div><div className="login-visual"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><div className="hero-brand"><div className="brand-mark large">W</div><span>WORRIOR <em>2027</em></span></div><div className="hero-copy"><p className="eyebrow">YOUR PRIVATE STUDY CAMPUS</p><h1>Learn together.<br /><span>Rise together.</span></h1><p>A focused space for six students to teach, collaborate and prepare for success.</p></div><div className="hero-footer">STUDY · SHARE · SUCCEED</div></div><div className="login-panel"><form className="login-card" onSubmit={onSubmit}><p className="eyebrow">MEMBER ACCESS</p><h2>Welcome back</h2><p className="muted">Sign in with the account created by your group admin.</p><label>Email address</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /><label>Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /><button className="btn primary full">Sign in <ChevronRight size={17} /></button>{notice && <p className="notice">{notice}</p>}<p className="login-foot"><LockKeyhole size={13} /> Private access · Invite-only members</p></form></div></div>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>;
}
function Overview({ profile, setPage }) {
  const [stats, setStats] = useState({ members: 0, messages: 0, files: 0, tasks: 0 });
  const [recent, setRecent] = useState([]);
  const [gamification, setGamification] = useState(null);
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date()).toUpperCase();
  useEffect(() => {
    let live = true; (async () => {
      const [m, c, f, t] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }),
        supabase.from("study_files").select("id", { count: "exact", head: true }),
        supabase.from("assignments").select("id", { count: "exact", head: true })
      ]); if (live) setStats({ members: m.count || 0, messages: c.count || 0, files: f.count || 0, tasks: t.count || 0 });
      const { data } = await supabase.from("messages").select("id,content,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(4); if (live) setRecent(data || []);
      const { data: progressData, error: progressError } = await supabase.rpc("get_gamification_dashboard");
      if (live && !progressError) setGamification(progressData);
    })(); return () => { live = false }
  }, []);
  return <><PageHeading eyebrow={`${todayLabel} · YOUR STUDY SPACE`} title={`Good to see you, ${profile.full_name.split(" ")[0]}.`} description="Your team's learning hub. Make today count." action={<button className="btn primary" onClick={() => setPage("Live room")}><Video size={17} /> Join live room</button>} />
    <div className="welcome-banner"><div><p className="eyebrow">CLASS OF 2027</p><h2>Small group. Big ambitions.</h2><p>Six learners, one shared goal: consistent progress.</p><button className="banner-link" onClick={() => setPage("Messages")}>Open group chat <ChevronRight size={15} /></button></div><div className="banner-art"><div className="art-ring" /><BookOpen size={76} /><span>W</span></div></div>
    <div className="stat-grid"><Stat icon={Users} label="Group members" value={stats.members + "/6"} tone="violet" /><Stat icon={MessageCircle} label="Messages" value={stats.messages} tone="blue" /><Stat icon={FolderOpen} label="Shared files" value={stats.files} tone="orange" /><Stat icon={CheckSquare} label="Assignments" value={stats.tasks} tone="green" /></div>

    <div className="panel" style={{
      marginBottom: 24,
      padding: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      flexWrap: "wrap"
    }}>
      <div>
        <p className="eyebrow">WORRIOR FOCUS ZONE</p>
        <h2 style={{ margin: "8px 0" }}>
          <Clock size={22} style={{ verticalAlign: "middle" }} /> Study Timer
        </h2>
        <p className="muted">
          Focus sessions, countdown and alarm in one place.
        </p>
        <button
          className="btn primary"
          onClick={() => setPage("Study Timer")}
        >
          Open Study Timer <ChevronRight size={17} />
        </button>
      </div>

      <div style={{
        textAlign: "center",
        padding: 20,
        borderRadius: 16,
        background: "rgba(124, 92, 255, 0.12)",
        minWidth: 130
      }}>
        <Clock size={30} />
        <h2 style={{ fontSize: 30, margin: "10px 0" }}>25:00</h2>
        <small className="muted">Focus session</small>
      </div>
    </div>

    <DailyIntentions profile={profile} setPage={setPage} />
    <ProgressSnapshot data={gamification} setPage={setPage} />
    <div className="content-grid"><section className="panel"><div className="panel-head"><div><h3>Recent conversations</h3><p className="muted">Latest updates from your group</p></div><button className="text-btn" onClick={() => setPage("Messages")}>View chat <ChevronRight size={14} /></button></div>{recent.length ? recent.map(x => <div className="recent-row" key={x.id}><div className="avatar">{initials(x.profiles?.full_name)}</div><div className="recent-copy"><b>{x.profiles?.full_name || "Member"}</b><p>{x.content}</p></div><small>{prettyDate(x.created_at)}</small></div>) : <Empty text="No messages yet. Start the conversation with your team." />}</section><section className="panel quick-panel"><div className="panel-head"><div><h3>Quick access</h3><p className="muted">Jump back into your work</p></div></div>{[["Messages", MessageCircle, "Discuss a topic"], ["Study materials", FolderOpen, "Find shared notes"], ["Assignments", CheckSquare, "Check group tasks"], ["Members", Users, "Meet your teammates"]].map(([n, I, d]) => <button className="quick-link" key={n} onClick={() => setPage(n)}><span className="quick-icon"><I size={18} /></span><span><b>{n}</b><small>{d}</small></span><ChevronRight size={16} /></button>)}</section></div>
  </>;
}
function ProgressSnapshot({ data, setPage }) {
  return (
    <section className="progress-snapshot panel">
      <div className="progress-snapshot-head">
        <div><p className="eyebrow">YOUR GROWTH</p><h3>Every session moves you forward.</h3><p className="muted">Verified focus time, real XP and a streak you can build day by day.</p></div>
        <button className="text-btn" type="button" onClick={() => setPage("Progress & Rewards")}>View progress <ChevronRight size={15} /></button>
      </div>
      {data ? (
        <>
          <div className="snapshot-stats">
            <div><Zap size={18}/><strong>{data.total_xp.toLocaleString()} XP</strong><small>Total points</small></div>
            <div><Flame size={18}/><strong>{data.current_streak} days</strong><small>Current streak</small></div>
            <div><Award size={18}/><strong>Level {data.level}</strong><small>Current level</small></div>
          </div>
          <div className="snapshot-level"><div><span>Level progress</span><b>{data.level_xp} / 500 XP</b></div><div className="snapshot-track"><span style={{ width: Math.min(100, data.level_xp / 5) + "%" }} /></div></div>
        </>
      ) : (
        <div className="snapshot-waiting"><ShieldCheck size={20}/><span>Verified XP, streaks and badges unlock after the secure database setup is approved.</span></div>
      )}
    </section>
  );
}

function DailyIntentions({ profile, setPage }) {
  const localNow = new Date();
  const today = [localNow.getFullYear(), String(localNow.getMonth() + 1).padStart(2, "0"), String(localNow.getDate()).padStart(2, "0")].join("-");
  const storageKey = "worrior-intentions-" + profile.id + "-" + today;
  const intentions = [
    { id: "focus", title: "Complete one focused study session", detail: "Start your focus timer", page: "Study Timer", icon: Clock },
    { id: "review", title: "Review a shared learning resource", detail: "Open your study materials", page: "Study materials", icon: BookOpen },
    { id: "connect", title: "Contribute to the study group", detail: "Ask, answer or encourage", page: "Messages", icon: MessageCircle },
  ];
  const [completed, setCompleted] = useState(() => {
    try { const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]"); return Array.isArray(saved) ? saved : []; }
    catch { return []; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(completed)); } catch { /* local progress is optional */ }
  }, [storageKey, completed]);
  const progress = Math.round((completed.length / intentions.length) * 100);
  return (
    <section className="daily-intentions panel" aria-labelledby="daily-intentions-title">
      <div className="daily-intentions-head"><div><p className="eyebrow">YOUR DAILY RHYTHM</p><h3 id="daily-intentions-title">Small steps. Real momentum.</h3><p className="muted">Choose three simple intentions for today.</p></div>
        <div className="intent-progress" aria-label={completed.length + " of 3 intentions completed"}><strong>{completed.length}/3</strong><small>completed</small></div>
      </div>
      <div className="intent-progress-track"><span style={{ width: progress + "%" }} /></div>
      <div className="intentions-list">
        {intentions.map(item => {
          const Icon = item.icon;
          const checked = completed.includes(item.id);
          return <div className={"intention-row " + (checked ? "done" : "")} key={item.id}>
            <button className="intention-check" type="button" aria-pressed={checked} aria-label={(checked ? "Undo: " : "Complete: ") + item.title} onClick={() => setCompleted(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}>{checked ? <CheckSquare size={19} /> : <span className="empty-check" />}</button>
            <div className="intention-icon"><Icon size={18} /></div>
            <div className="intention-copy"><strong>{item.title}</strong><small>{item.detail}</small></div>
            <button className="intention-open" type="button" onClick={() => setPage(item.page)}>Open <ChevronRight size={15} /></button>
          </div>;
        })}
      </div>
      <p className="intent-note">Personal checklist saved on this browser only. It does not change group data or award XP.</p>
    </section>
  );
}
function Stat({ icon: Icon, label, value, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div><small>{label}</small><strong>{value}</strong></div></div> }
function Empty({ text }) { return <div className="empty-state"><div className="empty-icon"><MessageCircle size={22} /></div><p>{text}</p></div> }


function Messages({ profile }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  async function refreshMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("id,content,created_at,user_id,profiles(full_name)")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error(error.message);
      return;
    }

    setItems(data || []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("messages")
        .select("id,content,created_at,user_id,profiles(full_name)")
        .order("created_at", { ascending: true })
        .limit(100);

      if (mounted && !error) setItems(data || []);
    }

    load();

    const channel = supabase
      .channel("group-messages", { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          if (mounted) refreshMessages();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function send(e) {
    e.preventDefault();

    if (!draft.trim()) return;

    setBusy(true);

    const { error } = await supabase
      .from("messages")
      .insert({
        content: draft.trim(),
        user_id: profile.id
      });

    if (error) {
      alert(error.message);
    } else {
      setDraft("");
      await refreshMessages();
    }

    setBusy(false);
  }

  function startEditing(message) {
    setEditingId(message.id);
    setEditDraft(message.content);
  }

  async function saveEdit(id) {
    if (!editDraft.trim()) {
      alert("Message cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .update({ content: editDraft.trim() })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setEditDraft("");
    await refreshMessages();
  }

  async function deleteMessage(id) {
    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refreshMessages();
  }

  return (
    <>
      <PageHeading
        eyebrow="TEAM COMMUNICATION"
        title="Group messages"
        description="Ask questions, share ideas and help each other learn."
      />

      <div className="chat-panel panel">
        <div className="chat-top">
          <div>
            <b><Hash size={16} /> general</b>
            <small>Everyone in WORRIOR 2027</small>
          </div>
          <span className="online-pill">
            <i /> Live chat
          </span>
        </div>

        <div className="chat-list">
          {items.map(m => (
            <div
              className={`message ${m.user_id === profile.id ? "mine" : ""}`}
              key={m.id}
            >
              <div className="avatar">
                {initials(m.profiles?.full_name)}
              </div>

              <div className="message-body">
                <div className="message-meta">
                  <b>{m.profiles?.full_name || "Member"}</b>
                  <small>{prettyDate(m.created_at)}</small>
                </div>

                {editingId === m.id ? (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      maxLength={3000}
                      autoFocus
                    />

                    <div style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 8
                    }}>
                      <button
                        className="btn primary"
                        onClick={() => saveEdit(m.id)}
                      >
                        Save
                      </button>

                      <button
                        className="btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{m.content}</p>

                    <div className="message-actions">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => startEditing(m)}
                        title="Edit message"
                      >
                        <Pencil size={14} /> Edit
                      </button>

                      <button
                        className="btn"
                        type="button"
                        onClick={() => deleteMessage(m.id)}
                        title="Delete message"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {!items.length && (
            <Empty text="No messages yet. Say hello to your study group!" />
          )}
        </div>

        <form className="chat-compose" onSubmit={send}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Message your study group…"
            maxLength={3000}
          />

          <button
            className="btn primary"
            disabled={busy || !draft.trim()}
          >
            <Send size={17} /> Send
          </button>
        </form>
      </div>
    </>
  );
}


function Materials({ profile }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  async function refresh() {
    const { data, error } = await supabase
      .from("study_files")
      .select("id,file_name,storage_path,created_at,profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setFiles(data || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("Please choose a file smaller than 20 MB.");
      e.target.value = "";
      return;
    }

    setBusy(true);

    const path = `${profile.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.storage
      .from("study-files")
      .upload(path, file, { upsert: false });

    if (error) {
      alert(error.message);
    } else {
      const result = await supabase.from("study_files").insert({
        file_name: file.name,
        storage_path: path,
        user_id: profile.id
      });

      if (result.error) {
        alert("File uploaded, but its record could not be saved: " + result.error.message);
      }

      await refresh();
    }

    setBusy(false);
    e.target.value = "";
  }

  async function download(f) {
    const { data, error } = await supabase.storage
      .from("study-files")
      .createSignedUrl(f.storage_path, 60);

    if (error) {
      alert(error.message);
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  function startEdit(f) {
    setEditingId(f.id);
    setEditName(f.file_name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id) {
    if (!editName.trim()) {
      alert("Please enter a file name.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("study_files")
      .update({ file_name: editName.trim() })
      .eq("id", id);

    setBusy(false);

    if (error) {
      alert("Rename failed: " + error.message);
      return;
    }

    cancelEdit();
    await refresh();
    alert("File name updated successfully!");
  }

  async function deleteFile(f) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${f.file_name}"?`
    );

    if (!confirmed) return;

    setBusy(true);

    const { error: storageError } = await supabase.storage
      .from("study-files")
      .remove([f.storage_path]);

    if (storageError) {
      setBusy(false);
      alert("File deletion failed: " + storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("study_files")
      .delete()
      .eq("id", f.id);

    setBusy(false);

    if (dbError) {
      alert(
        "Storage file was deleted, but its database record could not be deleted: " +
        dbError.message
      );
      await refresh();
      return;
    }

    await refresh();
    alert("File deleted successfully!");
  }

  return (
    <>
      <PageHeading
        eyebrow="SHARED LIBRARY"
        title="Study materials"
        description="Upload and access notes, PDFs, worksheets and presentations."
        action={
          <label className="btn primary upload-btn">
            <Plus size={17} />
            {busy ? "Uploading…" : "Upload file"}
            <input
              type="file"
              hidden
              onChange={upload}
              disabled={busy}
            />
          </label>
        }
      />

      <div className="panel file-panel">
        <div className="file-toolbar">
          <span>
            <FolderOpen size={17} /> Shared with all members
          </span>
          <small>Maximum file size: 20 MB</small>
        </div>

        {files.length ? (
          files.map(f => (
            <div className="file-row" key={f.id}>
              <div className="file-icon">
                <FileText size={20} />
              </div>

              <div className="file-copy">
                {editingId === f.id ? (
                  <div className="material-edit">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Enter file name"
                    />

                    <div className="material-actions">
                      <button
                        className="btn primary"
                        type="button"
                        disabled={busy}
                        onClick={() => saveEdit(f.id)}
                      >
                        Save
                      </button>

                      <button
                        className="btn"
                        type="button"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <b>{f.file_name}</b>
                    <small>
                      Uploaded by {f.profiles?.full_name || "Member"} · {prettyDate(f.created_at)}
                    </small>
                  </>
                )}
              </div>

              {editingId !== f.id && (
                <div className="material-actions">
                  <button
                    className="icon-btn"
                    type="button"
                    title="Download"
                    onClick={() => download(f)}
                  >
                    <Download size={18} />
                  </button>

                  <button
                    className="icon-btn"
                    type="button"
                    title="Rename"
                    disabled={busy}
                    onClick={() => startEdit(f)}
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    className="icon-btn"
                    type="button"
                    title="Delete"
                    disabled={busy}
                    onClick={() => deleteFile(f)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <Empty text="Your shared library is empty. Upload your first study resource." />
        )}
      </div>
    </>
  );
}



function DeadlineCountdown({ dueAt }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!dueAt) {
      setRemaining("No deadline");
      return;
    }

    function updateTimer() {
      const diff = new Date(dueAt).getTime() - Date.now();

      if (diff <= 0) {
        setRemaining("Deadline expired");
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setRemaining(
        `${days}d : ${hours}h : ${minutes}m : ${seconds}s`
      );
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [dueAt]);

  return <b>{remaining}</b>;
}

function Assignments({ profile }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [editDue, setEditDue] = useState("");

  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("assignments")
      .select("id,title,details,due_at,created_at,profiles(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add(e) {
    e.preventDefault();
    setBusy(true);

    const { error } = await supabase.from("assignments").insert({
      title,
      details,
      due_at: due ? new Date(due).toISOString() : null,
      created_by: profile.id
    });

    setBusy(false);

    if (error) {
      alert(error.message);
    } else {
      setTitle("");
      setDetails("");
      setDue("");
      await refresh();
      alert("Assignment published successfully!");
    }
  }

  function formatDeadline(date) {
    if (!date) return "No deadline set";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  function deadlineStatus(date) {
    if (!date) return "No deadline";

    return new Date(date).getTime() < Date.now()
      ? "Overdue"
      : "Upcoming";
  }

  function startEdit(a) {
    setEditingId(a.id);
    setEditTitle(a.title || "");
    setEditDetails(a.details || "");

    if (a.due_at) {
      const d = new Date(a.due_at);
      const localDate = new Date(
        d.getTime() - d.getTimezoneOffset() * 60000
      ).toISOString().slice(0, 16);

      setEditDue(localDate);
    } else {
      setEditDue("");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDetails("");
    setEditDue("");
  }

  async function saveEdit(id) {
    if (!editTitle.trim()) {
      alert("Please enter an assignment title.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("assignments")
      .update({
        title: editTitle.trim(),
        details: editDetails,
        due_at: editDue
          ? new Date(editDue).toISOString()
          : null
      })
      .eq("id", id);

    setBusy(false);

    if (error) {
      alert("Update failed: " + error.message);
      return;
    }

    cancelEdit();
    await refresh();
    alert("Assignment updated successfully!");
  }

  async function deleteAssignment(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this assignment?"
    );

    if (!confirmed) return;

    setBusy(true);

    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id);

    setBusy(false);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    await refresh();
    alert("Assignment deleted successfully!");
  }

  return (
    <>
      <PageHeading
        eyebrow="KEEP MOVING FORWARD"
        title="Assignments"
        description="Create tasks, set deadlines and stay accountable."
      />

      <div className="content-grid">
        <form className="panel form-panel" onSubmit={add}>
          <h3>Create an assignment</h3>

          <label>Task title</label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Complete Real Numbers exercise"
          />

          <label>Instructions</label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Add chapter, questions or instructions..."
          />

          <label>Due date and time</label>
          <input
            type="datetime-local"
            value={due}
            onChange={e => setDue(e.target.value)}
          />

          <button
            className="btn primary full"
            type="submit"
            disabled={busy}
          >
            <Plus size={17} /> Publish assignment
          </button>
        </form>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Group assignments</h3>
              <p className="muted">
                {rows.length} tasks published
              </p>
            </div>
          </div>

          {rows.length ? (
            rows.map(a => (
              <div className="assignment-row" key={a.id}>
                <div className="task-check">
                  <CheckSquare size={19} />
                </div>

                <div className="assignment-content">
                  {editingId === a.id ? (
                    <div className="assignment-edit">
                      <label>Task title</label>
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                      />

                      <label>Instructions</label>
                      <textarea
                        value={editDetails}
                        onChange={e => setEditDetails(e.target.value)}
                      />

                      <label>Due date and time</label>
                      <input
                        type="datetime-local"
                        value={editDue}
                        onChange={e => setEditDue(e.target.value)}
                      />

                      <div className="assignment-actions">
                        <button
                          className="btn primary"
                          type="button"
                          disabled={busy}
                          onClick={() => saveEdit(a.id)}
                        >
                          Save changes
                        </button>

                        <button
                          className="btn"
                          type="button"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <b>{a.title}</b>

                      <p>
                        {a.details || "No additional instructions."}
                      </p>

                      <small>
                        By {a.profiles?.full_name || "Admin"}
                      </small>

                      <p>
                        <b>Due:</b> {formatDeadline(a.due_at)}
                      </p>

                      <p>
                        <b>Status:</b> {deadlineStatus(a.due_at)}
                      </p>

                      <p>
                        <b>Time remaining:</b>{" "}
                        <DeadlineCountdown dueAt={a.due_at} />
                      </p>

                      <div className="assignment-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => startEdit(a)}
                        >
                          <Pencil size={15} /> Edit
                        </button>

                        <button
                          className="btn"
                          type="button"
                          disabled={busy}
                          onClick={() => deleteAssignment(a.id)}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty text="No assignments published yet." />
          )}
        </section>
      </div>
    </>
  );
}



function Members({ profile }) {
  const [members, setMembers] = useState([]);
  useEffect(() => { supabase.from("profiles").select("id,full_name,role,created_at").order("created_at").then(({ data }) => setMembers(data || [])) }, []);
  return <><PageHeading eyebrow="YOUR TEAM" title="Group members" description="Six people learning, teaching and growing together." /><div className="member-grid">{members.map((m, i) => <div className="panel member-card" key={m.id}><div className="member-avatar">{initials(m.full_name)}</div><h3>{m.full_name}</h3><p>{m.role === "admin" ? "Group administrator" : "Study group member"}</p><span className={`role-tag ${m.role}`}>{m.role === "admin" ? "ADMIN" : "MEMBER"}</span>{m.id === profile.id && <small className="you-tag">You</small>}</div>)}</div>{members.length === 0 && <Empty text="No members found." />}</>;
}


function Schedule({ profile }) {
  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [rows, setRows] = useState([]);
  const [subject, setSubject] = useState("Mathematics");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("Pending");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("scheduled_date", selectedDate)
      .order("start_time", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    refresh();
  }, [selectedDate]);

  function resetForm() {
    setSubject("Mathematics");
    setTaskTitle("");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setStatus("Pending");
    setEditingId(null);
  }

  async function saveTask(e) {
    e.preventDefault();

    if (startTime && endTime && endTime <= startTime) {
      alert("End time must be later than start time.");
      return;
    }

    setLoading(true);
    const task = {
      subject,
      task_title: taskTitle,
      description,
      scheduled_date: selectedDate,
      start_time: startTime || null,
      end_time: endTime || null,
      status,
      created_by: profile.id
    };

    const result = editingId
      ? await supabase.from("schedules").update(task).eq("id", editingId)
      : await supabase.from("schedules").insert(task);

    setLoading(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    resetForm();
    await refresh();
    alert(editingId ? "Task updated!" : "Task added successfully!");
  }

  function editTask(task) {
    setEditingId(task.id);
    setSubject(task.subject);
    setTaskTitle(task.task_title);
    setDescription(task.description || "");
    setStartTime(task.start_time?.slice(0, 5) || "");
    setEndTime(task.end_time?.slice(0, 5) || "");
    setStatus(task.status);
  }

  async function deleteTask(id) {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refresh();
  }

  async function changeStatus(id, newStatus) {
    const { error } = await supabase
      .from("schedules")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refresh();
  }

  function changeDay(amount) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + amount);

    const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSelectedDate(nextDate);
    resetForm();
  }

  const readableDate = new Date(selectedDate + "T12:00:00")
    .toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  const completed = rows.filter(x => x.status === "Completed").length;

  return (
    <>
      <PageHeading
        eyebrow="PLAN YOUR DAY"
        title="Daily Study Planner"
        description="One shared timetable for all WORRIOR 2027 members."
      />

      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div>
            <p className="eyebrow">SELECTED DAY</p>
            <h2>{readableDate}</h2>
            <p className="muted">
              {completed} of {rows.length} tasks completed
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => changeDay(-1)}>
              ← Previous
            </button>

            <button className="btn" onClick={() => {
              setSelectedDate(getToday());
              resetForm();
            }}>
              Today
            </button>

            <button className="btn" onClick={() => changeDay(1)}>
              Next →
            </button>
          </div>
        </div>

        <label style={{ display: "block", marginTop: 18 }}>
          Choose date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => {
            setSelectedDate(e.target.value);
            resetForm();
          }}
        />
      </div>

      <div className="content-grid">
        <form className="panel form-panel" onSubmit={saveTask}>
          <h3>{editingId ? "Edit task" : "Add today's task"}</h3>

          <label>Subject</label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
          >
            {[
              "Mathematics",
              "Science",
              "Social Science",
              "English",
              "Hindi",
              "IT 402",
              "Other"
            ].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label>Task title</label>
          <input
            required
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            placeholder="e.g. Real Numbers exercise"
          />

          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Chapter, topics or instructions..."
          />

          <label>Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />

          <label>End time</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          />

          <label>Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option>Pending</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>

          <button
            className="btn primary full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving..." : editingId ? "Update Task" : "+ Add Task"}
          </button>

          {editingId && (
            <button
              type="button"
              className="btn full"
              onClick={resetForm}
              style={{ marginTop: 8 }}
            >
              Cancel Editing
            </button>
          )}
        </form>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Today's Tasks</h3>
              <p className="muted">
                {rows.length} tasks scheduled
              </p>
            </div>
          </div>

          {rows.length === 0 ? (
            <Empty text="No tasks scheduled for this day. Add your first task!" />
          ) : (
            rows.map(task => (
              <div
                className="assignment-row"
                key={task.id}
                style={{ padding: "16px 0" }}
              >
                <div style={{ flex: 1 }}>
                  <b>{task.subject}</b>
                  <h3 style={{ margin: "6px 0" }}>
                    {task.task_title}
                  </h3>

                  <p>{task.description || "No description."}</p>

                  <small>
                    {task.start_time?.slice(0, 5) || "--:--"}
                    {" – "}
                    {task.end_time?.slice(0, 5) || "--:--"}
                  </small>

                  <div style={{ marginTop: 10 }}>
                    <select
                      value={task.status}
                      onChange={e => changeStatus(task.id, e.target.value)}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>

                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    flexWrap: "wrap"
                  }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => editTask(task)}
                    >
                      Edit
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}



function AdminPanel({ profile }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementStatus, setAnnouncementStatus] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  async function create(e) {
    e.preventDefault();
    setMessage("Creating account…");

    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke(
      "admin-create-member",
      {
        body: { full_name: name, email, password },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    setMessage(
      error
        ? error.message
        : (data?.message || "Member account created.")
    );

    if (!error) {
      setName("");
      setEmail("");
      setPassword("");
    }
  }

  async function sendAnnouncement(e) {
    e.preventDefault();

    if (!announcementTitle.trim() || !announcementBody.trim()) return;

    setSendingAnnouncement(true);
    setAnnouncementStatus("Sending announcement…");

    const { data, error } = await supabase.rpc(
      "send_group_announcement",
      {
        p_title: announcementTitle.trim(),
        p_message: announcementBody.trim()
      }
    );

    setSendingAnnouncement(false);

    if (error) {
      setAnnouncementStatus("Error: " + error.message);
      return;
    }

    setAnnouncementStatus(
      `Announcement sent successfully to ${data} members!`
    );

    setAnnouncementTitle("");
    setAnnouncementBody("");
  }

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE CONTROL"
        title="Settings & administration"
        description="Manage your private student group."
      />

      <div className="content-grid">

        <section className="panel form-panel">
          <div className="admin-heading">
            <ShieldCheck size={21} />
            <div>
              <h3>Create member account</h3>
              <p className="muted">
                Admin-only action. Up to six group members.
              </p>
            </div>
          </div>

          {profile.role === "admin" ? (
            <form onSubmit={create}>
              <label>Student full name</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Student name"
              />

              <label>Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@example.com"
              />

              <label>Temporary password</label>
              <input
                type="password"
                minLength="8"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />

              <button className="btn primary full" type="submit">
                <Plus size={17} /> Create account
              </button>

              <p className="muted tiny">
                Share temporary passwords privately. Members should
                change them after first login.
              </p>

              {message && <p className="notice">{message}</p>}
            </form>
          ) : (
            <p className="muted">
              Only the group administrator can create member accounts.
            </p>
          )}
        </section>

        <section className="panel form-panel">
          <div className="admin-heading">
            <Send size={21} />
            <div>
              <h3>Send group announcement</h3>
              <p className="muted">
                Notify all other members instantly.
              </p>
            </div>
          </div>

          {profile.role === "admin" ? (
            <form onSubmit={sendAnnouncement}>
              <label>Announcement title</label>
              <input
                required
                maxLength={100}
                value={announcementTitle}
                onChange={e => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. Important study update"
              />

              <label>Announcement message</label>
              <textarea
                required
                maxLength={2000}
                rows={5}
                value={announcementBody}
                onChange={e => setAnnouncementBody(e.target.value)}
                placeholder="Write your announcement here..."
              />

              <button
                className="btn primary full"
                type="submit"
                disabled={sendingAnnouncement}
              >
                <Send size={17} />
                {sendingAnnouncement ? "Sending..." : "Send announcement"}
              </button>

              {announcementStatus && (
                <p className="notice">{announcementStatus}</p>
              )}
            </form>
          ) : (
            <p className="muted">
              Only the group administrator can send announcements.
            </p>
          )}
        </section>

        <section className="panel">
          <h3>Workspace information</h3>
          <div className="info-line">
            <span>Workspace</span>
            <b>WORRIOR 2027</b>
          </div>
          <div className="info-line">
            <span>Access</span>
            <b>Invite-only</b>
          </div>
          <div className="info-line">
            <span>Maximum members</span>
            <b>6 students</b>
          </div>
          <div className="info-line">
            <span>Video provider</span>
            <b>Jitsi Meet</b>
          </div>
        </section>

      </div>
    </>
  );
}

function AnnouncementPage({ profile }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function sendAnnouncement(e) {
    e.preventDefault();

    if (!title.trim() || !body.trim()) return;

    setSending(true);
    setStatus("Sending announcement...");

    const { data, error } = await supabase.rpc(
      "send_group_announcement",
      {
        p_title: title.trim(),
        p_message: body.trim()
      }
    );

    setSending(false);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setStatus(`Announcement sent successfully to ${data} members!`);
    setTitle("");
    setBody("");
  }

  return (
    <>
      <PageHeading
        eyebrow="TEAM COMMUNICATION"
        title="Announcements"
        description="Share important updates with every member of WORRIOR 2027."
      />

      {profile.role === "admin" ? (
        <div className="content-grid">
          <section className="panel form-panel">
            <div className="admin-heading">
              <Megaphone size={22} />
              <div>
                <h3>Create announcement</h3>
                <p className="muted">
                  Your announcement will appear in members' notifications.
                </p>
              </div>
            </div>

            <form onSubmit={sendAnnouncement}>
              <label>Announcement title</label>
              <input
                required
                maxLength={100}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter announcement title"
              />

              <label>Announcement message</label>
              <textarea
                required
                rows={6}
                maxLength={2000}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your announcement..."
              />

              <button
                className="btn primary full"
                type="submit"
                disabled={sending}
              >
                <Send size={17} />
                {sending ? "Sending..." : "Send announcement"}
              </button>

              {status && <p className="notice">{status}</p>}
            </form>
          </section>
        </div>
      ) : (
        <section className="panel">
          <h3>Group announcements</h3>
          <p className="muted">
            Only the group administrator can publish announcements.
            Check your notification bell for new updates.
          </p>
        </section>
      )}
    </>
  );
}


