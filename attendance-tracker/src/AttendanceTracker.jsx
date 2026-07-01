import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./output.css";

const SUPABASE_URL  = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const BRANCHES = ["Comd Office", "S1", "S2", "S3", "S4", "HQ Coy", "SPP", "MED CELL", "Not assigned yet"];
const ADMIN_USERNAME  = process.env.REACT_APP_ADMIN_USERNAME;
const ADMIN_PASSWORD  = process.env.REACT_APP_ADMIN_PASSWORD;

// All valid ranks
const ALL_RANKS = [
  "PTE","LCP","CPL","CFC","SCT",
  "3SG","2SG","1SG","SSG","MSG",
  "3WO","2WO","1WO","MWO","SWO","CWO",
  "OCT","2LT","LTA","CPT","MAJ","LTC","SLTC","COL","BG","MG","LG",
  "ME1","ME2","ME3","ME4","ME5","ME6","ME7","ME8",
  "DX1","DX2","DX3","DX4","DX5","DX6","DX7","DX8","DX9","DX10","DX11","DX12","DX13","DX14","DX15",
];

// Classification helpers
const COMMANDER_RANKS   = new Set(["SCT","3SG","2SG","1SG","SSG","MSG","3WO","2WO","1WO","MWO","SWO","CWO","OCT","2LT","LTA","CPT","MAJ","LTC","SLTC","COL","BG","MG","LG"]);
const SUPPORT_RANKS     = new Set(["PTE","LCP","CPL","CFC"]);
const OFFICER_RANKS     = new Set(["OCT","2LT","LTA","CPT","MAJ","LTC","SLTC","COL","BG","MG","LG"]);
const DXO_RANKS         = new Set(["DX1","DX2","DX3","DX4","DX5","DX6","DX7","DX8","DX9","DX10","DX11","DX12","DX13","DX14","DX15"]);

const isOfficer       = p => (p.role||"wose") === "officer" || OFFICER_RANKS.has(p.rank);
const isCommander     = p => COMMANDER_RANKS.has(p.rank);
const isSupportStaff  = p => (p.role||"wose") === "wose" && SUPPORT_RANKS.has(p.rank);
const isDXO           = p => DXO_RANKS.has(p.rank);
const isPresent       = (p, statuses) => { const s = statuses[p.id]||"pending"; return s==="in"}; // || s === "late" || s === "duty"; };   <- uncomment this to let late and duty to become present instead of being absent. 

// Animated Portal Select 
const AnimatedSelect = ({ options, value, onChange, placeholder = "Select...", customStyles = "" }) => {
  const [isOpen, setIsOpen]       = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef    = useRef(null);
  const selected   = options.find(o => o.value === value);

  const openMenu = () => {
    const r = triggerRef.current.getBoundingClientRect();
    setMenuStyle({ position:"fixed", top: r.bottom+4, left: r.left, width: Math.max(r.width, 160), zIndex:99999 });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const out = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          menuRef.current   && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    const repos = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuStyle(p => ({ ...p, top: r.bottom+4, left: r.left, width: Math.max(r.width, 160) }));
    };
    document.addEventListener("mousedown", out);
    window.addEventListener("scroll", repos, true);
    window.addEventListener("resize", repos);
    return () => {
      document.removeEventListener("mousedown", out);
      window.removeEventListener("scroll", repos, true);
      window.removeEventListener("resize", repos);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full">
      <div ref={triggerRef} onClick={() => isOpen ? setIsOpen(false) : openMenu()}
        className={`w-full px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg cursor-pointer flex justify-between items-center hover:bg-white/10 transition-all duration-200 ${customStyles}`}>
        <span className="text-sm truncate">{selected ? selected.label : placeholder}</span>
        <motion.svg animate={{ rotate: isOpen ? 180 : 0 }} className="w-3 h-3 text-blue-400 shrink-0 ml-2"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </div>
      {isOpen && createPortal(
        <AnimatePresence>
          <motion.ul ref={menuRef} style={{ ...menuStyle, maxHeight:320, overflowY:"auto" }}
            initial={{ opacity:0, y:-6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-6, scale:0.97 }} transition={{ duration:0.15, ease:"easeOut" }}
            className="bg-[#0a1a3a] backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-2xl"
            >
            {options.map((opt, i) => (
              <motion.li key={opt.value} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                transition={{ delay: Math.min(i*0.02, 0.3) }}
                onMouseDown={e => { e.preventDefault(); onChange(opt.value); setIsOpen(false); }}
                className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${value===opt.value ? "bg-blue-600/40 text-white" : "text-gray-300 hover:bg-white/10"}`}>
                {opt.label}
              </motion.li>
            ))}
          </motion.ul>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

// Live Clock 
const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const ss = String(now.getSeconds()).padStart(2,"0");
  return (
    <div className="text-center mb-5">
      <div className="text-3xl md:text-4xl font-mono font-bold tracking-widest text-white"
        style={{ textShadow:"0 0 24px rgba(96,165,250,0.55)" }}>
        {hh}<span className="animate-pulse text-blue-400">:</span>
        {mm}<span className="animate-pulse text-blue-400">:</span>{ss}
      </div>
      <div className="text-xs tracking-[0.25em] uppercase text-slate-400 mt-1">
        {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
      </div>
    </div>
  );
};

// Admin Login Modal
const LoginModal = ({ onLogin, onClose }) => {
  const [user, setUser]   = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [shake, setShake] = useState(false);
  const attempt = () => {
    if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) { onLogin(); }
    else { setErr("Invalid credentials."); setShake(true); setTimeout(() => setShake(false), 500); }
  };
  return createPortal(
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale:0.9, y:20 }}
        animate={shake ? { x:[-8,8,-6,6,0] } : { scale:1, y:0 }}
        transition={shake ? { duration:0.4 } : { type:"spring", stiffness:260, damping:20 }}
        className="bg-[#060f28] border border-blue-500/20 p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-xl">🔐</div>
          <h2 className="text-lg font-bold tracking-widest uppercase text-white">Admin Login</h2>
          <p className="text-xs text-slate-500 mt-1 tracking-wider">Supervisor access required</p>
        </div>
        <div className="space-y-3">
          <input className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
            placeholder="Username" value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} autoFocus />
          <input type="password" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
            placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} />
          {err && <p className="text-xs text-red-400 text-center tracking-wide">{err}</p>}
          <button onClick={attempt} className="w-full mt-2 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg font-bold uppercase text-xs tracking-widest transition-all text-white">Authenticate</button>
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-white/5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-white/10 transition-all">Cancel</button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

// Supabase helper 
async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey:SUPABASE_ANON_KEY, Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
               "Content-Type":"application/json", Prefer:"return=representation" },
    ...options,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  return res.json();
}

// Today's date key (SGT YYYY-MM-DD) used for daily status reset 
function todaySGT() {
  const now = new Date();
  const sg  = new Date(now.getTime() + now.getTimezoneOffset()*60000 + 8*3600000);
  return `${sg.getFullYear()}-${String(sg.getMonth()+1).padStart(2,"0")}-${String(sg.getDate()).padStart(2,"0")}`;
}

// Status options 
const STATUS_OPTIONS = [
  { value:"pending", label:"— Haven't selected yet today —", color:"bg-white/5",       glow:""                                                                   },
  { value:"in",     label:"✅ In",                           color:"bg-emerald-500/20", glow:"shadow-[0_0_12px_rgba(52,211,153,0.4)]"  },
  { value:"late",   label:"🕐 Late",                         color:"bg-amber-500/20",   glow:"shadow-[0_0_12px_rgba(251,191,36,0.4)]"  },
  { value:"duty",   label:"🚨 On Duty",                      color:"bg-orange-500/20",  glow:"shadow-[0_0_12px_rgba(249,115,22,0.4)]"  },
  { value:"course", label:"👨‍🎓 On Course until...",          color:"bg-sky-500/20",     glow:"shadow-[0_0_12px_rgba(14,165,233,0.4)]"  },
  { value:"rso",    label:"📋 RSO / RSI until...",           color:"bg-violet-500/20",  glow:"shadow-[0_0_12px_rgba(139,92,246,0.4)]"  },
  { value:"mc",     label:"🏥 MC until...",                   color:"bg-red-500/20",     glow:"shadow-[0_0_12px_rgba(239,68,68,0.4)]"   },
  { value:"others", label:"📝 Others",                        color:"bg-slate-500/20",   glow:"shadow-[0_0_12px_rgba(100,116,139,0.4)]" },
];

// Date helpers
function fmtDateDDMMYY(d) {
  if (!d) return "??";
  const [y, m, day] = d.split("-");
  return `${day}${m}${y.slice(2)}`;
}
function fmtDateSlash(d) {
  if (!d) return "??";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function daysBetween(startISO, endISO) {
  if (!startISO || !endISO) return null;
  const s = new Date(startISO), e = new Date(endISO);
  return Math.round((e - s) / 86400000) + 1;
}

// Summary 
function generateSummary(personnel, statuses, mcDates, rsoDates, courseDates, courseStartDates, courseNames, statusTexts, permTypes, othersNotes) {
  const now  = new Date();
  const sg   = new Date(now.getTime() + now.getTimezoneOffset()*60000 + 8*3600000);
  const dd   = String(sg.getDate()).padStart(2,"0");
  const mo   = String(sg.getMonth()+1).padStart(2,"0");
  const yy   = String(sg.getFullYear()).slice(2);
  const hh   = String(sg.getHours()).padStart(2,"0");
  const mi   = String(sg.getMinutes()).padStart(2,"0");

  const pres     = p => isPresent(p, statuses);
  const total    = personnel.length;
  const presTotal= personnel.filter(pres).length;

  const officers      = personnel.filter(p => isOfficer(p));
  const woses         = personnel.filter(p => !isOfficer(p));
  const commanders    = personnel.filter(p => isCommander(p));
  const supportStaff  = personnel.filter(p => isSupportStaff(p));
  const dxo           = personnel.filter(p => isDXO(p));

  const lines = [];
  lines.push(`HQ COY PARADE STRENGTH CAA ${dd}${mo}${yy} ${hh}${mi}HRS\n`);
  lines.push(`Grand Total: ${presTotal}/${total}`);
  lines.push(`Total Officer: ${officers.filter(pres).length}/${officers.length}`);
  lines.push(`Total WOSE: ${woses.filter(pres).length}/${woses.length}\n`);
  lines.push(`Total Commander: ${commanders.filter(pres).length}/${commanders.length}`);
  lines.push(`Total WOSE (PTE,LCP,CPL,CFC): ${supportStaff.filter(pres).length}/${supportStaff.length}\n`);
  lines.push(`Personnel on DB/AWOL/CC/CA: 0`);
  lines.push("-------------------------------");

  BRANCHES.forEach(branch => {
    const members = personnel.filter(p => (p.branch||"Not assigned yet") === branch);
    if (!members.length) return;
    const brOfficers = members.filter(p => isOfficer(p));
    const brWoses    = members.filter(p => !isOfficer(p));
    const brCmdr     = members.filter(p => isCommander(p));
    const brSupport  = members.filter(p => isSupportStaff(p));
    const brDxos     = members.filter(p => isDXO(p));

    lines.push(branch.toUpperCase());
    lines.push(`TOTAL STRENGTH: ${members.filter(pres).length}/${members.length}\n`);
    if (brOfficers.length) {
      lines.push(`OFFICER: ${brOfficers.filter(pres).length}/${brOfficers.length}`);
      brOfficers.forEach((p,i) => lines.push(`${i+1}. ${p.rank} ${p.name}${pres(p)?"✅":"❌"}`));
    }
    if (brWoses.length) {
      lines.push(`\nWOSE: ${brWoses.filter(pres).length}/${brWoses.length}`);
      brWoses.forEach((p,i) => lines.push(`${i+1}. ${p.rank} ${p.name}${pres(p)?"✅":"❌"}`));
    }

    lines.push(`\nCommander: ${brCmdr.filter(pres).length}/${brCmdr.length}`);
    lines.push(`WOSE (PTE,LCP,CPL,CFC): ${brSupport.filter(pres).length}/${brSupport.length}\n`);
    lines.push("-------------------------------");
  });

  // MC
  const mcList = personnel.filter(p => (statuses[p.id]||"in")==="mc");
  lines.push(`😷MC: ${String(mcList.length).padStart(2,"0")}`);
  mcList.forEach((p,i) => {
    const note = statusTexts[p.id]||"";
    const end  = mcDates[p.id] ? `until ${fmtDateDDMMYY(mcDates[p.id])}` : "";
    lines.push(`${i+1}. ${p.rank} ${p.name} (${[end,note].filter(Boolean).join(", ")})\n`);
  });

  // RSO/RSI
  const rsoList = personnel.filter(p => (statuses[p.id]||"in")==="rso");
  if (rsoList.length) {
    lines.push(`📋RSO/RSI: ${String(rsoList.length).padStart(2,"0")}`);
    rsoList.forEach((p,i) => {
      const note = statusTexts[p.id]||"";
      const end  = rsoDates[p.id] ? `until ${fmtDateDDMMYY(rsoDates[p.id])}` : "";
      lines.push(`${i+1}. ${p.rank} ${p.name} (${[end,note].filter(Boolean).join(", ")})\n`);
    });
  }

  // On Course — format: PTE BRENDON (4 days, 06/03/2026-09/03/2026, ASCC)
  const courseList = personnel.filter(p => (statuses[p.id]||"in")==="course");
  if (courseList.length) {
    lines.push(`👨‍🎓ON COURSE: ${String(courseList.length).padStart(2,"0")}`);
    courseList.forEach((p,i) => {
      const start   = courseStartDates[p.id]||"";
      const end     = courseDates[p.id]||"";
      const cname   = courseNames[p.id]||"";
      const days    = daysBetween(start, end);
      const range   = (start && end) ? `${fmtDateSlash(start)}-${fmtDateSlash(end)}` : "";
      const parts   = [days ? `${days} days` : "", range, cname].filter(Boolean);
      lines.push(`${i+1}. ${p.rank} ${p.name}${parts.length ? ` (${parts.join(", ")})` : ""}\n`);
    });
  }

  // On Duty
  const dutyList = personnel.filter(p => (statuses[p.id]||"in")==="duty");
  if (dutyList.length) {
    lines.push(`🚨ON DUTY: ${String(dutyList.length).padStart(2,"0")}`);
    dutyList.forEach((p,i) => {
      const note = statusTexts[p.id]||"";
      lines.push(`${i+1}. ${p.rank} ${p.name}${note ? ` (${note})` : ""}\n`);
    });
  }

  // Late
  const lateList = personnel.filter(p => (statuses[p.id]||"in")==="late");
  if (lateList.length) {
    lines.push(`🕐LATE: ${String(lateList.length).padStart(2,"0")}`);
    lateList.forEach((p,i) => {
      const note = statusTexts[p.id]||"";
      lines.push(`${i+1}. ${p.rank} ${p.name}${note ? ` (${note})` : ""}`);
    });
  }

  // Others
  const othersList = personnel.filter(p => (statuses[p.id]||"in")==="others");
  if (othersList.length) {
    lines.push(`📝OTHERS: ${String(othersList.length).padStart(2,"0")}`);
    othersList.forEach((p,i) => {
      const desc = othersNotes[p.id]||statusTexts[p.id]||"-";
      lines.push(`${i+1}. ${p.rank} ${p.name} (${desc})`);
    });
  }

  // STATUS
  const permList = personnel.filter(p => permTypes[p.id]==="permanent");
  const tempList = personnel.filter(p => permTypes[p.id]==="temporary");
  const totalStatus = permList.length + tempList.length;
  if (totalStatus > 0) {
    lines.push(`🚷STATUS: ${totalStatus}`);
    if (permList.length) {
      lines.push(`Permanent: ${String(permList.length).padStart(2,"0")}`);
      permList.forEach((p,i) => {
        const txt = statusTexts[p.id]||"";
        lines.push(`${i+1}. ${p.rank} ${p.name}${txt ? ` (${txt})` : ""}`);
      });
    }
    if (tempList.length) {
      lines.push(`Temporary: ${String(tempList.length).padStart(2,"0")}`);
      tempList.forEach((p,i) => {
        const txt = statusTexts[p.id]||"";
        lines.push(`${i+1}. ${p.rank} ${p.name}${txt ? ` (${txt})` : ""}`);
      });
    }
  }

  return lines.join("\n");
}

// Personnel Card 
function PersonnelCard({ p, isAdmin, status, mcDate, rsoDate, courseDate, courseStartDate, courseName,
  statusText, permType, othersNote,
  onStatusChange, onMcDate, onRsoDate, onCourseDate, onCourseStartDate, onCourseName,
  onStatusText, onPermType, onOthersNote, onDelete,
  dragHandleProps,
  onEditSave,
}) {

  const [editing,   setEditing]   = useState(false);
  const [editRank,  setEditRank]  = useState(p.rank);
  const [editName,  setEditName]  = useState(p.name);

  const cur = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
  const hasBadge = statusText || (status==="others" && othersNote);

  function saveEdit() {
    if (!editName.trim()) return;
    onEditSave(p.id, editRank, editName.trim());
    setEditing(false);
  }

  return (
    <div className={`relative rounded-xl border border-white/5 bg-white/3 backdrop-blur-sm transition-all hover:border-white/15 ${cur.glow}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4 p-4">

        {/* Identity */}
        <div className="flex items-center gap-3 pt-0.5">
          {/* Drag handle — admin only */}
          {isAdmin && (
            <div {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 shrink-0 px-0.5 select-none"
              title="Drag to reorder">
              ⠿
            </div>
          )}

          {editing ? (
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <AnimatedSelect
                options={ALL_RANKS.map(r => ({ value:r, label:r }))}
                value={editRank}
                onChange={setEditRank}
                placeholder="Rank"
                customStyles="!w-24 text-xs"
              />
              <input
                className="flex-1 min-w-24 bg-black/20 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") setEditing(false); }}
                autoFocus
              />
              <button onClick={saveEdit} className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase">Save</button>
              <button onClick={() => setEditing(false)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase">Cancel</button>
            </div>
          ) : (
            <>
              <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase shrink-0">{p.rank}</span>
              <span className="text-base font-medium tracking-tight text-slate-100">{p.name}</span>
              {isAdmin && (
                <button onClick={() => { setEditRank(p.rank); setEditName(p.name); setEditing(true); }}
                  className="ml-1 p-1 rounded text-slate-600 hover:text-blue-400 transition-colors shrink-0 text-xs" title="Edit rank / name">
                  ✏️
                </button>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">

          {/* Dropdown + date pickers */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-35">
              <AnimatedSelect options={STATUS_OPTIONS} value={status} onChange={v => onStatusChange(p.id, v)} customStyles={cur.color} />
            </div>
            {status==="mc"     && <input type="date" className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-2 text-xs text-red-300 outline-none shrink-0"     value={mcDate||""}          onChange={e=>onMcDate(p.id,e.target.value)} />}
            {status==="rso"    && <input type="date" className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-2 text-xs text-violet-300 outline-none shrink-0" value={rsoDate||""}     onChange={e=>onRsoDate(p.id,e.target.value)} />}
            {isAdmin && <button onClick={()=>onDelete(p.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0">✕</button>}
          </div>

          {/* Course fields: start date, end date, course name */}
          {status==="course" && (
            <div className="flex flex-col gap-1.5 pl-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 w-16">Start</span>
                <input type="date" className="flex-1 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1.5 text-xs text-sky-300 outline-none"
                  value={courseStartDate||""} onChange={e=>onCourseStartDate(p.id,e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 w-16">End</span>
                <input type="date" className="flex-1 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1.5 text-xs text-sky-300 outline-none"
                  value={courseDate||""} onChange={e=>onCourseDate(p.id,e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 w-16">Course</span>
                <input type="text" placeholder="e.g. ASCC, BTC..." className="flex-1 bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-1.5 text-xs text-sky-200 placeholder-sky-900 outline-none focus:border-sky-400/50"
                  value={courseName||""} onChange={e=>onCourseName(p.id,e.target.value)} />
              </div>
            </div>
          )}

          {/* Others description */}
          {status==="others" && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 w-12 pt-2">Desc</span>
              <textarea rows={2} placeholder="Describe the situation..."
                value={othersNote} onChange={e=>onOthersNote(p.id,e.target.value)}
                className="flex-1 bg-slate-500/10 border border-slate-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-slate-400/40 transition-all resize-none" />
            </div>
          )}

          {/* Status text + Permanent/Temporary */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 shrink-0 w-12">Status</span>
              <div className="relative flex-1">
                <input type="text" placeholder="e.g. EX. FLEGS; LD 84 days 021225-230226"
                  value={statusText} onChange={e=>onStatusText(p.id,e.target.value)}
                  className="w-full bg-white/3 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/30 focus:bg-white/5 transition-all pr-7" />
                {statusText && (
                  <button onMouseDown={e=>{e.preventDefault();onStatusText(p.id,"");}}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 text-[10px]">✕</button>
                )}
              </div>
              {statusText && (
                <div className="flex gap-1 shrink-0">
                  {["permanent","temporary"].map(opt => (
                    <button key={opt} onMouseDown={e=>{e.preventDefault();onPermType(p.id,permType===opt?"":opt);}}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all border ${
                        permType===opt
                          ? opt==="permanent" ? "bg-amber-500/30 border-amber-400/40 text-amber-300" : "bg-sky-500/30 border-sky-400/40 text-sky-300"
                          : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                      }`}>
                      {opt==="permanent" ? "Perm" : "Temp"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {statusText && permType && (
              <div className="pl-14">
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                  permType==="permanent" ? "bg-amber-500/15 border-amber-400/30 text-amber-300" : "bg-sky-500/15 border-sky-400/30 text-sky-300"
                }`}>
                  {permType==="permanent" ? "🔒 Permanent" : "⏳ Temporary"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasBadge && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 -mt-1">
          {statusText && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/5 border border-white/10 rounded-md px-2.5 py-1">
              <span className="text-yellow-400/80">🚷</span> {statusText}
              {permType && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${permType==="permanent"?"bg-amber-500/20 text-amber-300":"bg-sky-500/20 text-sky-300"}`}>{permType}</span>}
            </span>
          )}
          {status==="others" && othersNote && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-500/10 border border-slate-500/20 rounded-md px-2.5 py-1">
              <span className="text-slate-400">ℹ️</span> {othersNote}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Main Component 
export default function AttendanceTracker() {
  const [personnel,        setPersonnel]        = useState([]);
  const [statuses,         setStatuses]         = useState({});
  const [mcDates,          setMcDates]          = useState({});
  const [rsoDates,         setRsoDates]         = useState({});
  const [courseDates,      setCourseDates]      = useState({});
  const [courseStartDates, setCourseStartDates] = useState({});
  const [courseNames,      setCourseNames]      = useState({});
  const [statusTexts,      setStatusTexts]      = useState({});
  const [permTypes,        setPermTypes]        = useState({});
  const [othersNotes,      setOthersNotes]      = useState({});
  const [loading,          setLoading]          = useState(true);

  const [isAdmin,    setIsAdmin]    = useState(false);
  const [showLogin,  setShowLogin]  = useState(false);
  const [showAdmin,  setShowAdmin]  = useState(false);

  // drag state
  const dragItem    = useRef(null);
  const dragOverItem= useRef(null);

  // add-form state
  const [newRank,   setNewRank]   = useState("PTE");
  const [newName,   setNewName]   = useState("");
  const [newBranch, setNewBranch] = useState("Not assigned yet");
  const [newRole,   setNewRole]   = useState("wose");
  const [adding,    setAdding]    = useState(false);
  const [deleteId,  setDeleteId]  = useState(null);

  // fetch 
  async function fetchPersonnel() {
    try {
      const data = await supabaseFetch("personnel?select=*&order=sort_order.asc,created_at.asc");
      setPersonnel(data);
      const iS={},iM={},iR={},iC={},iCS={},iCN={},iT={},iP={},iO={};
      data.forEach(p => {
        iS[p.id]  = p.status              || "pending";
        iM[p.id]  = p.mc_end_date         || "";
        iR[p.id]  = p.rso_end_date        || "";
        iC[p.id]  = p.course_end_date     || "";
        iCS[p.id] = p.course_start_date   || "";
        iCN[p.id] = p.course_name         || "";
        iT[p.id]  = p.status_text         || "";
        iP[p.id]  = p.perm_type           || "";
        iO[p.id]  = p.others_note         || "";
      });
      setStatuses(iS); setMcDates(iM); setRsoDates(iR); setCourseDates(iC);
      setCourseStartDates(iCS); setCourseNames(iCN);
      setStatusTexts(iT); setPermTypes(iP); setOthersNotes(iO);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchPersonnel(); }, []);

  const grouped = BRANCHES.reduce((acc, b) => {
    acc[b] = personnel.filter(p => (p.branch||"Not assigned yet") === b);
    return acc;
  }, {});

  //  patch helper 
  const patch = async (id, body) => {
    try { await supabaseFetch(`personnel?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(body) }); }
    catch(e) { console.error(e); }
  };

  const hStatusChange    = (id,v) => { setStatuses(p=>({...p,[id]:v}));           patch(id,{status:v}); };
  const hMcDate          = (id,v) => { setMcDates(p=>({...p,[id]:v}));             patch(id,{mc_end_date:v}); };
  const hRsoDate         = (id,v) => { setRsoDates(p=>({...p,[id]:v}));            patch(id,{rso_end_date:v}); };
  const hCourseDate      = (id,v) => { setCourseDates(p=>({...p,[id]:v}));         patch(id,{course_end_date:v}); };
  const hCourseStartDate = (id,v) => { setCourseStartDates(p=>({...p,[id]:v}));    patch(id,{course_start_date:v}); };
  const hCourseName      = (id,v) => { setCourseNames(p=>({...p,[id]:v}));         patch(id,{course_name:v}); };
  const hStatusText      = (id,v) => { setStatusTexts(p=>({...p,[id]:v}));         patch(id,{status_text:v}); };
  const hPermType        = (id,v) => { setPermTypes(p=>({...p,[id]:v}));           patch(id,{perm_type:v}); };
  const hOthersNote      = (id,v) => { setOthersNotes(p=>({...p,[id]:v}));         patch(id,{others_note:v}); };

  async function handleAddPersonnel() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const data = await supabaseFetch("personnel", {
        method:"POST",
        body: JSON.stringify({ rank:newRank, name:newName.trim(), branch:newBranch, role:newRole, status:"pending" }),
      });
      const np = data[0];
      setPersonnel(prev => [...prev, np]);
      ["statuses","statusTexts","permTypes","othersNotes"].forEach(() => {});
      setStatuses(p=>({...p,[np.id]:"pending"})); setStatusTexts(p=>({...p,[np.id]:""}));
      setPermTypes(p=>({...p,[np.id]:""}));  setOthersNotes(p=>({...p,[np.id]:""}));
      setCourseNames(p=>({...p,[np.id]:""})); setCourseStartDates(p=>({...p,[np.id]:""}));
      setNewName(""); setNewRank("PTE"); setNewRole("wose");
    } catch(e) { alert("Error adding personnel."); }
    finally { setAdding(false); }
  }

  async function handleDelete(id) {
    try { await supabaseFetch(`personnel?id=eq.${id}`,{method:"DELETE"}); setPersonnel(prev=>prev.filter(p=>p.id!==id)); }
    catch(e) { console.error(e); }
    setDeleteId(null);
  }

  // Midnight daily reset (statuses → "pending")
  useEffect(() => {
    // Check once on load: if stored date ≠ today, reset all statuses to "pending"
    const stored = localStorage.getItem("attendance_date");
    const today  = todaySGT();
    if (stored && stored !== today) {
      // Reset all in-memory statuses to pending
      setStatuses(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => { next[id] = "pending"; });
        return next;
      });
      // Batch-reset in Supabase — update all personnel status to pending
      supabaseFetch("personnel?status=neq.pending", {
        method: "PATCH",
        body: JSON.stringify({ status: "pending" }),
      }).catch(console.error);
    }
    localStorage.setItem("attendance_date", today);

    // Schedule a timer for exactly midnight SGT
    function scheduleReset() {
      const now  = new Date();
      const sg   = new Date(now.getTime() + now.getTimezoneOffset()*60000 + 8*3600000);
      const msUntilMidnight = (
        (23 - sg.getHours()) * 3600000 +
        (59 - sg.getMinutes()) * 60000 +
        (60 - sg.getSeconds()) * 1000
      );
      return setTimeout(() => {
        setStatuses(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(id => { next[id] = "pending"; });
          return next;
        });
        supabaseFetch("personnel", {
          method: "PATCH",
          body: JSON.stringify({ status: "pending" }),
        }).catch(console.error);
        localStorage.setItem("attendance_date", todaySGT());
        scheduleReset(); // reschedule for next midnight
      }, msUntilMidnight);
    }
    const t = scheduleReset();
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inline edit (rank + name) 
  async function handleEditSave(id, rank, name) {
    setPersonnel(prev => prev.map(p => p.id===id ? { ...p, rank, name } : p));
    try { await supabaseFetch(`personnel?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ rank, name }) }); }
    catch(e) { console.error(e); }
  }

  // Drag-to-reorder (within same role-group within same branch)
  function handleDragStart(id, groupKey) {
    dragItem.current = { id, groupKey };
  }
  function handleDragEnter(id, groupKey) {
    dragOverItem.current = { id, groupKey };
  }
  function handleDragEnd() {
    const from = dragItem.current;
    const to   = dragOverItem.current;
    if (!from || !to || from.id === to.id || from.groupKey !== to.groupKey) {
      dragItem.current = null; dragOverItem.current = null; return;
    }
    setPersonnel(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(p => p.id === from.id);
      const toIdx   = next.findIndex(p => p.id === to.id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      // Persist sort order: assign sequential sort_order within the new array
      const updates = next.map((p, i) => ({ id: p.id, sort_order: i }));
      updates.forEach(({ id, sort_order }) => {
        supabaseFetch(`personnel?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ sort_order }) }).catch(console.error);
      });
      return next;
    });
    dragItem.current = null; dragOverItem.current = null;
  }

  // extract 
  function handleExtract() {
    const txt   = generateSummary(personnel, statuses, mcDates, rsoDates, courseDates, courseStartDates, courseNames, statusTexts, permTypes, othersNotes);
    const now   = new Date();
    const sg    = new Date(now.getTime() + now.getTimezoneOffset()*60000 + 8*3600000);
    const fname = `CAA_${String(sg.getDate()).padStart(2,"0")}${String(sg.getMonth()+1).padStart(2,"0")}${String(sg.getFullYear()).slice(2)}_${String(sg.getHours()).padStart(2,"0")}${String(sg.getMinutes()).padStart(2,"0")}.txt`;
    const blob  = new Blob([txt], {type:"text/plain;charset=utf-8"});
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href=url; a.download=fname; a.click(); URL.revokeObjectURL(url);
  }

  // stats 
  const presCount   = personnel.filter(p => isPresent(p, statuses)).length;
  const absentCount = personnel.length - presCount;

  // For the stat pills we also want Officer/WOSE totals
  const allOfficers = personnel.filter(p => isOfficer(p));
  const allWoses    = personnel.filter(p => !isOfficer(p));

  // render 
  return (
    <div className="min-h-screen bg-[#050d1a] text-slate-200 font-sans pb-20 overflow-x-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(0,80,160,0.5)_0%,transparent_55%)]" />
      {/* <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_90%_90%,rgba(0,110,255,0.2)_0%,transparent_60%)]" /> */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_90%_10%,rgba(255,220,80,0.25)_0%,rgba(255,220,80,0.12)_0.1%,transparent_90%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">

        {/* ── Top bar ── */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={handleExtract}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold tracking-widest uppercase hover:bg-emerald-500/20 transition-all">
            📄 Extraction
          </button>
          {isAdmin ? (
            <button onClick={() => { setIsAdmin(false); setShowAdmin(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase hover:bg-emerald-500/20 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{boxShadow:"0 0 6px rgba(52,211,153,0.8)"}} />
              Admin — Logout
            </button>
          ) : (
            <button onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400/70 text-xs font-bold tracking-widest uppercase hover:bg-blue-500/10 transition-all">
              🔐 Admin Login
            </button>
          )}
        </div>

        {/*  Header  */}
        <header className="text-center mb-10">
          <LiveClock />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-linear-to-br from-white to-blue-400 bg-clip-text text-transparent uppercase">
            ATTENDANCE
          </h1>
          <p className="mt-2 text-slate-500 text-sm tracking-[0.2em] uppercase">Status Tracker</p>
        </header>

        {/*  Stats pills  */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            { label:`${presCount} Present`,              dot:"bg-emerald-400", sh:"rgba(52,211,153,0.6)"  },
            { label:`${absentCount} Absent`,              dot:"bg-red-400",     sh:"rgba(248,113,113,0.6)" },
            { label:`${personnel.length} Total`,          dot:"bg-blue-400",    sh:"rgba(59,130,246,0.6)"  },
            { label:`${allOfficers.filter(p=>isPresent(p,statuses)).length}/${allOfficers.length} Officer`, dot:"bg-yellow-400", sh:"rgba(250,204,21,0.6)" },
            { label:`${allWoses.filter(p=>isPresent(p,statuses)).length}/${allWoses.length} WOSE`,          dot:"bg-indigo-400", sh:"rgba(129,140,248,0.6)" },
          ].map(({ label, dot, sh }) => (
            <div key={label} className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <div className={`w-2 h-2 rounded-full ${dot}`} style={{ boxShadow:`0 0 8px ${sh}` }} />
              <span className="text-xs font-semibold tracking-wide">{label}</span>
            </div>
          ))}
        </div>

        {/*  Admin add panel  */}
        {isAdmin && (
          <div className="flex justify-end mb-6">
            <button onClick={() => setShowAdmin(!showAdmin)}
              className="px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all text-xs font-bold tracking-widest uppercase text-blue-300">
              {showAdmin ? "✕ Close Panel" : "⊕ Add Personnel"}
            </button>
          </div>
        )}

        <AnimatePresence>
          {isAdmin && showAdmin && (
            <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              className="relative z-50 mb-8 p-6 rounded-xl bg-blue-900/20 border border-blue-500/20 backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400/60 mb-4">Add New Personnel</p>

              {/* Row 1: Rank dropdown + Name */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <AnimatedSelect
                  options={ALL_RANKS.map(r => ({ value:r, label:r }))}
                  value={newRank}
                  onChange={setNewRank}
                  placeholder="Select Rank"
                />
                <input className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-blue-500/50 text-sm"
                  placeholder="Full Name" value={newName} onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleAddPersonnel()} />
              </div>

              {/* Row 2: Branch + Role */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <AnimatedSelect options={BRANCHES.map(b=>({value:b,label:b}))} value={newBranch}
                  onChange={setNewBranch} placeholder="Select Branch" />
                <div className="flex gap-2">
                  {[{v:"wose", label:"WOSE"},{v:"officer", label:"Officer"}].map(opt => (
                    <button key={opt.v} onClick={() => setNewRole(opt.v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                        newRole===opt.v
                          ? opt.v==="officer" ? "bg-yellow-500/25 border-yellow-400/40 text-yellow-300" : "bg-blue-500/25 border-blue-400/40 text-blue-300"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleAddPersonnel} disabled={adding||!newName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-40">
                {adding ? "Adding..." : `Add ${newRank} ${newName||"…"} to ${newBranch} as ${newRole==="officer"?"Officer":"WOSE"}`}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/*  Personnel list  */}
        <div className="space-y-10">
          {loading ? (
            <div className="text-center py-20 animate-pulse text-slate-500 uppercase tracking-widest text-xs">Loading Directory...</div>
          ) : (
            BRANCHES.map(branch => {
              const members  = grouped[branch];
              if (!members?.length) return null;

              const officers = members.filter(p => isOfficer(p));
              const woses    = members.filter(p => !isOfficer(p));

              return (
                <div key={branch} className="space-y-5">
                  {/* Branch heading */}
                  <h2 className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.4em] text-blue-400/60">
                    <span>{branch}</span>
                    <div className="h-px w-full bg-linear-to-r from-blue-500/30 to-transparent" />
                    <span className="shrink-0 text-blue-400/40">
                      {members.filter(p=>isPresent(p,statuses)).length}/{members.length}
                    </span>
                  </h2>

                  {/* Officer sub-section */}
                  {officers.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-400/60">
                        <span className="text-yellow-400/80"></span>
                        <span>Officer</span>
                        <div className="h-px flex-1 bg-linear-to-r from-yellow-500/20 to-transparent" />
                        <span className="text-yellow-400/40 shrink-0">{officers.filter(p=>isPresent(p,statuses)).length}/{officers.length}</span>
                      </h3>
                      <div className="grid gap-3 pl-4 border-l border-yellow-500/10">
                        {officers.map(p => (
                          <div key={p.id}
                            draggable={isAdmin}
                            onDragStart={() => handleDragStart(p.id, `${branch}-officer`)}
                            onDragEnter={() => handleDragEnter(p.id, `${branch}-officer`)}
                            onDragEnd={handleDragEnd}
                            onDragOver={e => e.preventDefault()}
                            style={isAdmin ? { cursor:"grab" } : {}}>
                            <PersonnelCard p={p} isAdmin={isAdmin}
                              status={statuses[p.id]||"pending"} mcDate={mcDates[p.id]||""} rsoDate={rsoDates[p.id]||""}
                              courseDate={courseDates[p.id]||""} courseStartDate={courseStartDates[p.id]||""}
                              courseName={courseNames[p.id]||""} statusText={statusTexts[p.id]||""}
                              permType={permTypes[p.id]||""} othersNote={othersNotes[p.id]||""}
                              onStatusChange={hStatusChange} onMcDate={hMcDate} onRsoDate={hRsoDate}
                              onCourseDate={hCourseDate} onCourseStartDate={hCourseStartDate} onCourseName={hCourseName}
                              onStatusText={hStatusText} onPermType={hPermType} onOthersNote={hOthersNote}
                              onDelete={id=>setDeleteId(id)}
                              dragHandleProps={{}}
                              onEditSave={handleEditSave} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WOSE sub-section */}
                  {woses.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-blue-400/50">
                        <span className="text-blue-400/70"></span>
                        <span>WOSE</span>
                        <div className="h-px flex-1 bg-linear-to-r from-blue-500/20 to-transparent" />
                        <span className="text-blue-400/40 shrink-0">{woses.filter(p=>isPresent(p,statuses)).length}/{woses.length}</span>
                      </h3>
                      <div className="grid gap-3 pl-4 border-l border-blue-500/10">
                        {woses.map(p => (
                          <div key={p.id}
                            draggable={isAdmin}
                            onDragStart={() => handleDragStart(p.id, `${branch}-wose`)}
                            onDragEnter={() => handleDragEnter(p.id, `${branch}-wose`)}
                            onDragEnd={handleDragEnd}
                            onDragOver={e => e.preventDefault()}
                            style={isAdmin ? { cursor:"grab" } : {}}>
                            <PersonnelCard p={p} isAdmin={isAdmin}
                              status={statuses[p.id]||"pending"} mcDate={mcDates[p.id]||""} rsoDate={rsoDates[p.id]||""}
                              courseDate={courseDates[p.id]||""} courseStartDate={courseStartDates[p.id]||""}
                              courseName={courseNames[p.id]||""} statusText={statusTexts[p.id]||""}
                              permType={permTypes[p.id]||""} othersNote={othersNotes[p.id]||""}
                              onStatusChange={hStatusChange} onMcDate={hMcDate} onRsoDate={hRsoDate}
                              onCourseDate={hCourseDate} onCourseStartDate={hCourseStartDate} onCourseName={hCourseName}
                              onStatusText={hStatusText} onPermType={hPermType} onOthersNote={hOthersNote}
                              onDelete={id=>setDeleteId(id)}
                              dragHandleProps={{}}
                              onEditSave={handleEditSave} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/*  Login modal  */}
      <AnimatePresence>
        {showLogin && <LoginModal onLogin={()=>{setIsAdmin(true);setShowLogin(false);}} onClose={()=>setShowLogin(false)} />}
      </AnimatePresence>

      {/*  Delete confirm  */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
            <motion.div initial={{scale:0.9}} animate={{scale:1}}
              className="bg-[#0a1a3a] border border-red-500/30 p-8 rounded-2xl max-w-sm w-full text-center">
              <h2 className="text-xl font-bold mb-2">Remove Entry?</h2>
              <p className="text-xs text-slate-500 mb-6 tracking-wide">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-xs font-bold uppercase">Cancel</button>
                <button onClick={()=>handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold uppercase transition-all">Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}