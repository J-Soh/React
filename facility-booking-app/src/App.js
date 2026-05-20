import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle, Users, Loader, Building2, LogOut, ArrowRight, Plus, Trash2, RefreshCw, ChevronDown } from 'lucide-react';
import "./output.css"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Shared UI Primitives ────────────────────────────────────────────
const Card = ({ children, className = '', ...props }) => (
  <div
    className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl ${className}`}
    {...props}
  >
    {children}
  </div>
);

const GlassInput = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-white/50 mb-2">{label}</label>}
    <input
      className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-blue-500/50 focus:bg-white/[0.07]"
      {...props}
    />
  </div>
);

const GlassSelect = ({ label, children, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-white/50 mb-2">{label}</label>}
    <select
      className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-white outline-none transition-all duration-200 focus:border-blue-500/50"
      {...props}
    >
      {children}
    </select>
  </div>
);

const PrimaryButton = ({ children, loading, className = '', ...props }) => (
  <button
    className={`relative overflow-hidden w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 ${className}`}
    {...props}
  >
    {loading && <Loader className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

const Badge = ({ variant = 'default', children }) => {
  const styles = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    default: 'bg-white/[0.05] text-white/60 border-white/10',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[variant] || styles.default}`}>
      {children}
    </span>
  );
};

const StatusMessage = ({ message }) => {
  if (!message) return null;
  const isSuccess = message.includes('success') || message.includes('approved') || message.includes('rejected') || message.includes('sent for approval') || message.includes('cancelled') || message.includes('deleted');
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`mb-5 p-3.5 rounded-xl text-sm font-medium border ${isSuccess ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}
    >
      {message}
    </motion.div>
  );
};

const PageShell = ({ children }) => (
  <div className="min-h-screen bg-[#111113] relative">
    {/* Subtle gradient orbs */}
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-blue-600/[0.04] blur-[120px]" />
      <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-indigo-600/[0.03] blur-[120px]" />
    </div>
    {/* Noise */}
    <div className="noise-overlay pointer-events-none fixed inset-0 opacity-[0.35] mix-blend-overlay" />
    <div className="relative z-10">{children}</div>
  </div>
);

// ── Main App ────────────────────────────────────────────────────────
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
    available: false,
    remaining: 0,
    totalCapacity: 0,
    booked: 0,
    facilityName: '',
    timeOverlap: false
  });

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Session found:', session.user);
        setCurrentUser(session.user);
        await loadUserProfile(session.user.id);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    if (view === 'mybookings' && currentUser && userProfile) {
      console.log('Switched to mybookings view, reloading bookings...');
      loadBookings(userProfile.role);
    }
  }, [view, currentUser, userProfile]);

  useEffect(() => {
    if (selectedFacility && bookingDate && startTime && endTime) {
      const check = checkFacilityCapacity(selectedFacility, bookingDate, startTime, endTime);
      setCapacityCheck(check);
    } else if (selectedFacility) {
      const facilityIdNum = parseInt(selectedFacility);
      const facility = facilities.find(f => f.id === facilityIdNum);
      if (facility) {
        setCapacityCheck({ available: false, remaining: 0, totalCapacity: facility.capacity, booked: 0, timeOverlap: false });
      } else {
        setCapacityCheck({ available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false });
      }
    } else {
      setCapacityCheck({ available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false });
    }
  }, [selectedFacility, bookingDate, startTime, endTime, bookings, facilities]);

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const checkTimeOverlap = (start1, end1, start2, end2) => {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return (s1 < e2 && e1 > s2);
  };

  const checkFacilityCapacity = (facilityId, date, startTime, endTime) => {
    const facilityIdNum = parseInt(facilityId);
    const facility = facilities.find(f => f.id === facilityIdNum);
    if (!facility) return { available: false, remaining: 0, totalCapacity: 0, booked: 0, timeOverlap: false };

    const overlappingBookings = bookings.filter(b => {
      const bookingFacilityId = typeof b.facility_id === 'string' ? parseInt(b.facility_id) : b.facility_id;
      if (bookingFacilityId !== facilityIdNum || b.date !== date || b.status !== 'approved') return false;
      return checkTimeOverlap(startTime, endTime, b.start_time, b.end_time);
    });

    const remaining = facility.capacity - overlappingBookings.length;
    return {
      available: remaining > 0,
      remaining,
      totalCapacity: facility.capacity,
      booked: overlappingBookings.length,
      timeOverlap: overlappingBookings.length > 0
    };
  };

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) { setAuthMessage('Error loading profile: ' + error.message); return; }
      if (data) {
        setUserProfile(data);
        setView(data.role === 'boss' ? 'approvals' : 'facilities');
        await loadAllData(data.role);
      }
    } catch (error) { console.error('Exception in loadUserProfile:', error); }
  };

  const loadAllData = async (role) => {
    await loadFacilities();
    await loadBookings(role);
  };

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('facilities').select('*').order('name');
      if (error) { setAuthMessage('Error loading facilities: ' + error.message); return; }
      setFacilities(data || []);
    } catch (error) {
      setAuthMessage('Exception loading facilities: ' + error.message);
    } finally { setLoading(false); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Date not available' : date.toLocaleString();
    } catch (error) { return 'Date not available'; }
  };

  const handleCancelBooking = async (bookingId) => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this booking?');
    if (!confirmCancel) return;
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId).eq('user_id', currentUser.id);
      if (error) throw error;
      setAuthMessage('Booking cancelled successfully!');
      await loadBookings(userProfile.role);
      setTimeout(() => setAuthMessage(''), 3000);
    } catch (error) {
      setAuthMessage('Error cancelling booking: ' + error.message);
    } finally { setLoading(false); }
  };

  const handleBooking = async () => {
    if (startTime >= endTime) { setAuthMessage('End time must be after start time'); return; }
    if (!selectedFacility || !bookingDate || !startTime || !endTime) { alert('Please fill in all fields'); return; }

    const capacityCheckResult = checkFacilityCapacity(selectedFacility, bookingDate, startTime, endTime);
    if (!capacityCheckResult.available) {
      setAuthMessage(`This facility is fully booked for the selected time period. Capacity: ${capacityCheckResult.totalCapacity}, Already booked: ${capacityCheckResult.booked}`);
      return;
    }
    if (capacityCheckResult.timeOverlap) {
      setAuthMessage('Warning: Your selected time period overlaps with existing bookings. Please check availability.');
      return;
    }

    setLoading(true); setAuthMessage('');
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert({ facility_id: parseInt(selectedFacility), user_id: currentUser.id, date: bookingDate, start_time: startTime, end_time: endTime, status: 'pending' })
        .select();
      if (error) throw error;
      setAuthMessage('Booking request sent for approval!');
      setSelectedFacility(''); setBookingDate(''); setStartTime(''); setEndTime('');
      setTimeout(async () => {
        await loadBookings(userProfile.role);
        setTimeout(() => setAuthMessage(''), 3000);
      }, 1000);
    } catch (error) {
      alert('Booking error: ' + error.message);
    } finally { setLoading(false); }
  };

  const loadBookings = async (role) => {
    try {
      let query = supabase.from('bookings').select('*').order('date', { ascending: true }).order('start_time', { ascending: true });
      if (role !== 'boss') query = query.eq('user_id', currentUser?.id);
      const { data: bookingsData, error: bookingsError } = await query;
      if (bookingsError) throw bookingsError;
      if (!bookingsData || bookingsData.length === 0) { setBookings([]); return; }

      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          let facilityInfo = { name: 'Unknown Facility', capacity: 0 };
          if (booking.facility_id) {
            try {
              const { data: facilityData } = await supabase.from('facilities').select('name, capacity').eq('id', booking.facility_id).single();
              if (facilityData) facilityInfo = facilityData;
            } catch (e) { }
          }
          let userInfo = { name: 'Unknown User', role: 'client' };
          if (booking.user_id && role === 'boss') {
            try {
              const { data: profileData } = await supabase.from('profiles').select('name, role').eq('id', booking.user_id).single();
              if (profileData) userInfo = profileData;
              else {
                const { data: authData } = await supabase.auth.admin.getUserById(booking.user_id);
                if (authData?.user) userInfo = { name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Unknown User', role: 'client' };
              }
            } catch (e) { }
          }
          if (role !== 'boss' && booking.user_id === currentUser?.id && userProfile) {
            userInfo = { name: userProfile.name, role: userProfile.role };
          }
          return { ...booking, facilities: facilityInfo, profiles: userInfo };
        })
      );
      setBookings(enrichedBookings);
    } catch (error) { setBookings([]); }
  };

  const formatTimePeriod = (startTime, endTime) => `${startTime} - ${endTime}`;

  const handleSignup = async () => {
    if (!email || !password || !name) { setAuthMessage('Please fill in all fields'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (authError) {
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) { setAuthMessage('Email already registered. Please use correct password.'); return; }
          setCurrentUser(signInData.user);
          await loadUserProfile(signInData.user.id);
          setAuthMessage(''); return;
        }
        throw authError;
      }
      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({ id: authData.user.id, name, role: 'client' });
        if (profileError && !profileError.message.includes('duplicate key')) throw profileError;
        setAuthMessage('Account created successfully! Please sign in.');
        setIsAuthMode('login'); setEmail(''); setPassword(''); setName('');
      }
    } catch (error) { setAuthMessage('Signup error: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleLogin = async () => {
    if (!email || !password) { setAuthMessage('Please fill in all fields'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setCurrentUser(data.user);
        await loadUserProfile(data.user.id);
        setEmail(''); setPassword(''); setAuthMessage('');
      }
    } catch (error) { setAuthMessage('Login error: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null); setUserProfile(null); setView('login');
    setFacilities([]); setBookings([]); setAuthMessage('');
  };

  const handleApproval = async (bookingId, status) => {
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
      if (error) throw error;
      await loadBookings(userProfile.role);
      setAuthMessage(`Booking ${status} successfully!`);
      setTimeout(() => setAuthMessage(''), 3000);
    } catch (error) { alert('Approval error: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleAddFacility = async () => {
    if (!facilityName || !facilityCapacity) { setAuthMessage('Please fill in all fields'); return; }
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('facilities').insert({ name: facilityName, capacity: parseInt(facilityCapacity) });
      if (error) throw error;
      setAuthMessage('Facility added successfully!');
      setFacilityName(''); setFacilityCapacity('');
      await loadFacilities();
      setTimeout(() => setAuthMessage(''), 2500);
    } catch (error) { alert('Error adding facility: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleDeleteFacility = async (facilityId) => {
    const hasBookings = bookings.some(b => b.facility_id === facilityId);
    if (hasBookings) {
      const confirmDelete = window.confirm('This facility has existing bookings. Are you sure you want to delete it?');
      if (!confirmDelete) return;
    }
    setLoading(true);
    try {
      await supabase.from('bookings').delete().eq('facility_id', facilityId);
      const { error } = await supabase.from('facilities').delete().eq('id', facilityId);
      if (error) throw error;
      setAuthMessage('Facility deleted successfully!');
      await loadFacilities(); await loadBookings(userProfile.role);
      setTimeout(() => setAuthMessage(''), 2200);
    } catch (error) { setAuthMessage('Error deleting facility: ' + error.message); }
    finally { setLoading(false); }
  };

  const handleCancelBookingForBoss = async (bookingId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this booking?');
    if (!confirmDelete) return;
    setLoading(true); setAuthMessage('');
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId).select();
      if (error) throw error;
      setAuthMessage('Booking deleted successfully!');
      await loadBookings(userProfile.role); await loadFacilities();
      setTimeout(() => setAuthMessage(''), 3000);
    } catch (error) { setAuthMessage('Error deleting booking: ' + error.message); }
    finally { setLoading(false); }
  };

  const getPendingBookings = () => {
    if (userProfile?.role !== 'boss') return [];
    return bookings.filter(b => b.status === 'pending');
  };
  const getUserBookings = () => bookings.filter(b => b.user_id === currentUser?.id);
  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <AlertCircle className="w-5 h-5 text-amber-400" />;
    }
  };

  // ═════════════════════════════════════════════════════════════════
  //  LOGIN VIEW
  // ═════════════════════════════════════════════════════════════════
  if (view === 'login') {
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <Card className="p-8 border-white/[0.08] bg-white/[0.04] shadow-2xl shadow-black/40">
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/25 mb-5"
                >
                  <Building2 className="w-8 h-8 text-white" />
                </motion.div>
                <h1 className="text-2xl font-bold text-white tracking-tight">SAF Facility Booking</h1>
                <p className="text-white/40 text-sm mt-2">
                  {isAuthMode === 'login' ? 'Welcome back -- sign in to continue' : 'Create your account to get started'}
                </p>
              </div>

              <AnimatePresence mode="wait">
                <StatusMessage message={authMessage} />
              </AnimatePresence>

              <div className="space-y-4">
                <AnimatePresence>
                  {isAuthMode === 'signup' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <GlassInput label="Full Name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <GlassInput label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                <GlassInput
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (isAuthMode === 'login' ? handleLogin() : handleSignup())}
                  placeholder="••••••••"
                />

                <PrimaryButton
                  onClick={isAuthMode === 'login' ? handleLogin : handleSignup}
                  disabled={loading}
                  loading={loading}
                >
                  {isAuthMode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </PrimaryButton>

                <div className="text-center pt-2">
                  <button
                    onClick={() => { setIsAuthMode(isAuthMode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}
                    className="text-sm text-white/40 hover:text-white/60 transition-colors"
                  >
                    {isAuthMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <span className="text-blue-400 font-semibold">{isAuthMode === 'login' ? 'Sign up' : 'Sign in'}</span>
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  NAVIGATION BAR (shared)
  // ═════════════════════════════════════════════════════════════════
  const NavBar = ({ tabs }) => (
    <Card className="p-4 sm:p-5 mb-6 bg-white/[0.03]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {userProfile?.role === 'boss' ? 'Boss Dashboard' : 'Facility Booking'}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Welcome back, <span className="text-blue-400 font-medium">{userProfile?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setView(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${view === tab.value
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/70'
                }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20"
          >
            <LogOut className="w-4 h-4 inline mr-1.5" />
            Logout
          </button>
        </div>
      </div>
    </Card>
  );

  // ═════════════════════════════════════════════════════════════════
  //  BOSS: APPROVALS VIEW
  // ═════════════════════════════════════════════════════════════════
  if (view === 'approvals' && userProfile?.role === 'boss') {
    const pendingBookings = getPendingBookings();
    return (
      <PageShell>
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <NavBar tabs={[
            { value: 'approvals', label: `Approvals (${pendingBookings.length})` },
            { value: 'manage-facilities', label: 'Manage Facilities' }
          ]} />

          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
              <Badge variant="pending">{pendingBookings.length} pending</Badge>
            </div>

            <AnimatePresence mode="wait">
              <StatusMessage message={authMessage} />
            </AnimatePresence>

            {pendingBookings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <CheckCircle className="w-14 h-14 mx-auto mb-4 text-emerald-400/60" />
                <p className="text-lg font-medium text-white/80">All clear!</p>
                <p className="text-sm mt-1 text-white/30">No pending bookings to approve</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((booking, i) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.05 }}
                    className="rounded-xl p-4 bg-amber-500/[0.04] border border-amber-500/15 hover:bg-amber-500/[0.06] transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-5 h-5 text-amber-400" />
                          <h3 className="font-semibold text-white">{booking.facilities?.name || 'Unknown Facility'}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-white/50">
                          <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /><span className="text-white/70">Booked by:</span> {booking.profiles?.name || 'Unknown'}</div>
                          <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /><span className="text-white/70">Date:</span> {booking.date}</div>
                          <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /><span className="text-white/70">Time:</span> {formatTimePeriod(booking.start_time, booking.end_time)}</div>
                          <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /><span className="text-white/70">Capacity:</span> {booking.facilities?.capacity || '?'}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproval(booking.id, 'approved')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval(booking.id, 'rejected')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </PageShell>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  BOSS: MANAGE FACILITIES VIEW
  // ═════════════════════════════════════════════════════════════════
  if (view === 'manage-facilities' && userProfile?.role === 'boss') {
    return (
      <PageShell>
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <NavBar tabs={[
            { value: 'approvals', label: `Approvals (${getPendingBookings().length})` },
            { value: 'manage-facilities', label: 'Manage Facilities' }
          ]} />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Add Facility */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                  <Plus className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Add New Facility</h2>
              </div>

              <AnimatePresence mode="wait">
                <StatusMessage message={authMessage} />
              </AnimatePresence>

              <div className="space-y-4">
                <GlassInput label="Facility Name" type="text" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="e.g., Conference Room A" />
                <GlassInput label="Capacity" type="number" value={facilityCapacity} onChange={(e) => setFacilityCapacity(e.target.value)} placeholder="e.g., 10" min="1" />
                <PrimaryButton onClick={handleAddFacility} disabled={loading} loading={loading}>
                  {loading ? 'Adding...' : 'Add Facility'}
                </PrimaryButton>
              </div>
            </Card>

            {/* Existing Facilities */}
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Existing Facilities</h2>
                </div>
                <Badge variant="info">{facilities.length} total</Badge>
              </div>

              {facilities.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-white/20" />
                  <p className="text-white/60 font-medium">No facilities yet</p>
                  <p className="text-sm text-white/30 mt-1">Add a facility to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {facilities.map(facility => {
                    const facilityBookings = bookings.filter(b => b.facility_id === facility.id);
                    const pendingBookings = facilityBookings.filter(b => b.status === 'pending');
                    const approvedBookings = facilityBookings.filter(b => b.status === 'approved');
                    const isExpanded = expandedFacility === facility.id;

                    return (
                      <div key={facility.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden transition-all">
                        <div className="p-4 flex justify-between items-start">
                          <div
                            className="flex-1 cursor-pointer select-none"
                            onClick={() => setExpandedFacility(isExpanded ? null : facility.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-white">{facility.name}</h3>
                                <p className="text-sm flex items-center gap-1.5 mt-1 text-white/40">
                                  <Users className="w-3.5 h-3.5" /> Capacity: {facility.capacity}
                                </p>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            <div className="flex gap-2 mt-2.5">
                              {approvedBookings.length > 0 && <Badge variant="approved">{approvedBookings.length} approved</Badge>}
                              {pendingBookings.length > 0 && <Badge variant="pending">{pendingBookings.length} pending</Badge>}
                              {facilityBookings.length === 0 && <Badge>No bookings</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteFacility(facility.id)}
                            disabled={loading}
                            className="ml-3 p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                            title="Delete facility"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Expanded */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
                                {facilityBookings.length === 0 ? (
                                  <p className="text-center text-white/30 text-sm py-4">No bookings for this facility</p>
                                ) : (
                                  <div className="space-y-2 mt-3">
                                    {facilityBookings.map(booking => (
                                      <div
                                        key={booking.id}
                                        className={`p-3 rounded-lg text-sm border ${booking.status === 'approved' ? 'bg-emerald-500/[0.05] border-emerald-500/15' :
                                          booking.status === 'pending' ? 'bg-amber-500/[0.05] border-amber-500/15' :
                                            'bg-red-500/[0.05] border-red-500/15'}`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-white/80">{booking.profiles?.name || 'Unknown User'}</span>
                                            <Badge variant={booking.status}>{booking.status}</Badge>
                                          </div>
                                          <span className="text-white/40 text-xs">{booking.date} {formatTimePeriod(booking.start_time, booking.end_time)}</span>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                          {booking.status === 'pending' && (
                                            <>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleApproval(booking.id, 'approved'); }}
                                                className="text-xs px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
                                              >Approve</button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleApproval(booking.id, 'rejected'); }}
                                                className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
                                              >Reject</button>
                                            </>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleCancelBookingForBoss(booking.id); }}
                                            className="text-xs px-2.5 py-1 bg-white/[0.05] text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                                          >Delete</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </PageShell>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  CLIENT VIEW
  // ═════════════════════════════════════════════════════════════════
  return (
    <PageShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <NavBar tabs={[
          { value: 'facilities', label: 'Book Facility' },
          { value: 'mybookings', label: `My Bookings (${getUserBookings().length})` }
        ]} />

        {/* ── Facilities / Booking Form ── */}
        {view === 'facilities' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* Available Facilities */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                  <Building2 className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Available Facilities</h2>
              </div>
              <div className="space-y-3">
                {facilities.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-white/20" />
                    <p className="text-white/60">No facilities available</p>
                    <p className="text-sm text-white/30 mt-1">Contact administrator to add facilities</p>
                  </div>
                ) : (
                  facilities.map(facility => {
                    const facilityBookings = bookings.filter(
                      b => b.facility_id === facility.id && b.status === 'approved'
                    );
                    const pendingBookings = bookings.filter(
                      b => b.facility_id === facility.id && b.user_id === currentUser?.id && b.status === 'pending'
                    );

                    return (
                      <div key={facility.id} className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{facility.name}</h3>
                            <p className="text-sm flex items-center gap-1.5 mt-1 text-white/40">
                              <Users className="w-3.5 h-3.5" /> Capacity: {facility.capacity}
                            </p>
                            {pendingBookings.length > 0 && (
                              <p className="text-sm mt-1.5 text-amber-400">
                                You have {pendingBookings.length} pending booking{pendingBookings.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        {facilityBookings.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <p className="font-medium text-xs text-white/40 mb-2 uppercase tracking-wider">Current Bookings</p>
                            <div className="space-y-1">
                              {facilityBookings.map(b => (
                                <p key={b.id} className="text-sm text-white/35">
                                  {b.date} at {formatTimePeriod(b.start_time, b.end_time)} - {b.profiles?.name || 'Unknown'}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Booking Form */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                  <Calendar className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Make a Booking</h2>
              </div>

              <AnimatePresence mode="wait">
                <StatusMessage message={authMessage} />
              </AnimatePresence>

              <div className="space-y-4">
                <GlassSelect label="Select Facility" value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)}>
                  <option value="">Choose a facility...</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </GlassSelect>

                <GlassInput label="Date" type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ colorScheme: 'dark' }} />

                <div className="grid grid-cols-2 gap-3">
                  <GlassInput label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ colorScheme: 'dark' }} />
                  <GlassInput label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ colorScheme: 'dark' }} />
                </div>

                {/* Capacity check */}
                {selectedFacility && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3.5 rounded-xl text-sm font-medium border ${(bookingDate && startTime && endTime && capacityCheck.available && !capacityCheck.timeOverlap)
                      ? 'bg-emerald-500/[0.06] border-emerald-500/15 text-emerald-400'
                      : (bookingDate && startTime && endTime && (!capacityCheck.available || capacityCheck.timeOverlap))
                        ? 'bg-red-500/[0.06] border-red-500/15 text-red-400'
                        : 'bg-blue-500/[0.06] border-blue-500/15 text-blue-400'
                      }`}
                  >
                    {(() => {
                      const facilityIdNum = parseInt(selectedFacility);
                      const facility = facilities.find(f => f.id === facilityIdNum);
                      if (!facility) return 'Facility not found';
                      if (!bookingDate || !startTime || !endTime) return `${facility.name}: ${facility.capacity} person capacity. Select date and time to check availability.`;
                      if (startTime >= endTime) return 'End time must be after start time';
                      if (!capacityCheck.available) return `Facility fully booked for this time period!`;
                      if (capacityCheck.timeOverlap) return `Time period overlaps with ${capacityCheck.booked} existing booking(s). ${capacityCheck.remaining} spot(s) remaining.`;
                      return `${capacityCheck.remaining} spot(s) remaining out of ${capacityCheck.totalCapacity} total capacity`;
                    })()}
                  </motion.div>
                )}

                <PrimaryButton
                  onClick={handleBooking}
                  disabled={loading || !selectedFacility || !bookingDate || !startTime || !endTime || startTime >= endTime || (bookingDate && startTime && endTime && !capacityCheck.available)}
                  loading={loading}
                >
                  {loading ? 'Processing...' :
                    !selectedFacility ? 'Select a facility' :
                      !bookingDate ? 'Select a date' :
                        !startTime ? 'Select start time' :
                          !endTime ? 'Select end time' :
                            startTime >= endTime ? 'End time must be after start time' :
                              !capacityCheck.available ? 'Facility Fully Booked' :
                                'Submit Booking Request'}
                </PrimaryButton>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── My Bookings ── */}
        {view === 'mybookings' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">My Bookings</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">{getUserBookings().length} booking{getUserBookings().length !== 1 ? 's' : ''}</Badge>
                  <button
                    onClick={() => loadBookings(userProfile.role)}
                    disabled={loading}
                    className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all disabled:opacity-50"
                    title="Refresh"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <StatusMessage message={authMessage} />
              </AnimatePresence>

              {getUserBookings().length === 0 ? (
                <div className="text-center py-16">
                  <Calendar className="w-14 h-14 mx-auto mb-4 text-white/15" />
                  <p className="text-white/60 text-lg font-medium">No bookings yet</p>
                  <p className="text-white/30 text-sm mt-1">Book a facility to get started!</p>
                  <button
                    onClick={() => setView('facilities')}
                    className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all inline-flex items-center gap-2"
                  >
                    Book a Facility <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getUserBookings().map((booking, i) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className={`rounded-xl p-4 border transition-colors ${booking.status === 'approved' ? 'bg-emerald-500/[0.03] border-emerald-500/15 hover:bg-emerald-500/[0.05]' :
                        booking.status === 'rejected' ? 'bg-red-500/[0.03] border-red-500/15 hover:bg-red-500/[0.05]' :
                          'bg-amber-500/[0.03] border-amber-500/15 hover:bg-amber-500/[0.05]'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2.5">
                            {getStatusIcon(booking.status)}
                            <h3 className="font-semibold text-white">{booking.facilities?.name || 'Unknown Facility'}</h3>
                          </div>
                          <div className="space-y-1.5 text-sm text-white/45">
                            <p className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {booking.date}</p>
                            <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {formatTimePeriod(booking.start_time, booking.end_time)}</p>
                            <p className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Capacity: {booking.facilities?.capacity || '?'}</p>
                            <p className="text-xs text-white/25 mt-1">Booked on: {formatDate(booking.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={booking.status}>{booking.status}</Badge>
                          {(booking.status === 'approved' || booking.status === 'pending') && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={loading}
                              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="mt-3 pt-3 border-t border-amber-500/10">
                          <p className="text-sm text-amber-400/60">Your booking is pending approval from the facility manager.</p>
                        </div>
                      )}
                      {booking.status === 'rejected' && (
                        <div className="mt-3 pt-3 border-t border-red-500/10">
                          <p className="text-sm text-red-400/60">This booking was rejected. Please try a different date/time or contact the facility manager.</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
}
