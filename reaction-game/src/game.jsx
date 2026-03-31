import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
} from "firebase/database";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
// Firebase Console → Project Settings → Your Apps → SDK setup → Config
const firebaseConfig = {
  apiKey: "AIzaSyCoRvrfB-TVcQGItVeaAQj3ywF80xWfdZ8",
  authDomain: "reaction-game-1234.firebaseapp.com",
  databaseURL: "https://reaction-game-1234-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "reaction-game-1234",
  storageBucket: "reaction-game-1234.firebasestorage.app",
  messagingSenderId: "631400334389",
  appId: "1:631400334389:web:923a9fe6e978bd3287dd7c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const generateRoomCode = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase();

const randomTargetMs = () => {
  const ms = Math.floor(Math.random() * 12000 + 3000);
  return Math.round(ms / 100) * 100;
};

const formatMs = (ms) => {
  if (ms == null || ms < 0) return "--:--.--";
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60);
  if (m > 0)
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  return `${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

const diffMs = (a, target) => Math.abs(a - target);
const roomPath = (code) => `rooms/${code}`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Game() {
  const [view, setView] = useState("lobby");
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [totalRounds, setTotalRounds] = useState(5);
  const [error, setError] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [players, setPlayers] = useState({});
  const [playerId, setPlayerId] = useState(null);
  const [isHost, setIsHost] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [countdownVal, setCountdownVal] = useState(3);

  // Stable refs
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const countdownRef = useRef(null);
  const roomCodeRef = useRef("");
  const playerIdRef = useRef("");
  const isHostRef = useRef(false);
  const prevStatusRef = useRef(null);
  const stoppedRef = useRef(false);
  const resolvingRef = useRef(false);

  const stopRaf = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const startStopwatch = useCallback(() => {
    stopRaf();
    setStopped(false);
    stoppedRef.current = false;
    setElapsed(0);
    startTimeRef.current = performance.now();
    setView("playing");
    const tick = () => {
      setElapsed(Math.floor(performance.now() - startTimeRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const runCountdown = useCallback((onDone) => {
    setView("countdown");
    if (countdownRef.current) clearTimeout(countdownRef.current);
    let c = 3;
    setCountdownVal(c);
    const tick = () => {
      c--;
      setCountdownVal(c);
      if (c > 0) countdownRef.current = setTimeout(tick, 1000);
      else countdownRef.current = setTimeout(onDone, 400);
    };
    countdownRef.current = setTimeout(tick, 1000);
  }, []);

  // ── Resolve round (host only) ────────────────────────────────────────────────
  const resolveRound = useCallback(async (code, meta, pMap) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    const target = meta.targetMs;
    const entries = Object.entries(pMap);
    let winnerId = null;
    let minDiff = Infinity;
    for (const [pid, p] of entries) {
      const d = diffMs(p.stoppedMs, target);
      if (d < minDiff) { minDiff = d; winnerId = pid; }
    }
    const updates = {};
    for (const [pid, p] of entries) {
      updates[`${roomPath(code)}/players/${pid}/score`] =
        (p.score || 0) + (pid === winnerId ? 1 : 0);
    }
    const nextRound = (meta.currentRound || 1) + 1;
    const isLast = nextRound > meta.totalRounds;
    updates[`${roomPath(code)}/status`] = isLast ? "game_over" : "round_result";
    updates[`${roomPath(code)}/winnerId`] = winnerId;
    updates[`${roomPath(code)}/currentRound`] = nextRound;
    await update(ref(db), updates);
    resolvingRef.current = false;
  }, []);

  // ── Firebase subscription ────────────────────────────────────────────────────
  const subscribeRoom = useCallback((code) => {
    const rRef = ref(db, roomPath(code));
    onValue(rRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      const { players: pMap = {}, ...meta } = data;
      setRoomData(meta);
      setPlayers(pMap);

      const prev = prevStatusRef.current;
      const status = meta.status;

      if (status !== prev) {
        prevStatusRef.current = status;
        if (status === "countdown") runCountdown(() => startStopwatch());
        if (status === "round_result" || status === "game_over") {
          stopRaf();
          setView(status);
        }
      }

      // Host detects both stopped while status is "playing"
      if (status === "playing" && isHostRef.current) {
        const all = Object.values(pMap);
        if (all.length === 2 && all.every((p) => p.stoppedMs != null)) {
          resolveRound(code, meta, pMap);
        }
      }
    });
    return () => off(rRef);
  }, [runCountdown, startStopwatch, resolveRound]);

  // ── Create room ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!playerName.trim()) { setError("Enter your name first"); return; }
    setError("");
    const code = generateRoomCode();
    const pid = "p1";
    await set(ref(db, roomPath(code)), {
      status: "waiting",
      totalRounds,
      currentRound: 1,
      targetMs: randomTargetMs(),
      winnerId: null,
      players: {
        [pid]: { name: playerName.trim(), score: 0, isHost: true, stoppedMs: null },
      },
    });
    roomCodeRef.current = code;
    playerIdRef.current = pid;
    isHostRef.current = true;
    setRoomCode(code); setPlayerId(pid); setIsHost(true);
    setView("waiting");
    subscribeRoom(code);
  };

  // ── Join room ────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!playerName.trim()) { setError("Enter your name first"); return; }
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    setError("");
    const code = joinCode.trim().toUpperCase();
    const snap = await get(ref(db, roomPath(code)));
    if (!snap.exists()) { setError("Room not found"); return; }
    const data = snap.val();
    if (data.status !== "waiting") { setError("Game already started"); return; }
    if (Object.keys(data.players || {}).length >= 2) { setError("Room is full"); return; }
    const pid = "p2";
    const updates = {};
    updates[`${roomPath(code)}/players/${pid}`] =
      { name: playerName.trim(), score: 0, isHost: false, stoppedMs: null };
    updates[`${roomPath(code)}/status`] = "countdown";
    await update(ref(db), updates);
    roomCodeRef.current = code;
    playerIdRef.current = pid;
    isHostRef.current = false;
    setRoomCode(code); setPlayerId(pid); setIsHost(false);
    subscribeRoom(code);
  };

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (stoppedRef.current) return;
    const t = Math.floor(performance.now() - startTimeRef.current);
    stopRaf();
    setStopped(true); stoppedRef.current = true;
    setElapsed(t);
    const updates = {};
    updates[`${roomPath(roomCodeRef.current)}/players/${playerIdRef.current}/stoppedMs`] = t;
    // Keep status "playing" so host watcher triggers
    updates[`${roomPath(roomCodeRef.current)}/status`] = "playing";
    await update(ref(db), updates);
  };

  // ── Next round ───────────────────────────────────────────────────────────────
  const handleNextRound = async () => {
    const code = roomCodeRef.current;
    const updates = {};
    Object.keys(players).forEach((pid) => {
      updates[`${roomPath(code)}/players/${pid}/stoppedMs`] = null;
    });
    updates[`${roomPath(code)}/targetMs`] = randomTargetMs();
    updates[`${roomPath(code)}/status`] = "countdown";
    updates[`${roomPath(code)}/winnerId`] = null;
    await update(ref(db), updates);
  };

  // ── Rematch ──────────────────────────────────────────────────────────────────
  const handleRematch = async () => {
    const code = roomCodeRef.current;
    const updates = {};
    Object.keys(players).forEach((pid) => {
      updates[`${roomPath(code)}/players/${pid}/stoppedMs`] = null;
      updates[`${roomPath(code)}/players/${pid}/score`] = 0;
    });
    updates[`${roomPath(code)}/targetMs`] = randomTargetMs();
    updates[`${roomPath(code)}/status`] = "countdown";
    updates[`${roomPath(code)}/winnerId`] = null;
    updates[`${roomPath(code)}/currentRound`] = 1;
    updates[`${roomPath(code)}/totalRounds`] = totalRounds;
    await update(ref(db), updates);
  };

  const handleLeave = () => {
    stopRaf();
    if (countdownRef.current) clearTimeout(countdownRef.current);
    prevStatusRef.current = null;
    resolvingRef.current = false;
    setView("lobby"); setRoomCode(""); setRoomData(null); setPlayers({});
    setPlayerId(null); setIsHost(false); setElapsed(0); setStopped(false);
    setJoinCode(""); setError("");
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const playersList = Object.entries(players).map(([id, p]) => ({ id, ...p }));
  const opponent = playersList.find((p) => p.id !== playerId);
  const roundWinner = playersList.find((p) => p.id === roomData?.winnerId);
  const gameWinner = [...playersList].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const oppStopped = opponent?.stoppedMs != null;
  const displayRound = Math.min(
    (roomData?.currentRound || 1) > (roomData?.totalRounds || 1)
      ? roomData?.totalRounds : roomData?.currentRound || 1,
    roomData?.totalRounds || 1
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #080808; --surface: #0f0f0f; --surface2: #161616;
          --border: #1e1e1e; --border2: #2a2a2a;
          --accent: #e8ff47; --accent-glow: rgba(232,255,71,0.18);
          --danger: #ff3d57; --danger-glow: rgba(255,61,87,0.2);
          --text: #efefef; --text2: #888; --text3: #444;
          --ff-d: 'Bebas Neue', sans-serif; --ff-m: 'DM Mono', monospace;
        }
        html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--ff-m); }
        .root {
          min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232,255,71,0.05) 0%, transparent 60%), var(--bg);
        }
        .card {
          width: 100%; max-width: 400px; background: var(--surface); border: 1px solid var(--border);
          padding: 36px 32px; display: flex; flex-direction: column; gap: 24px; position: relative; overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent); opacity: 0.5;
        }
        .wordmark { font-family: var(--ff-d); font-size: 54px; letter-spacing: 0.03em; line-height: 0.9; color: var(--accent); filter: drop-shadow(0 0 24px rgba(232,255,71,0.35)); }
        .wordmark em { color: var(--text); font-style: normal; }
        .tagline { font-size: 10px; color: var(--text3); letter-spacing: 0.2em; text-transform: uppercase; margin-top: 6px; }
        .div { height: 1px; background: var(--border); }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .lbl { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3); }
        .inp {
          background: var(--surface2); border: 1px solid var(--border); padding: 10px 12px;
          color: var(--text); font-family: var(--ff-m); font-size: 13px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
        }
        .inp:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
        .inp::placeholder { color: var(--text3); }
        .inp-code { text-transform: uppercase; letter-spacing: 0.3em; font-size: 20px; text-align: center; }
        select.inp { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23444' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
        .btn { width: 100%; padding: 12px; font-family: var(--ff-d); font-size: 22px; letter-spacing: 0.08em; border: none; cursor: pointer; transition: all 0.1s; }
        .btn-primary { background: var(--accent); color: #080808; }
        .btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }
        .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
        .btn-ghost:hover { border-color: var(--border2); color: var(--text); }
        .btn-stop { background: var(--danger); color: #fff; font-size: 36px; padding: 20px; animation: sp 1.2s ease-in-out infinite; }
        .btn-stop:hover { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 6px 30px var(--danger-glow); }
        .btn-stop:disabled { background: var(--surface2); color: var(--text3); animation: none; transform: none; box-shadow: none; cursor: default; }
        @keyframes sp { 0%,100% { box-shadow: 0 0 0 0 var(--danger-glow); } 50% { box-shadow: 0 0 0 10px rgba(255,61,87,0); } }
        .err { font-size: 11px; color: var(--danger); letter-spacing: 0.04em; }
        .code-box { background: var(--surface2); border: 1px solid var(--border); padding: 20px; text-align: center; }
        .code-display { font-family: var(--ff-d); font-size: 72px; letter-spacing: 0.2em; color: var(--accent); filter: drop-shadow(0 0 20px rgba(232,255,71,0.3)); line-height: 1; }
        .code-hint { font-size: 10px; color: var(--text3); letter-spacing: 0.12em; margin-top: 8px; text-transform: uppercase; }
        .pslot { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
        .pslot:last-child { border-bottom: none; }
        .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dot-live { background: var(--accent); animation: blink 1.4s ease-in-out infinite; }
        .dot-empty { background: var(--text3); }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .badge { font-size: 9px; padding: 2px 5px; letter-spacing: 0.1em; text-transform: uppercase; }
        .badge-you { background: rgba(232,255,71,0.12); color: var(--accent); }
        .badge-host { background: rgba(255,255,255,0.06); color: var(--text3); }
        .cd-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 12px 0; }
        .cd-num { font-family: var(--ff-d); font-size: 160px; line-height: 1; color: var(--accent); filter: drop-shadow(0 0 60px rgba(232,255,71,0.5)); animation: pop 0.35s cubic-bezier(0.175,0.885,0.32,1.3); }
        @keyframes pop { from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .target-big { font-family: var(--ff-d); font-size: 70px; letter-spacing: 0.04em; color: var(--accent); filter: drop-shadow(0 0 30px rgba(232,255,71,0.3)); line-height: 1; text-align: center; }
        .sw { font-family: var(--ff-d); font-size: 80px; letter-spacing: 0.03em; text-align: center; line-height: 1; transition: color 0.15s, filter 0.15s; }
        .sw-live { color: var(--text); }
        .sw-stopped { color: var(--accent); filter: drop-shadow(0 0 30px rgba(232,255,71,0.4)); }
        .opp-bar { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; padding: 8px; background: var(--surface2); border: 1px solid var(--border); }
        .opp-bar.done { color: var(--danger); border-color: rgba(255,61,87,0.3); background: rgba(255,61,87,0.05); }
        .opp-bar.wait { color: var(--text3); }
        .score-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--text3); letter-spacing: 0.05em; }
        .score-me { color: var(--text2); }
        .rbanner { font-family: var(--ff-d); font-size: 54px; letter-spacing: 0.05em; text-align: center; line-height: 1; }
        .r-win { color: var(--accent); filter: drop-shadow(0 0 30px rgba(232,255,71,0.3)); }
        .r-lose { color: var(--danger); }
        .r-tie { color: var(--text2); }
        .rrow { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid var(--border); gap: 12px; }
        .rrow:last-child { border-bottom: none; }
        .rrow.winner .rname::before { content: '▶ '; color: var(--accent); }
        .rname { font-size: 12px; }
        .rtime { font-family: var(--ff-d); font-size: 22px; letter-spacing: 0.04em; }
        .rdiff { font-size: 10px; color: var(--text3); margin-top: 1px; }
        .rpts { font-family: var(--ff-d); font-size: 20px; color: var(--accent); }
        .rmeta { font-size: 10px; color: var(--text3); letter-spacing: 0.15em; text-transform: uppercase; text-align: center; }
        .hwait { font-size: 11px; color: var(--text3); text-align: center; letter-spacing: 0.06em; }
      `}</style>

      <div className="root">
        <div className="card">

          {/* LOBBY */}
          {view === "lobby" && (<>
            <div>
              <div className="wordmark">TICK<em>OFF</em></div>
              <div className="tagline">Multiplayer reaction timing game</div>
            </div>
            <div className="div" />
            <div className="field">
              <div className="lbl">Your name</div>
              <input className="inp" placeholder="Enter name..." value={playerName}
                onChange={(e) => setPlayerName(e.target.value)} maxLength={20} />
            </div>
            <div className="field">
              <div className="lbl">Rounds per game</div>
              <select className="inp" value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}>
                {[1, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n} round{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>Create Room</button>
            <div className="div" />
            <div className="field">
              <div className="lbl">Join with room code</div>
              <input className="inp inp-code" placeholder="XXXX" value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={4} />
            </div>
            <button className="btn btn-ghost" onClick={handleJoin}>Join Room</button>
            {error && <div className="err">{error}</div>}
          </>)}

          {/* WAITING */}
          {view === "waiting" && (<>
            <div>
              <div className="wordmark">TICK<em>OFF</em></div>
              <div className="tagline">Waiting for opponent</div>
            </div>
            <div className="div" />
            <div className="code-box">
              <div className="lbl">Room code</div>
              <div className="code-display">{roomCode}</div>
              <div className="code-hint">Share with your opponent</div>
            </div>
            <div>
              <div className="lbl" style={{ marginBottom: "10px" }}>Players</div>
              {playersList.map((p) => (
                <div key={p.id} className="pslot">
                  <div className="dot dot-live" />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {p.id === playerId && <span className="badge badge-you">you</span>}
                  {p.isHost && <span className="badge badge-host">host</span>}
                </div>
              ))}
              {playersList.length < 2 && (
                <div className="pslot" style={{ color: "var(--text3)", fontStyle: "italic" }}>
                  <div className="dot dot-empty" /><span>Waiting for player 2...</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)", letterSpacing: "0.07em" }}>
              {totalRounds} round{totalRounds > 1 ? "s" : ""} · Countdown starts when both players join
            </div>
          </>)}

          {/* COUNTDOWN */}
          {view === "countdown" && (<>
            <div className="rmeta">Round {displayRound} of {roomData?.totalRounds}</div>
            <div style={{ textAlign: "center" }}>
              <div className="lbl" style={{ marginBottom: "8px" }}>Target time</div>
              <div className="target-big">{formatMs(roomData?.targetMs)}</div>
            </div>
            <div className="div" />
            <div className="cd-wrap">
              <div className="lbl">Starting in</div>
              <div className="cd-num" key={countdownVal}>{countdownVal}</div>
            </div>
          </>)}

          {/* PLAYING */}
          {view === "playing" && (<>
            <div style={{ textAlign: "center" }}>
              <div className="lbl" style={{ marginBottom: "6px" }}>Target</div>
              <div style={{ fontFamily: "var(--ff-d)", fontSize: "40px", color: "var(--accent)", letterSpacing: "0.06em", lineHeight: 1 }}>
                {formatMs(roomData?.targetMs)}
              </div>
            </div>
            <div className="div" />
            <div>
              <div className="lbl" style={{ textAlign: "center", marginBottom: "8px" }}>Your stopwatch</div>
              <div className={`sw ${stopped ? "sw-stopped" : "sw-live"}`}>{formatMs(elapsed)}</div>
            </div>
            <button className="btn btn-stop" onClick={handleStop} disabled={stopped}>
              {stopped ? "STOPPED" : "STOP"}
            </button>
            <div className={`opp-bar ${oppStopped ? "done" : "wait"}`}>
              {opponent
                ? oppStopped
                  ? <><span>⬛</span><span>{opponent.name} stopped</span></>
                  : <><span style={{ animation: "blink 1s infinite" }}>●</span><span>{opponent.name} still going</span></>
                : <span>No opponent connected</span>}
            </div>
            <div className="score-row">
              {playersList.map((p) => (
                <span key={p.id} className={p.id === playerId ? "score-me" : ""}>
                  {p.name}: <strong>{p.score || 0}</strong>pt
                </span>
              ))}
            </div>
          </>)}

          {/* ROUND RESULT */}
          {view === "round_result" && (<>
            <div className="rmeta">
              Round {Math.min((roomData?.currentRound || 2) - 1, roomData?.totalRounds || 1)} of {roomData?.totalRounds} · Result
            </div>
            {(() => {
              const iWon = roundWinner?.id === playerId;
              const isTie = !roomData?.winnerId;
              return <div className={`rbanner ${isTie ? "r-tie" : iWon ? "r-win" : "r-lose"}`}>{isTie ? "TIE" : iWon ? "YOU WIN" : "YOU LOSE"}</div>;
            })()}
            <div>
              <div className="lbl" style={{ textAlign: "center", marginBottom: "12px" }}>Target: {formatMs(roomData?.targetMs)}</div>
              {playersList.map((p) => {
                const isWinner = p.id === roomData?.winnerId;
                const diff = p.stoppedMs != null ? diffMs(p.stoppedMs, roomData?.targetMs) : null;
                return (
                  <div key={p.id} className={`rrow ${isWinner ? "winner" : ""}`}>
                    <div>
                      <div className="rname">{p.name}{p.id === playerId ? " (you)" : ""}</div>
                      <div className="rdiff">{diff != null ? `off by ${formatMs(diff)}` : "—"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="rtime">{formatMs(p.stoppedMs)}</div>
                      <div style={{ fontSize: "10px", color: "var(--text3)" }}>{p.score || 0} pts total</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="div" />
            {isHost
              ? <button className="btn btn-primary" onClick={handleNextRound}>Next Round →</button>
              : <div className="hwait">Waiting for host to continue...</div>}
          </>)}

          {/* GAME OVER */}
          {view === "game_over" && (<>
            <div className="rmeta">Game over · {roomData?.totalRounds} rounds</div>
            {(() => {
              const scores = playersList.map((p) => p.score || 0);
              const isTie = scores.length > 1 && scores[0] === scores[1];
              const iWon = !isTie && gameWinner?.id === playerId;
              return <div className={`rbanner ${isTie ? "r-tie" : iWon ? "r-win" : "r-lose"}`}>{isTie ? "IT'S A TIE" : iWon ? "VICTORY" : "DEFEAT"}</div>;
            })()}
            <div>
              <div className="lbl" style={{ marginBottom: "12px" }}>Final scores</div>
              {[...playersList].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.id} className="rrow">
                  <div className="rname">{i === 0 && "🏆 "}{p.name}{p.id === playerId ? " (you)" : ""}</div>
                  <div className="rpts">{p.score || 0}</div>
                </div>
              ))}
            </div>
            <div className="div" />
            {isHost ? (<>
              <div className="field">
                <div className="lbl">Rounds for rematch</div>
                <select className="inp" value={totalRounds} onChange={(e) => setTotalRounds(Number(e.target.value))}>
                  {[1, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n} round{n > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleRematch}>Rematch</button>
            </>) : <div className="hwait">Waiting for host to start rematch...</div>}
            <button className="btn btn-ghost" onClick={handleLeave}>Leave</button>
          </>)}

        </div>
      </div>
    </>
  );
}