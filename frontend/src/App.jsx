import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [page, setPage] = useState(() => {
    return localStorage.getItem('token') ? 'dashboard' : 'landing';
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    return null;
  });

  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // Verify session token validity on load
  useEffect(() => {
    if (token) {
      fetchUserProfile(token);
    }
  }, [token]);


  // Handle Google OAuth Callback parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // Clear URL parameters immediately to prevent duplicate requests in React StrictMode
      window.history.replaceState({}, document.title, window.location.pathname);
      exchangeGoogleCode(code);
    }
  }, []);


  const fetchUserProfile = async (authToken) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const profile = await response.json();
        setUser(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      } else {
        // Token might be expired
        handleLogout();
      }
    } catch (e) {
      console.error('Failed to verify token profile:', e);
    }
  };

  const exchangeGoogleCode = async (authCode) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: window.location.origin
        })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setPage('dashboard');
        
        // Clean URL parameter in browser without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('Google OAuth exchange error:', data.detail);
        alert(`Google Authentication Failed: ${data.detail || 'Verify OAuth redirect configuration in Google Cloud Console'}`);
        setPage('auth');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error('Google OAuth network error:', err);
      alert(`Network Error: Could not connect to API server at ${apiBaseUrl}`);
      setPage('auth');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleLoginSuccess = (accessToken, userProfile) => {
    setToken(accessToken);
    setUser(userProfile);
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(userProfile));
    setPage('dashboard');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setPage('landing');
  };

  return (
    <>
      {/* Background radial-gradients and patterns */}
      <div className="bg-grid"></div>
      <div className="bg-glow"></div>

      
      {/* View router switcher */}
      {page === 'landing' && (
        <LandingPage onGetStarted={() => setPage(token ? 'dashboard' : 'auth')} />
      )}
      {page === 'auth' && (
        <AuthPage 
          apiBaseUrl={apiBaseUrl} 
          onLoginSuccess={handleLoginSuccess} 
          onBackToLanding={() => setPage('landing')} 
        />
      )}
      {page === 'dashboard' && token && !user && (
        <div className="processing-card" style={{ margin: '120px auto' }}>
          <div className="loading-ring"></div>
          <div className="processing-status">Loading Workspace...</div>
        </div>
      )}
      {page === 'dashboard' && token && user && (
        <Dashboard 
          token={token} 
          user={user} 
          apiBaseUrl={apiBaseUrl} 
          onLogout={handleLogout} 
        />
      )}
    </>

  );
}
