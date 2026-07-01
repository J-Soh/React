import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader, LogOut, RefreshCw, ChevronDown, Trash2 } from 'lucide-react';
import "./output.css"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// FeedBack
function StatusMsg({ message }) {
  if (!message) return null;
  const ok = /success|approved|rejected|sent for approval|cancelled|deleted|submitted|created|added/i.test(message);
  return (
    <div className={`mb-4 px-3 py-2 rounded-md text-sm ${ok ? 'bg-ok-subtle text-ok-fg' : 'bg-danger-subtle text-danger-fg'}`}>
      {message}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-fg-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    approved: 'bg-ok-subtle text-ok-fg',
    rejected: 'bg-danger-subtle text-danger-fg',
    pending: 'bg-warn-subtle text-warn-fg',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-inset text-fg-muted'}`}>
      {status}
    </span>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [isAuthMode, setIsAuthMode] = useState('login');
  const [authMessage, setAuthMessage] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [selectedFacility, setSelectedFacility] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityCapacity, setFacilityCapacity] = useState('');
  const [expandedFacility, setExpandedFacility] = useState(null);
  const [capacityCheck, setCapacityCheck] = useState({
    available: false, remaining: 0, totalCapacity: 0, booked: 0, facilityName: '', timeOverlap: false
  });

  // Effects
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setCurrentUser(session.user); await loadUserProfile(session.user.id); }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'mybookings' && currentUser && userProfile) loadBookings(userProfile.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentUser, userProfile]);

  useEffect(() => {
    if (selectedFacility && bookingDate && startTime && endTime) {
      setCapacityCheck(checkCap(selectedFacility, bookingDate, startTime, endTime));
    } else if (selectedFacility) {
      const f = facilities.find(f => f.id === parseInt(selectedFacility));
      setCapacityCheck(f ? { available: false, remaining: 0, totalCapacity: f.capacity, booked: 0, timeOverlap: false }
        : { available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false });
    } else {
      setCapacityCheck({ available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFacility, bookingDate, startTime, endTime, bookings, facilities]);

  // Helpers
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const overlaps = (s1, e1, s2, e2) => mins(s1) < mins(e2) && mins(e1) > mins(s2);
  const fmtTime = (s, e) => `${s} – ${e}`;
  const getPending = () => userProfile?.role === 'boss' ? bookings.filter(b => b.status === 'pending') : [];
  const getMyBookings = () => bookings.filter(b => b.user_id === currentUser?.id);

  const checkCap = (fid, date, start, end) => {
    const id = parseInt(fid);
    const f = facilities.find(f => f.id === id);
    if (!f) return { available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false };
    const ov = bookings.filter(b => {
      const bid = typeof b.facility_id === 'string' ? parseInt(b.facility_id) : b.facility_id;
      return bid === id && b.date === date && b.status === 'approved' && overlaps(start, end, b.start_time, b.end_time);
    });
    const rem = f.capacity - ov.length;
    return { available: rem > 0, remaining: rem, totalCapacity: f.capacity, booked: ov.length, timeOverlap: ov.length > 0 };
  };

  // Data
  const loadUserProfile = async (uid) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (error) { setAuthMessage('Error loading profile: ' + error.message); return; }
      if (data) { setUserProfile(data); setView(data.role === 'boss' ? 'approvals' : 'facilities'); await loadFacilities(); await loadBookings(data.role); }
    } catch (e) { console.error(e); }
  };

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('facilities').select('*').order('name');
      if (error) { setAuthMessage('Error: ' + error.message); return; }
      setFacilities(data || []);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const loadBookings = async (role) => {
    try {
      let q = supabase.from('bookings').select('*').order('date', { ascending: true }).order('start_time', { ascending: true });
      if (role !== 'boss') q = q.eq('user_id', currentUser?.id);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) { setBookings([]); return; }
      const enriched = await Promise.all(data.map(async b => {
        let fi = { name: 'Unknown', capacity: 0 };
        if (b.facility_id) { try { const { data: f } = await supabase.from('facilities').select('name, capacity').eq('id', b.facility_id).single(); if (f) fi = f; } catch {} }
        let ui = { name: 'Unknown', role: 'client' };
        if (b.user_id && role === 'boss') { try { const { data: p } = await supabase.from('profiles').select('name, role').eq('id', b.user_id).single(); if (p) ui = p; } catch {} }
        if (role !== 'boss' && b.user_id === currentUser?.id && userProfile) ui = { name: userProfile.name, role: userProfile.role };
        return { ...b, facilities: fi, profiles: ui };
      }));
      setBookings(enriched);
    } catch { setBookings([]); }
  };

  // Actions
  const handleLogin = async () => {
    if (!email || !password) { setAuthMessage('Fill in all fields.'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) { setCurrentUser(data.user); await loadUserProfile(data.user.id); setEmail(''); setPassword(''); setAuthMessage(''); }
    } catch (e) { setAuthMessage('Login failed: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleSignup = async () => {
    if (!email || !password || !name) { setAuthMessage('Fill in all fields.'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { data: ad, error: ae } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (ae) {
        if (ae.message.includes('already registered')) {
          const { data: sd, error: se } = await supabase.auth.signInWithPassword({ email, password });
          if (se) { setAuthMessage('Email registered. Check your password.'); return; }
          setCurrentUser(sd.user); await loadUserProfile(sd.user.id); setAuthMessage(''); return;
        }
        throw ae;
      }
      if (ad.user) {
        const { error: pe } = await supabase.from('profiles').insert({ id: ad.user.id, name, role: 'client' });
        if (pe && !pe.message.includes('duplicate key')) throw pe;
        setAuthMessage('Account created. Sign in to continue.');
        setIsAuthMode('login'); setEmail(''); setPassword(''); setName('');
      }
    } catch (e) { setAuthMessage('Signup error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null); setUserProfile(null); setView('login');
    setFacilities([]); setBookings([]); setAuthMessage('');
  };

  const handleBooking = async () => {
    if (startTime >= endTime) { setAuthMessage('End time must be after start time.'); return; }
    if (!selectedFacility || !bookingDate || !startTime || !endTime) { setAuthMessage('Fill in all fields.'); return; }
    const c = checkCap(selectedFacility, bookingDate, startTime, endTime);
    if (!c.available) { setAuthMessage(`Fully booked. Capacity ${c.totalCapacity}, booked ${c.booked}.`); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings')
        .insert({ facility_id: parseInt(selectedFacility), user_id: currentUser.id, date: bookingDate, start_time: startTime, end_time: endTime, status: 'pending' }).select();
      if (error) throw error;
      setAuthMessage('Booking submitted for approval.');
      setSelectedFacility(''); setBookingDate(''); setStartTime(''); setEndTime('');
      setTimeout(async () => { await loadBookings(userProfile.role); setTimeout(() => setAuthMessage(''), 3000); }, 800);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) throw error;
      setAuthMessage('Booking cancelled.'); await loadBookings(userProfile.role); setTimeout(() => setAuthMessage(''), 3000);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleApproval = async (id, status) => {
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) throw error;
      await loadBookings(userProfile.role); setAuthMessage(`Booking ${status}.`); setTimeout(() => setAuthMessage(''), 3000);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleAddFacility = async () => {
    if (!facilityName || !facilityCapacity) { setAuthMessage('Fill in all fields.'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('facilities').insert({ name: facilityName, capacity: parseInt(facilityCapacity) });
      if (error) throw error;
      setAuthMessage('Facility added.'); setFacilityName(''); setFacilityCapacity(''); await loadFacilities(); setTimeout(() => setAuthMessage(''), 2500);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteFacility = async (id) => {
    if (bookings.some(b => b.facility_id === id) && !window.confirm('This facility has bookings. Delete anyway?')) return;
    setLoading(true);
    try {
      await supabase.from('bookings').delete().eq('facility_id', id);
      const { error } = await supabase.from('facilities').delete().eq('id', id);
      if (error) throw error;
      setAuthMessage('Facility removed.'); await loadFacilities(); await loadBookings(userProfile.role); setTimeout(() => setAuthMessage(''), 2500);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteBookingBoss = async (id) => {
    if (!window.confirm('Delete this booking?')) return;
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id).select();
      if (error) throw error;
      setAuthMessage('Booking deleted.'); await loadBookings(userProfile.role); await loadFacilities(); setTimeout(() => setAuthMessage(''), 3000);
    } catch (e) { setAuthMessage('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  // Login
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-page flex">
        {/* Left: form */}
        <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-[12vw] flex flex-col justify-center px-6 py-12">
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase text-accent-fg mb-3">SAF Facility Booking</p>
            <h1 className="text-2xl font-semibold tracking-tight text-fg leading-tight">
              {isAuthMode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
          </div>

          <StatusMsg message={authMessage} />

          <div className="space-y-4">
            {isAuthMode === 'signup' && (
              <Field label="Full name">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="input-field" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-field" />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (isAuthMode === 'login' ? handleLogin() : handleSignup())}
                placeholder="Enter password" className="input-field" />
            </Field>

            <button onClick={isAuthMode === 'login' ? handleLogin : handleSignup} disabled={loading}
              className="w-full h-9 rounded-md bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {loading && <Loader className="w-3.5 h-3.5 animate-spin" />}
              {isAuthMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <p className="mt-6 text-sm text-fg-faint">
            {isAuthMode === 'login' ? 'No account? ' : 'Have an account? '}
            <button onClick={() => { setIsAuthMode(isAuthMode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}
              className="text-accent-fg font-medium hover:underline underline-offset-2">
              {isAuthMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Right: block of color (only on large screens) */}
        <div className="hidden lg:block flex-1 bg-bar" />
      </div>
    );
  }

  // Top bar
  const TopBar = ({ tabs }) => (
    <header className="bg-bar">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-5">
            <span className="text-sm font-semibold text-bar-fg tracking-tight">SAF Booking</span>
            <nav className="flex items-center gap-0.5">
              {tabs.map(tab => (
                <button key={tab.value} onClick={() => setView(tab.value)}
                  className={`px-2.5 py-1 rounded text-sm transition-colors ${view === tab.value
                    ? 'text-bar-active bg-white/[0.08] font-medium'
                    : 'text-bar-muted hover:text-bar-fg'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-bar-muted hidden sm:block">{userProfile?.name}</span>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-bar-muted hover:text-bar-fg transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );


  // Boss account
  if (view === 'approvals' && userProfile?.role === 'boss') {
    const pending = getPending();
    return (
      <div className="min-h-screen bg-page">
        <TopBar tabs={[
          { value: 'approvals', label: `Approvals${pending.length ? ` (${pending.length})` : ''}` },
          { value: 'manage-facilities', label: 'Facilities' },
        ]} />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <h2 className="text-lg font-semibold text-fg mb-1">Pending approvals</h2>
          <p className="text-sm text-fg-muted mb-5">{pending.length ? `${pending.length} request${pending.length > 1 ? 's' : ''} awaiting review` : 'No pending requests'}</p>

          <StatusMsg message={authMessage} />

          {pending.length === 0 ? (
            <div className="border border-line rounded-md bg-surface py-14 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-ok-fg opacity-40" />
              <p className="text-sm text-fg-muted">All caught up</p>
            </div>
          ) : (
            <div className="border border-line rounded-md bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Facility</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Requested by</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Date</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Time</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-fg-faint text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pending.map(b => (
                    <tr key={b.id} className="hover:bg-inset transition-colors">
                      <td className="px-4 py-3 font-medium text-fg">{b.facilities?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-fg-muted">{b.profiles?.name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-fg-muted">{b.date}</td>
                      <td className="px-4 py-3 text-fg-muted">{fmtTime(b.start_time, b.end_time)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleApproval(b.id, 'approved')} disabled={loading}
                            className="px-2.5 py-1 rounded text-sm font-medium bg-ok text-on-accent hover:opacity-90 disabled:opacity-40 transition-opacity">
                            Approve
                          </button>
                          <button onClick={() => handleApproval(b.id, 'rejected')} disabled={loading}
                            className="px-2.5 py-1 rounded text-sm font-medium bg-danger text-on-accent hover:opacity-90 disabled:opacity-40 transition-opacity">
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BOSS: FACILITIES
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'manage-facilities' && userProfile?.role === 'boss') {
    return (
      <div className="min-h-screen bg-page">
        <TopBar tabs={[
          { value: 'approvals', label: `Approvals${getPending().length ? ` (${getPending().length})` : ''}` },
          { value: 'manage-facilities', label: 'Facilities' },
        ]} />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <div className="grid lg:grid-cols-3 gap-8">

            {/* Add form */}
            <div>
              <h2 className="text-lg font-semibold text-fg mb-1">Add facility</h2>
              <p className="text-sm text-fg-muted mb-4">Create a new bookable space</p>
              <div className="border border-line rounded-md bg-surface p-4">
                <StatusMsg message={authMessage} />
                <div className="space-y-3">
                  <Field label="Name">
                    <input type="text" value={facilityName} onChange={e => setFacilityName(e.target.value)} placeholder="Conference Room A" className="input-field" />
                  </Field>
                  <Field label="Capacity">
                    <input type="number" value={facilityCapacity} onChange={e => setFacilityCapacity(e.target.value)} placeholder="10" min="1" className="input-field" />
                  </Field>
                  <button onClick={handleAddFacility} disabled={loading}
                    className="w-full h-8 rounded-md bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {loading && <Loader className="w-3.5 h-3.5 animate-spin" />}
                    {loading ? 'Adding...' : 'Add facility'}
                  </button>
                </div>
              </div>
            </div>

            {/* Facility list */}
            <div className="lg:col-span-2">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-fg">Facilities</h2>
                  <p className="text-sm text-fg-muted">{facilities.length} total</p>
                </div>
              </div>

              {facilities.length === 0 ? (
                <div className="border border-line rounded-md bg-surface py-12 text-center">
                  <p className="text-sm text-fg-muted">No facilities yet</p>
                </div>
              ) : (
                <div className="border border-line rounded-md bg-surface divide-y divide-line overflow-hidden">
                  {facilities.map(f => {
                    const fb = bookings.filter(b => b.facility_id === f.id);
                    const pa = fb.filter(b => b.status === 'pending').length;
                    const aa = fb.filter(b => b.status === 'approved').length;
                    const expanded = expandedFacility === f.id;
                    return (
                      <div key={f.id}>
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                          <button className="flex-1 text-left flex items-center justify-between min-w-0"
                            onClick={() => setExpandedFacility(expanded ? null : f.id)}>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-fg truncate">{f.name}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs text-fg-faint">Cap. {f.capacity}</span>
                                {aa > 0 && <span className="text-xs text-ok-fg">{aa} active</span>}
                                {pa > 0 && <span className="text-xs text-warn-fg">{pa} pending</span>}
                              </div>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-fg-faint shrink-0 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                          <button onClick={() => handleDeleteFacility(f.id)} disabled={loading} title="Delete"
                            className="p-1.5 rounded text-fg-faint hover:text-danger-fg hover:bg-danger-subtle transition-colors disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {expanded && (
                          <div className="px-4 pb-3 border-t border-line-subtle">
                            {fb.length === 0 ? (
                              <p className="text-xs text-fg-faint py-3">No bookings</p>
                            ) : (
                              <table className="w-full text-sm mt-2">
                                <thead>
                                  <tr className="text-left text-xs text-fg-faint">
                                    <th className="pb-1 font-medium">User</th>
                                    <th className="pb-1 font-medium">Date</th>
                                    <th className="pb-1 font-medium">Time</th>
                                    <th className="pb-1 font-medium">Status</th>
                                    <th className="pb-1"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line-subtle">
                                  {fb.map(b => (
                                    <tr key={b.id}>
                                      <td className="py-2 text-fg">{b.profiles?.name || 'Unknown'}</td>
                                      <td className="py-2 text-fg-muted">{b.date}</td>
                                      <td className="py-2 text-fg-muted">{fmtTime(b.start_time, b.end_time)}</td>
                                      <td className="py-2"><StatusPill status={b.status} /></td>
                                      <td className="py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {b.status === 'pending' && (
                                            <>
                                              <button onClick={() => handleApproval(b.id, 'approved')}
                                                className="text-xs px-2 py-0.5 rounded text-ok-fg hover:bg-ok-subtle transition-colors">Approve</button>
                                              <button onClick={() => handleApproval(b.id, 'rejected')}
                                                className="text-xs px-2 py-0.5 rounded text-danger-fg hover:bg-danger-subtle transition-colors">Reject</button>
                                            </>
                                          )}
                                          <button onClick={() => handleDeleteBookingBoss(b.id)}
                                            className="text-xs px-2 py-0.5 rounded text-danger-fg hover:bg-danger-subtle transition-colors">Delete</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CLIENT
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-page">
      <TopBar tabs={[
        { value: 'facilities', label: 'Book' },
        { value: 'mybookings', label: `My bookings${getMyBookings().length ? ` (${getMyBookings().length})` : ''}` },
      ]} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12">

        {view === 'facilities' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Booking form (comes first visually on mobile) */}
            <div className="order-1 lg:order-2">
              <h2 className="text-lg font-semibold text-fg mb-1">New booking</h2>
              <p className="text-sm text-fg-muted mb-4">Request a facility slot</p>
              <div className="border border-line rounded-md bg-surface p-4">
                <StatusMsg message={authMessage} />
                <div className="space-y-3">
                  <Field label="Facility">
                    <select value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)} className="input-field">
                      <option value="">Select...</option>
                      {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]} className="input-field" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Start">
                      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-field" />
                    </Field>
                    <Field label="End">
                      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input-field" />
                    </Field>
                  </div>

                  {selectedFacility && (() => {
                    const fac = facilities.find(f => f.id === parseInt(selectedFacility));
                    if (!fac) return null;
                    if (!bookingDate || !startTime || !endTime)
                      return <p className="text-xs text-fg-faint">{fac.name}: {fac.capacity} capacity. Select date and time to check.</p>;
                    if (startTime >= endTime)
                      return <p className="text-xs text-danger-fg">End time must be after start time.</p>;
                    if (!capacityCheck.available)
                      return <p className="text-xs text-danger-fg">Fully booked for this period.</p>;
                    return <p className="text-xs text-ok-fg">{capacityCheck.remaining} of {capacityCheck.totalCapacity} spots available.</p>;
                  })()}

                  <button onClick={handleBooking}
                    disabled={loading || !selectedFacility || !bookingDate || !startTime || !endTime || startTime >= endTime || (bookingDate && startTime && endTime && !capacityCheck.available)}
                    className="w-full h-8 rounded-md bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {loading && <Loader className="w-3.5 h-3.5 animate-spin" />}
                    {loading ? 'Submitting...' :
                      !selectedFacility ? 'Select a facility' :
                      !bookingDate ? 'Select a date' :
                      !startTime || !endTime ? 'Select times' :
                      startTime >= endTime ? 'Fix times' :
                      !capacityCheck.available ? 'Unavailable' :
                      'Submit request'}
                  </button>
                </div>
              </div>
            </div>

            {/* Facility list */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <h2 className="text-lg font-semibold text-fg mb-1">Available facilities</h2>
              <p className="text-sm text-fg-muted mb-4">{facilities.length} spaces</p>
              {facilities.length === 0 ? (
                <div className="border border-line rounded-md bg-surface py-12 text-center">
                  <p className="text-sm text-fg-muted">No facilities available</p>
                  <p className="text-xs text-fg-faint mt-1">Contact your administrator.</p>
                </div>
              ) : (
                <div className="border border-line rounded-md bg-surface divide-y divide-line overflow-hidden">
                  {facilities.map(f => {
                    const approved = bookings.filter(b => b.facility_id === f.id && b.status === 'approved');
                    const myPending = bookings.filter(b => b.facility_id === f.id && b.user_id === currentUser?.id && b.status === 'pending');
                    return (
                      <div key={f.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-medium text-fg">{f.name}</p>
                          <span className="text-xs text-fg-faint">Cap. {f.capacity}</span>
                        </div>
                        {myPending.length > 0 && (
                          <p className="text-xs text-warn-fg mt-1">{myPending.length} pending request{myPending.length > 1 ? 's' : ''}</p>
                        )}
                        {approved.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {approved.map(b => (
                              <p key={b.id} className="text-xs text-fg-faint">
                                {b.date}, {fmtTime(b.start_time, b.end_time)} ({b.profiles?.name || 'Unknown'})
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'mybookings' && (
          <>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-lg font-semibold text-fg">My bookings</h2>
              <button onClick={() => loadBookings(userProfile.role)} disabled={loading}
                className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-40">
                {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh
              </button>
            </div>
            <p className="text-sm text-fg-muted mb-5">{getMyBookings().length} booking{getMyBookings().length !== 1 ? 's' : ''}</p>

            <StatusMsg message={authMessage} />

            {getMyBookings().length === 0 ? (
              <div className="border border-line rounded-md bg-surface py-14 text-center">
                <p className="text-sm text-fg-muted">No bookings yet</p>
                <button onClick={() => setView('facilities')}
                  className="mt-3 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors">
                  Book a facility
                </button>
              </div>
            ) : (
              <div className="border border-line rounded-md bg-surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Facility</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Date</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Time</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-fg-faint">Status</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-fg-faint text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {getMyBookings().map(b => (
                      <tr key={b.id} className="hover:bg-inset transition-colors">
                        <td className="px-4 py-3 font-medium text-fg">{b.facilities?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-fg-muted">{b.date}</td>
                        <td className="px-4 py-3 text-fg-muted">{fmtTime(b.start_time, b.end_time)}</td>
                        <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                        <td className="px-4 py-3 text-right">
                          {(b.status === 'approved' || b.status === 'pending') && (
                            <button onClick={() => handleCancel(b.id)} disabled={loading}
                              className="text-sm text-danger-fg hover:bg-danger-subtle px-2 py-0.5 rounded transition-colors disabled:opacity-40">
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
