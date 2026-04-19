import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle, Users, Loader } from 'lucide-react';
import "./output.css"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [startTime, setStartTime] = useState(''); // Changed from bookingTime
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

  useEffect(() => { // Update capacity check whenever input changes
    if (selectedFacility && bookingDate && startTime && endTime) {
      const check = checkFacilityCapacity(selectedFacility, bookingDate, startTime, endTime);
      setCapacityCheck(check);
    } else if (selectedFacility) {
      const facilityIdNum = parseInt(selectedFacility);
      const facility = facilities.find(f => f.id === facilityIdNum);

      if (facility) {
        setCapacityCheck({
          available: false,
          remaining: 0,
          totalCapacity: facility.capacity,
          booked: 0,
          timeOverlap: false
        });
      } else {
        setCapacityCheck({
          available: false,
          remaining: 0,
          totalCapacity: 0,
          booked: 0,
          timeOverlap: false
        });
      }
    } else {
      setCapacityCheck({
        available: false,
        remaining: 0,
        totalCapacity: 0,
        booked: 0,
        timeOverlap: false
      });
    }
  }, [selectedFacility, bookingDate, startTime, endTime, bookings, facilities]);

  // Helper function to convert time string to minutes for comparison
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if two time periods overlap
  const checkTimeOverlap = (start1, end1, start2, end2) => {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);

    return (s1 < e2 && e1 > s2);
  };

  // Check capacity with time period
  const checkFacilityCapacity = (facilityId, date, startTime, endTime) => {
    const facilityIdNum = parseInt(facilityId);
    const facility = facilities.find(f => f.id === facilityIdNum);

    if (!facility) {
      console.log('Facility not found:', facilityIdNum);
      return {
        available: false,
        remaining: 0,
        totalCapacity: 0,
        booked: 0,
        timeOverlap: false
      };
    }

    console.log('Checking capacity for:', facility.name, 'from', startTime, 'to', endTime);

    // Find approved bookings that overlap with requested time period
    const overlappingBookings = bookings.filter(b => {
      const bookingFacilityId = typeof b.facility_id === 'string' ? parseInt(b.facility_id) : b.facility_id;
      if (bookingFacilityId !== facilityIdNum || b.date !== date || b.status !== 'approved') {
        return false;
      }

      // Check if time periods overlap
      return checkTimeOverlap(startTime, endTime, b.start_time, b.end_time);
    });

    console.log('Overlapping bookings:', overlappingBookings);

    const remaining = facility.capacity - overlappingBookings.length;
    const timeOverlap = overlappingBookings.length > 0;

    const result = {
      available: remaining > 0,
      remaining: remaining,
      totalCapacity: facility.capacity,
      booked: overlappingBookings.length,
      timeOverlap: timeOverlap
    };

    console.log('Capacity check result:', result);
    return result;
  };

  // Load user profile
  const loadUserProfile = async (userId) => {
    console.log('Loading profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setAuthMessage('Error loading profile: ' + error.message);
        return;
      }

      if (data) {
        console.log('Profile loaded:', data);
        setUserProfile(data);
        setView(data.role === 'boss' ? 'approvals' : 'facilities');
        await loadAllData(data.role);
      }
    } catch (error) {
      console.error('Exception in loadUserProfile:', error);
    }
  };

  // Load all data
  const loadAllData = async (role) => {
    console.log('Loading all data for role:', role);
    await loadFacilities();
    await loadBookings(role);
  };

  // Load facilities
  const loadFacilities = async () => {
    console.log('Loading facilities...');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading facilities:', error);
        setAuthMessage('Error loading facilities: ' + error.message);
        return;
      }

      console.log('Facilities loaded:', data);
      setFacilities(data || []);
    } catch (error) {
      console.error('Exception in loadFacilities:', error);
      setAuthMessage('Exception loading facilities: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check current time of when user book a facility
  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'Date not available' : date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date not available';
    }
  };

  // Added client cancel booking function
  const handleCancelBooking = async (bookingId) => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this booking?');
    if (!confirmCancel) return;
    setLoading(true);
    setAuthMessage('');
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setAuthMessage('Booking cancelled successfully!');

      // Reload bookings
      await loadBookings(userProfile.role);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setAuthMessage('');
      }, 3000);

    } catch (error) {
      console.error('Error cancelling booking:', error);
      setAuthMessage('Error cancelling booking: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle booking
  const handleBooking = async () => {
    console.log('=== START handleBooking ===');
    console.log('Selected facility:', selectedFacility);
    console.log('Booking date:', bookingDate);
    console.log('Start time:', startTime);
    console.log('End time:', endTime);

    // Validate time period
    if (startTime >= endTime) {
      setAuthMessage('End time must be after start time');
      return;
    }

    if (!selectedFacility || !bookingDate || !startTime || !endTime) {
      alert('Please fill in all fields');
      return;
    }

    const capacityCheckResult = checkFacilityCapacity(selectedFacility, bookingDate, startTime, endTime);
    if (!capacityCheckResult.available) {
      setAuthMessage(`This facility is fully booked for the selected time period. Capacity: ${capacityCheckResult.totalCapacity}, Already booked: ${capacityCheckResult.booked}`);
      return;
    }

    if (capacityCheckResult.timeOverlap) {
      setAuthMessage('Warning: Your selected time period overlaps with existing bookings. Please check availability.');
      return;
    }

    setLoading(true);
    setAuthMessage('');
    try {
      console.log('Inserting booking...');
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          facility_id: parseInt(selectedFacility),
          user_id: currentUser.id,
          date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          status: 'pending'
        })
        .select();

      console.log('Booking insert result:', { data, error });

      if (error) throw error;

      setAuthMessage('Booking request sent for approval!');

      // Clear form
      setSelectedFacility('');
      setBookingDate('');
      setStartTime('');
      setEndTime('');

      // Wait and reload data
      setTimeout(async () => {
        console.log('Reloading data after booking...');
        await loadBookings(userProfile.role);
        setTimeout(() => {
          setAuthMessage('');
        }, 3000);
      }, 1000);

    } catch (error) {
      console.error('Booking error details:', error);
      alert('Booking error: ' + error.message);
    } finally {
      setLoading(false);
      console.log('=== END handleBooking ===');
    }
  };

  // Load bookings  
  const loadBookings = async (role) => {
    console.log('Loading bookings for role:', role);
    console.log('Current user ID:', currentUser?.id);

    try {
      // Build query based on role
      let query = supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      // If client, only get their bookings
      if (role !== 'boss') {
        query = query.eq('user_id', currentUser?.id);
      }

      const { data: bookingsData, error: bookingsError } = await query;

      if (bookingsError) {
        console.error('Bookings query error:', bookingsError);
        throw bookingsError;
      }

      console.log('Raw bookings data:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No bookings found');
        setBookings([]);
        return;
      }

      // Enrich bookings with facility and user info
      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          console.log('Processing booking:', booking);

          // Get facility info
          let facilityInfo = { name: 'Unknown Facility', capacity: 0 };
          if (booking.facility_id) {
            try {
              const { data: facilityData } = await supabase
                .from('facilities')
                .select('name, capacity')
                .eq('id', booking.facility_id)
                .single();

              if (facilityData) {
                facilityInfo = facilityData;
              }
            } catch (facilityError) {
              console.error('Error fetching facility:', facilityError);
            }
          }

          // Get user profile info
          let userInfo = { name: 'Unknown User', role: 'client' };
          if (booking.user_id && role === 'boss') {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('name, role')
                .eq('id', booking.user_id)
                .single();

              if (profileData) {
                userInfo = profileData;
              } else {
                // Fallback: try to get from auth.users
                const { data: authData } = await supabase.auth.admin.getUserById(booking.user_id);
                if (authData?.user) {
                  userInfo = {
                    name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Unknown User',
                    role: 'client'
                  };
                }
              }
            } catch (profileError) {
              console.error('Error fetching profile:', profileError);
            }
          }

          // For client view, use their own profile
          if (role !== 'boss' && booking.user_id === currentUser?.id && userProfile) {
            userInfo = {
              name: userProfile.name,
              role: userProfile.role
            };
          }

          return {
            ...booking,
            facilities: facilityInfo,
            profiles: userInfo
          };
        })
      );

      console.log('Final enriched bookings:', enrichedBookings);
      setBookings(enrichedBookings);

    } catch (error) {
      console.error('Error in loadBookings:', error);
      setBookings([]);
    }
  };

  // Format time period display
  const formatTimePeriod = (startTime, endTime) => {
    return `${startTime} - ${endTime}`;
  };

  // Handle signup
  const handleSignup = async () => {
    if (!email || !password || !name) {
      setAuthMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setAuthMessage('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name }
        }
      });

      if (authError) {
        // If user exists, try to sign in
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) {
            setAuthMessage('Email already registered. Please use correct password.');
            return;
          }

          // User signed in successfully
          setCurrentUser(signInData.user);
          await loadUserProfile(signInData.user.id);
          setAuthMessage('');
          return;
        }
        throw authError;
      }

      if (authData.user) {
        // Create profile with role 'client'
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            name: name,
            role: 'client'
          });

        if (profileError && !profileError.message.includes('duplicate key')) {
          throw profileError;
        }

        setAuthMessage('Account created successfully! Please sign in.');
        setIsAuthMode('login');
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setAuthMessage('Signup error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!email || !password) {
      setAuthMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        console.log('Login successful:', data.user);
        setCurrentUser(data.user);
        await loadUserProfile(data.user.id);
        setEmail('');
        setPassword('');
        setAuthMessage('');
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthMessage('Login error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
    setView('login');
    setFacilities([]);
    setBookings([]);
    setAuthMessage('');
  };

  // Handle approval
  const handleApproval = async (bookingId, status) => {
    console.log('Approving booking:', bookingId, 'status:', status);
    setLoading(true);
    setAuthMessage(''); // Clear previous messages
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) throw error;

      await loadBookings(userProfile.role);
      setAuthMessage(`Booking ${status} successfully!`);
      // Clear success message after 3 seconds
      setTimeout(() => {
        setAuthMessage('');
      }, 3000);

    } catch (error) {
      alert('Approval error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle add facility
  const handleAddFacility = async () => {
    if (!facilityName || !facilityCapacity) {
      setAuthMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    setAuthMessage('');
    try {
      const { error } = await supabase
        .from('facilities')
        .insert({
          name: facilityName,
          capacity: parseInt(facilityCapacity)
        });

      if (error) throw error;

      setAuthMessage('Facility added successfully!');
      setFacilityName('');
      setFacilityCapacity('');
      await loadFacilities();

      // Clear success message after 2.5 seconds
      setTimeout(() => {
        setAuthMessage('');
      }, 2500);

    } catch (error) {
      alert('Error adding facility: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete facility
  const handleDeleteFacility = async (facilityId) => {
    const hasBookings = bookings.some(b => b.facility_id === facilityId);
    if (hasBookings) {
      const confirmDelete = window.confirm('This facility has existing bookings. Are you sure you want to delete it?');
      if (!confirmDelete) return;
    }

    setLoading(true);
    try {
      // Delete related bookings first
      await supabase
        .from('bookings')
        .delete()
        .eq('facility_id', facilityId);

      // Then delete facility
      const { error } = await supabase
        .from('facilities')
        .delete()
        .eq('id', facilityId);

      if (error) throw error;

      setAuthMessage('Facility deleted successfully!');
      await loadFacilities();
      await loadBookings(userProfile.role);
      // Clear success message after 2.2 seconds
      setTimeout(() => {
        setAuthMessage('');
      }, 2200);

    } catch (error) {
      setAuthMessage('Error deleting facility: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // function for boss to delete any booking
  const handleCancelBookingForBoss = async (bookingId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this booking?');
    if (!confirmDelete) return;

    setLoading(true);
    setAuthMessage('');
    try {
      console.log('Deleting booking ID:', bookingId);

      const { error, data } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .select();

      console.log('Delete result:', { error, data });

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      setAuthMessage('Booking deleted successfully!');

      // Reload bookings
      await loadBookings(userProfile.role);
      await loadFacilities(); // Also reload facilities to update counts

      // Clear success message after 3 seconds
      setTimeout(() => {
        setAuthMessage('');
      }, 3000);

    } catch (error) {
      console.error('Error deleting booking:', error);
      setAuthMessage('Error deleting booking: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getPendingBookings = () => {
    if (userProfile?.role !== 'boss') return [];
    return bookings.filter(b => b.status === 'pending');
  };

  const getUserBookings = () => {
    return bookings.filter(b => b.user_id === currentUser?.id);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  // Login/Signup View
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
        <div className="group relative w-full max-w-md">
          {/* Animated glow */}
          <div className="absolute -inset-1 rounded-2xl opacity-60 blur-lg transition duration-1000 group-hover:opacity-90" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2, #6B8DD6)' }}></div>

          {/* Glass card */}
          <div className="relative rounded-2xl p-8 w-full" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#fff', letterSpacing: '-0.02em' }}>SAF Facility Booking</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>
                {isAuthMode === 'login' ? 'Welcome back — sign in to continue' : 'Create your account to get started'}
              </p>
            </div>

            {authMessage && (
              <div className={`mb-5 p-3 rounded-xl text-sm font-medium ${authMessage.includes('success') ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                {authMessage}
              </div>
            )}

            <div className="space-y-4">
              {isAuthMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="Enter your name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (isAuthMode === 'login' ? handleLogin() : handleSignup())}
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                  placeholder="••••••••"
                />
              </div>

              <button
                onClick={isAuthMode === 'login' ? handleLogin : handleSignup}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 8px 20px rgba(102,126,234,0.4)' }}
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {isAuthMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <div className="text-center pt-2">
                <button
                  onClick={() => setIsAuthMode(isAuthMode === 'login' ? 'signup' : 'login')}
                  className="text-sm transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  {isAuthMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                    {isAuthMode === 'login' ? 'Sign up' : 'Sign in'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Boss Approval View 
  if (view === 'approvals' && userProfile?.role === 'boss') {
    const pendingBookings = getPendingBookings();
    console.log('Boss view - Pending bookings:', pendingBookings);

    return (
      <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto">
          {/* Nav Header */}
          <div className="rounded-2xl p-5 mb-6 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Boss Dashboard</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Welcome back, <span style={{ color: '#a78bfa' }}>{userProfile.name}</span></p>
              <p className="text-sm mt-1" style={{ color: '#fbbf24' }}>
                {pendingBookings.length} pending booking{pendingBookings.length !== 1 ? 's' : ''} awaiting approval
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('approvals')}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={view === 'approvals' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Approvals ({pendingBookings.length})
              </button>
              <button
                onClick={() => setView('manage-facilities')}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={view === 'manage-facilities' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Manage Facilities
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold text-white">Pending Approvals</h2>
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                {pendingBookings.length} pending
              </span>
            </div>

            {authMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${authMessage.includes('success') || authMessage.includes('approved') || authMessage.includes('rejected')
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                {authMessage}
              </div>
            )}

            {pendingBookings.length === 0 ? (
              <div className="text-center py-14">
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#34d399' }} />
                <p className="text-lg font-medium text-white">All clear!</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>No pending bookings to approve</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBookings.map(booking => (
                  <div key={booking.id} className="rounded-xl p-4 transition-all" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-5 h-5" style={{ color: '#fbbf24' }} />
                          <h3 className="font-semibold text-lg text-white">{booking.facilities?.name || 'Unknown Facility'}</h3>
                        </div>
                        <div className="space-y-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4" /><span className="font-medium text-white/80">Booked by:</span> {booking.profiles?.name || 'Unknown User'}</div>
                          <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4" /><span className="font-medium text-white/80">Date:</span> {booking.date}</div>
                          <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4" /><span className="font-medium text-white/80">Time:</span> {formatTimePeriod(booking.start_time, booking.end_time)}</div>
                          <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4" /><span className="font-medium text-white/80">Capacity:</span> {booking.facilities?.capacity || 'Unknown'} people</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleApproval(booking.id, 'approved')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval(booking.id, 'rejected')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Boss Facility Management View  
  if (view === 'manage-facilities' && userProfile?.role === 'boss') {
    return (
      <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl p-5 mb-6 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Boss Dashboard</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Welcome back, <span style={{ color: '#a78bfa' }}>{userProfile.name}</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('approvals')}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={view === 'approvals' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Approvals ({getPendingBookings().length})
              </button>
              <button
                onClick={() => setView('manage-facilities')}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={view === 'manage-facilities' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Manage Facilities
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-semibold text-white mb-5">Add New Facility</h2>

              {authMessage && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${authMessage.includes('success')
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                  {authMessage}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Facility Name</label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="e.g., Conference Room A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Capacity</label>
                  <input
                    type="number"
                    value={facilityCapacity}
                    onChange={(e) => setFacilityCapacity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-white/30 outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    placeholder="e.g., 10"
                    min="1"
                  />
                </div>

                <button
                  onClick={handleAddFacility}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 8px 20px rgba(102,126,234,0.4)' }}
                >
                  {loading ? 'Adding...' : 'Add Facility'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-semibold text-white">Existing Facilities</h2>
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: 'rgba(102,126,234,0.2)', color: '#a78bfa', border: '1px solid rgba(102,126,234,0.3)' }}>
                  {facilities.length} facilities
                </span>
              </div>

              {facilities.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg font-medium text-white">No facilities yet</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Add a facility to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {facilities.map(facility => {
                    const facilityBookings = bookings.filter(b => b.facility_id === facility.id);
                    const pendingBookings = facilityBookings.filter(b => b.status === 'pending');
                    const approvedBookings = facilityBookings.filter(b => b.status === 'approved');

                    return (
                      <div key={facility.id} className="rounded-xl p-4 transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="flex justify-between items-start">
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => setExpandedFacility(expandedFacility === facility.id ? null : facility.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-white">{facility.name}</h3>
                                <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                  <Users className="w-4 h-4" />
                                  Capacity: {facility.capacity} people
                                </p>
                              </div>
                              <svg
                                className={`w-5 h-5 transform transition-transform ${expandedFacility === facility.id ? 'rotate-180' : ''}`}
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            <div className="flex gap-2 mt-2">
                              {approvedBookings.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                                  {approvedBookings.length} approved
                                </span>
                              )}
                              {pendingBookings.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                  {pendingBookings.length} pending
                                </span>
                              )}
                              {facilityBookings.length === 0 && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                  No bookings
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteFacility(facility.id)}
                            disabled={loading}
                            className="px-3 py-1.5 text-sm rounded-xl font-medium transition-all disabled:opacity-50 ml-4"
                            style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
                          >
                            Delete
                          </button>
                        </div>
                        {/* Expanded Booking Details */}
                        {expandedFacility === facility.id && facilityBookings.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-medium text-gray-700 mb-2">Booking Details:</h4>
                            <div className="space-y-2">
                              {facilityBookings.map(booking => (
                                <div
                                  key={booking.id}
                                  className={`p-2 rounded text-sm ${booking.status === 'approved' ? 'bg-green-50 border border-green-200' :
                                    booking.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
                                      'bg-red-50 border border-red-200'
                                    }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium">{booking.profiles?.name || 'Unknown User'}</span>
                                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${booking.status === 'approved' ? 'bg-green-200 text-green-800' :
                                        booking.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                                          'bg-red-200 text-red-800'
                                        }`}>
                                        {booking.status}
                                      </span>
                                    </div>
                                    <div className="text-gray-600">
                                      {booking.date} at {formatTimePeriod(booking.start_time, booking.end_time)}
                                    </div>
                                  </div>
                                  <div className="mt-1 flex gap-2">
                                    {booking.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApproval(booking.id, 'approved');
                                          }}
                                          className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApproval(booking.id, 'rejected');
                                          }}
                                          className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelBookingForBoss(booking.id);
                                      }}
                                      className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {expandedFacility === facility.id && facilityBookings.length === 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 text-center text-gray-500 text-sm">
                            No bookings for this facility
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Client View
  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl p-5 mb-6 flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Facility Booking</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>Welcome back, <span style={{ color: '#a78bfa' }}>{userProfile?.name}</span></p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('facilities')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={view === 'facilities' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Book Facility
            </button>
            <button
              onClick={() => setView('mybookings')}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={view === 'mybookings' ? { background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' } : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              My Bookings ({getUserBookings().length})
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              Logout
            </button>
          </div>
        </div>

        {view === 'facilities' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-semibold mb-4">Available Facilities</h2>
              <div className="space-y-3">
                {facilities.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white">No facilities available for booking</p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Contact administrator to add facilities</p>
                  </div>
                ) : (
                  facilities.map(facility => {
                    const facilityBookings = bookings.filter(
                      b => b.facility_id === facility.id && b.status === 'approved'
                    );
                    const pendingBookings = bookings.filter(
                      b => b.facility_id === facility.id &&
                        b.user_id === currentUser?.id &&
                        b.status === 'pending'
                    );

                    return (
                      <div key={facility.id} className="rounded-xl p-4 transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{facility.name}</h3>
                            <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              <Users className="w-4 h-4" />
                              Capacity: {facility.capacity} people
                            </p>
                            {pendingBookings.length > 0 && (
                              <p className="text-sm mt-1" style={{ color: '#fbbf24' }}>
                                You have {pendingBookings.length} pending booking{pendingBookings.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        {facilityBookings.length > 0 && (
                          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <p className="font-medium text-sm mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Current Bookings:</p>
                            <div className="space-y-1">
                              {facilityBookings.map(b => (
                                <p key={b.id} className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                  • {b.date} at {formatTimePeriod(b.start_time, b.end_time)} - {b.profiles?.name || 'Unknown'}
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
            </div>

            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-semibold text-white mb-5">Make a Booking</h2>
              {authMessage && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${authMessage.includes('success') || authMessage.includes('sent for approval')
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                  {authMessage}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Select Facility</label>
                  <select
                    value={selectedFacility}
                    onChange={(e) => setSelectedFacility(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <option value="" style={{ background: '#302b63' }}>Choose a facility...</option>
                    {facilities.map(f => (
                      <option key={f.id} value={f.id} style={{ background: '#302b63' }}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 rounded-xl text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', colorScheme: 'dark' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', colorScheme: 'dark' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', colorScheme: 'dark' }}
                  />
                </div>

                {/* Capacity check display */}
                {selectedFacility && (
                  <div className={`p-3 rounded-lg ${(bookingDate && startTime && endTime && capacityCheck.available && !capacityCheck.timeOverlap)
                    ? 'bg-green-50 border border-green-200' :
                    (bookingDate && startTime && endTime && (!capacityCheck.available || capacityCheck.timeOverlap))
                      ? 'bg-red-50 border border-red-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}>
                    <p className={`text-sm font-medium ${(bookingDate && startTime && endTime && capacityCheck.available && !capacityCheck.timeOverlap)
                      ? 'text-green-700' :
                      (bookingDate && startTime && endTime && (!capacityCheck.available || capacityCheck.timeOverlap))
                        ? 'text-red-700' :
                        'text-blue-700'
                      }`}>
                      {(() => {
                        const facilityIdNum = parseInt(selectedFacility);
                        const facility = facilities.find(f => f.id === facilityIdNum);

                        if (!facility) {
                          return 'Facility not found';
                        }

                        if (!bookingDate || !startTime || !endTime) {
                          return `🏢 ${facility.name}: ${facility.capacity} person capacity. Select date and time period to check availability.`;
                        }

                        if (startTime >= endTime) {
                          return '❌ End time must be after start time';
                        }

                        if (!capacityCheck.available) {
                          return `❌ Facility fully booked for this time period!`;
                        }

                        if (capacityCheck.timeOverlap) {
                          return `⚠️ Time period overlaps with ${capacityCheck.booked} existing booking(s). ${capacityCheck.remaining} spot(s) remaining.`;
                        }

                        return `✅ ${capacityCheck.remaining} spot(s) remaining out of ${capacityCheck.totalCapacity} total capacity`;
                      })()}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleBooking}
                  disabled={loading || !selectedFacility || !bookingDate || !startTime || !endTime ||
                    startTime >= endTime || (bookingDate && startTime && endTime && !capacityCheck.available)}
                  className={`w-full py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${(selectedFacility && bookingDate && startTime && endTime &&
                    startTime < endTime && capacityCheck.available && !capacityCheck.timeOverlap)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {loading && <Loader className="w-4 h-4 animate-spin" />}
                  {loading ? 'Processing...' :
                    !selectedFacility ? 'Select a facility' :
                      !bookingDate ? 'Select a date' :
                        !startTime ? 'Select start time' :
                          !endTime ? 'Select end time' :
                            startTime >= endTime ? 'End time must be after start time' :
                              !capacityCheck.available ? 'Facility Fully Booked' :
                                'Submit Booking Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'mybookings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">My Bookings</h2>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {getUserBookings().length} booking{getUserBookings().length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => loadBookings(userProfile.role)}
                  disabled={loading}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  {loading ? (
                    <Loader className="w-3 h-3 animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Refresh
                </button>
              </div>
            </div>

            {getUserBookings().length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-2">No bookings yet</p>
                <p className="text-gray-400 text-sm">Book a facility to get started!</p>
                <button
                  onClick={() => setView('facilities')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Book a Facility
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {getUserBookings().map(booking => (
                  <div key={booking.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${booking.status === 'approved' ? 'border-green-200 bg-green-50' :
                    booking.status === 'rejected' ? 'border-red-200 bg-red-50' :
                      'border-yellow-200 bg-yellow-50'
                    }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(booking.status)}
                          <h3 className="font-semibold text-lg text-gray-800">
                            {booking.facilities?.name || 'Unknown Facility'}
                          </h3>
                        </div>
                        <div className="mt-2 space-y-1 text-gray-600">
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {booking.date}
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {formatTimePeriod(booking.start_time, booking.end_time)}
                          </p>
                          <p className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Capacity: {booking.facilities?.capacity || 'Unknown'} people
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            Booked on: {formatDate(booking.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-medium capitalize ${booking.status === 'approved' ? 'text-green-700' :
                          booking.status === 'rejected' ? 'text-red-700' :
                            'text-yellow-700'
                          }`}>
                          {booking.status}
                        </span>
                        {/* Add Cancel button for approved and pending bookings */}
                        {(booking.status === 'approved' || booking.status === 'pending') && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {booking.status === 'pending' && (
                      <div className="mt-4 pt-3 border-t border-yellow-200">
                        <p className="text-sm text-yellow-700">
                          Your booking is pending approval from the facility manager.
                        </p>
                      </div>
                    )}

                    {booking.status === 'rejected' && (
                      <div className="mt-4 pt-3 border-t border-red-200">
                        <p className="text-sm text-red-700">
                          This booking was rejected. Please try a different date/time or contact the facility manager.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}