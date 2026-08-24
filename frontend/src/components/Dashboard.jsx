import React, { useState, useEffect, useRef } from 'react';

export default function Dashboard({ token, user, apiBaseUrl, onLogout }) {
  const [meetings, setMeetings] = useState([]);
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [customGroqKey, setCustomGroqKey] = useState(localStorage.getItem('custom_groq_key') || '');
  
  // Ingestion states
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Active view tab state
  const [activeTab, setActiveTab] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);


  // Load meetings history list
  const fetchMeetings = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/meetings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    }
  };

  useEffect(() => {
    fetchMeetings();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Save custom Groq Key
  const handleKeyChange = (e) => {
    const key = e.target.value;
    setCustomGroqKey(key);
    localStorage.setItem('custom_groq_key', key);
  };

  // Fetch full details of active meeting
  const fetchMeetingDetails = async (id) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/meetings/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveMeeting(data);
        
        // If status is done/failed, make sure we stop polling
        if (data.status === 'done' || data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            fetchMeetings(); // Refresh history list
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch meeting details:', err);
    }
  };

  // Poll status endpoint
  const startPolling = (id) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    fetchMeetingDetails(id); // Initial load
    pollIntervalRef.current = setInterval(() => {
      fetchMeetingDetails(id);
    }, 2000);
  };

  useEffect(() => {
    if (activeMeetingId) {
      startPolling(activeMeetingId);
    } else {
      setActiveMeeting(null);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [activeMeetingId]);

  // Handle meeting upload
  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select an audio file.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (customGroqKey) formData.append('custom_groq_api_key', customGroqKey);

    try {
      const response = await fetch(`${apiBaseUrl}/api/meetings/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed.');
      }

      setFile(null);
      setTitle('');
      setActiveMeetingId(data.id);
      fetchMeetings();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Handle meeting delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/meetings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setActiveMeetingId(null);
        fetchMeetings();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Toggle action item status
  const handleToggleActionItem = async (itemId, isCompleted) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/meetings/${activeMeetingId}/action-items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isCompleted })
      });

      if (response.ok) {
        fetchMeetingDetails(activeMeetingId);
      }
    } catch (err) {
      console.error('Failed to update action item:', err);
    }
  };

  // Format Date Helper
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Download Report compilation
  const downloadReport = () => {
    if (!activeMeeting) return;

    const meet = activeMeeting;
    let md = `# Meeting Summary: ${meet.title}\n\n`;
    md += `**Date:** ${formatDate(meet.createdAt)}\n\n`;
    md += `## Summary\n${meet.summary?.summaryText || 'No summary available.'}\n\n`;
    
    md += `## Key Decisions\n`;
    const decisions = meet.summary?.decisions ? JSON.parse(JSON.stringify(meet.summary.decisions)) : [];
    decisions.forEach(dec => {
      md += `- [DECISION] ${dec}\n`;
    });
    md += `\n`;

    md += `## Action Items\n`;
    meet.actionItems.forEach(item => {
      const status = item.isCompleted ? '[x]' : '[ ]';
      const owner = item.owner ? ` (Owner: ${item.owner})` : '';
      const due = item.dueDate ? ` (Due: ${item.dueDate})` : '';
      md += `- ${status} ${item.task}${owner}${due}\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meet.title.replace(/\s+/g, '_')}_summary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculate metrics
  const totalMeetings = meetings.length;
  const doneMeetings = meetings.filter(m => m.status === 'done').length;
  const runningMeetings = meetings.filter(m => ['uploaded', 'transcribing', 'summarizing'].includes(m.status)).length;
  
  const totalActions = activeMeeting?.actionItems?.length || 0;
  const completedActions = activeMeeting?.actionItems?.filter(i => i.isCompleted).length || 0;
  const progressPct = totalActions > 0 ? (completedActions / totalActions) * 100 : 0;

  // Search Transcript text highlighting
  const renderHighlightedTranscript = () => {
    const text = activeMeeting?.transcript?.text;
    if (!text) return 'No transcript text parsed.';
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) 
        ? <mark key={index} style={{ backgroundColor: '#a7f3d0', color: '#064e3b', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> 
        : part
    );
  };

  return (
    <div className="dashboard-layout">
      {/* 1. Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-title">Past Meetings</div>
          <button 
            className="btn-solid" 
            style={{ width: '100%', padding: '12px', fontSize: '0.85rem', marginBottom: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setActiveMeetingId(null)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
            New Meeting
          </button>
          
          <div className="sidebar-list">
            {meetings.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }}>No transcriptions yet.</p>
            ) : (
              meetings.map(m => (
                <button
                  key={m.id}
                  className={`sidebar-item ${activeMeetingId === m.id ? 'active' : ''}`}
                  onClick={() => setActiveMeetingId(m.id)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.status === 'done' && <svg width="14" height="14" fill="none" stroke="#047857" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {m.status === 'failed' && <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {['uploaded', 'transcribing', 'summarizing'].includes(m.status) && (
                      <div className="loading-ring" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }}></div>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Global Key Settings */}
        <div>
          <hr style={{ borderColor: '#e5e7eb', margin: '20px 0 16px 0' }} />
          <h5 style={{ color: '#022c22', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 005 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Override Groq API Key
          </h5>
          <input
            type="password"
            className="form-control"
            style={{ padding: '8px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
            value={customGroqKey}
            onChange={handleKeyChange}
            placeholder="gsk_your_key..."
          />
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main className="dashboard-main">
        {/* Top Header */}
        <div className="dashboard-header">
          <div>
            <h2 style={{ fontSize: '1.75rem', color: '#022c22', fontWeight: 800, letterSpacing: '-0.5px' }}>Minutely Workspace</h2>
          </div>
          <div className="user-profile">
            <div>
              <div className="profile-name">{user.name || 'Account Owner'}</div>
              <div className="profile-email">{user.email}</div>
              <button className="btn-logout" onClick={onLogout}>Log Out</button>
            </div>
            {user.avatarUrl && !avatarError ? (
              <img 
                src={user.avatarUrl} 
                className="profile-pic" 
                alt="Avatar" 
                onError={() => setAvatarError(true)}
              />
            ) : (
              <svg viewBox="0 0 100 100" style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1.5px solid #a7f3d0' }}>
                <circle cx="50" cy="50" r="50" fill="#ecfdf5" />
                <path d="M50 20a15 15 0 1 0 0 30 15 15 0 0 0 0-30zM50 58c-20 0-36 10-36 22h72c0-12-16-22-36-22z" fill="#047857" />
              </svg>
            )}
          </div>
        </div>

        <hr style={{ borderColor: '#e5e7eb', margin: '8px 0 16px 0' }} />

        {/* View Router */}
        {!activeMeetingId ? (
          /* --- METRICS & UPLOADER SCREEN --- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Stats Summary Panel */}
            <div className="stats-grid">
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Total Meetings</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#022c22' }}>{totalMeetings}</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#047857', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Pipelines Completed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#022c22' }}>{doneMeetings}</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fff7ed', color: '#c2410c', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>Processing Queue</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#022c22' }}>{runningMeetings}</div>
                </div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="upload-card">
              <h3 style={{ marginBottom: '6px', color: '#022c22', fontWeight: 800 }}>Upload Meeting Recording</h3>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '24px' }}>
                Ingest meeting audio to automatically trigger Whisper speech-to-text ASR, parse summaries, and generate checklists.
              </p>
              
              {error && (
                <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleUpload}>
                <div className="form-group">
                  <label>Meeting Title (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Q3 Design Sync, Marketing Planning"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div 
                  className="file-dropzone"
                  onClick={() => fileInputRef.current.click()}
                  style={{ padding: '30px' }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".mp3,.wav,.m4a,.webm"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: '12px', color: '#6b7280' }}>
                    <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v5a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="dropzone-text" style={{ fontSize: '0.9rem' }}>
                    {file ? file.name : 'Select or drag & drop meeting recording'}
                  </div>
                  <p className="dropzone-sub" style={{ fontSize: '0.75rem' }}>Supported formats: .mp3, .wav, .m4a, .webm (Max 25MB)</p>
                </div>

                <button 
                  type="submit" 
                  className="btn-solid" 
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={uploading || !file}
                >
                  {uploading ? (
                    <>
                      <div className="loading-ring" style={{ width: '14px', height: '14px', borderTopColor: 'white', borderWidth: '2px' }}></div>
                      Uploading meeting file...
                    </>
                  ) : (
                    <>
                      Transcribe & Summarize
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* --- MEETING VIEW WORKSPACE --- */
          activeMeeting && (
            <div>
              {/* Pipeline processing screens */}
              {['uploaded', 'transcribing', 'summarizing'].includes(activeMeeting.status) ? (
                <div className="processing-card">
                  <div className="loading-ring"></div>
                  <div className="processing-status">
                    {activeMeeting.status === 'uploaded' && 'File saved. Registering meeting details...'}
                    {activeMeeting.status === 'transcribing' && 'Transcribing voice to text using Groq Whisper...'}
                    {activeMeeting.status === 'summarizing' && 'Analyzing transcript with LLaMA 3.1 JSON mode...'}
                  </div>
                  <p className="processing-sub">Our pipeline is running in the background. Status updates in real-time.</p>
                </div>
              ) : activeMeeting.status === 'failed' ? (
                <div className="processing-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <svg width="48" height="48" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24" style={{ marginBottom: '16px', display: 'inline-block' }}>
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h3 style={{ color: '#ef4444', marginBottom: '10px', fontWeight: 800 }}>Pipeline Processing Failed</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
                    The backend encountered an error. Please verify your custom Groq API key is valid and has sufficient request limits.
                  </p>
                  <button className="btn-solid" style={{ backgroundColor: '#dc2626' }} onClick={() => handleDelete(activeMeeting.id)}>
                    Delete Record & Return
                  </button>
                </div>
              ) : (
                /* Done state analytics details */
                <div>
                  
                  {/* Summary header details card */}
                  <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                      <h2 style={{ color: '#022c22', fontWeight: 800, fontSize: '1.5rem', marginBottom: '4px' }}>{activeMeeting.title}</h2>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600 }}>Parsed on: {formatDate(activeMeeting.createdAt)}</span>
                      
                      {/* Audio playback details */}
                      {activeMeeting.audioUrl && (
                        <div style={{ marginTop: '16px' }}>
                          <audio controls className="audio-player" src={activeMeeting.audioUrl} style={{ height: '40px', maxWidth: '320px' }}></audio>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px' }} onClick={downloadReport}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Download Report
                      </button>
                      <button className="btn-outline" style={{ borderColor: '#fca5a5', color: '#dc2626', padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px' }} onClick={() => handleDelete(activeMeeting.id)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Tabs bar */}
                  <div className="details-tabs">
                    <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                      Interactive Summary
                    </button>
                    <button className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`} onClick={() => setActiveTab('checklist')}>
                      Action Checklist
                    </button>
                    <button className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => setActiveTab('transcript')}>
                      Audio & Transcript
                    </button>
                  </div>

                  {/* Tab contents */}
                  {activeTab === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="report-card">
                        <h3 style={{ fontWeight: 800, color: '#022c22', marginBottom: '12px', fontSize: '1.05rem' }}>Meeting Abstract</h3>
                        <p className="report-summary-text" style={{ fontSize: '0.95rem' }}>{activeMeeting.summary?.summaryText || 'No summary text generated.'}</p>
                      </div>
                      
                      <div className="report-card">
                        <h3 style={{ fontWeight: 800, color: '#022c22', marginBottom: '16px', fontSize: '1.05rem' }}>Key Decisions</h3>
                        {activeMeeting.summary?.decisions?.length === 0 ? (
                          <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>No major decisions recorded in this session.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activeMeeting.summary?.decisions.map((dec, idx) => (
                              <div key={idx} className="decision-item">
                                <span className="capsule-badge" style={{ backgroundColor: '#047857', color: 'white', borderRadius: '6px', fontSize: '0.65rem', padding: '4px 8px' }}>DECISION</span>
                                <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.92rem' }}>{dec}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'checklist' && (
                    <div className="report-card">
                      <h3 style={{ fontWeight: 800, color: '#022c22', marginBottom: '6px', fontSize: '1.05rem' }}>Checklist Tasks</h3>
                      <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '20px' }}>Select completed tasks to sync updates directly with the database.</p>
                      
                      {activeMeeting.actionItems?.length === 0 ? (
                        <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>No checklist items parsed from this recording.</p>
                      ) : (
                        <div>
                          {/* Progress indicator */}
                          <div style={{ marginBottom: '24px', backgroundColor: '#fcfdfd', border: '1px solid #ecfdf5', padding: '16px', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: '#047857', marginBottom: '6px' }}>
                              <span>Project Completion Ratio</span>
                              <span>{Math.round(progressPct)}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease' }}></div>
                            </div>
                          </div>

                          {/* Items checklist */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {activeMeeting.actionItems.map(item => (
                              <div key={item.id} className="checklist-item" style={{ padding: '14px 0' }}>
                                <input
                                  type="checkbox"
                                  className="checklist-checkbox"
                                  checked={item.isCompleted}
                                  onChange={(e) => handleToggleActionItem(item.id, e.target.checked)}
                                />
                                <span className={`checklist-text ${item.isCompleted ? 'completed' : ''}`} style={{ fontSize: '0.92rem' }}>
                                  {item.task}
                                </span>
                                {(item.owner || item.dueDate) && (
                                  <span className="checklist-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {item.owner && (
                                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        {item.owner}
                                      </span>
                                    )}
                                    {item.dueDate && (
                                      <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        {item.dueDate}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'transcript' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Search box header */}
                      <div style={{ backgroundColor: 'white', padding: '16px 20px', border: '1px solid #e5e7eb', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search term or phrase in transcript..."
                          style={{ border: 'none', padding: '0', fontSize: '0.9rem', boxShadow: 'none' }}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <button 
                            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
                            onClick={() => setSearchQuery('')}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Scrollable text box */}
                      <div className="report-card" style={{ padding: '24px' }}>
                        <div className="transcript-scroll" style={{ backgroundColor: 'white', border: 'none', padding: '0', maxHeight: '450px' }}>
                          {renderHighlightedTranscript()}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
