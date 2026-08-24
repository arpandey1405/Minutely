import React, { useState } from 'react';

export default function LandingPage({ onGetStarted }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Confirm system API integration', owner: 'Arpan', completed: true },
    { id: 2, text: 'Test Google OAuth redirect links', owner: 'Arpan', completed: false },
    { id: 3, text: 'Verify audio uploads fallback storage', owner: 'Arpan', completed: false }
  ]);
  const [activeAccordion, setActiveAccordion] = useState('times');

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;

  // Smooth scroll handler
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="container">
      {/* 1. Navigation Header */}
      <header className="navbar">
        <div className="logo-container" onClick={onGetStarted}>
          <div className="logo-box">M</div>
          <span className="logo-text">Minutely</span>
        </div>
        <div className="nav-links">
          <span onClick={() => scrollToSection('features')}>Features</span>
          <span onClick={() => scrollToSection('value-prop')}>How it Works</span>
          <span onClick={() => onGetStarted()}>Try Feature</span>
        </div>
        <div>
          <button className="btn-solid" style={{ padding: '10px 24px', fontSize: '0.85rem' }} onClick={onGetStarted}>Launch App</button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="hero">
        <div className="badge">🟢 AI-Powered Meeting Summarization</div>
        <h1 className="hero-title">
          Turn meeting audio into<br />actionable summaries
        </h1>
        <p className="hero-sub">
          Upload your meeting recordings (.mp3, .wav, .m4a) and let AI automatically transcribe them, extract key decisions, and generate checkable action checklists in seconds.
        </p>
        <div className="hero-ctas">
          <button className="btn-solid" onClick={onGetStarted}>Try Feature Free &rarr;</button>
        </div>
      </section>

      {/* 3. Floating Graphic Representation (AI Meeting Mockups) */}
      <section className="illustration-block">
        <div className="illustration-row">
          {/* Left Card: ASR status */}
          <div className="illustration-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="card-title-green">
              <span style={{ backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>✔</span>
              ASR Ingestion Active
            </div>
            <div className="card-desc">
              Running Groq Whisper-large-v3 on <i>Weekly_Project_Sync.mp3</i>. Transcribed in under 12 seconds.
            </div>
          </div>

          {/* Center Card: Summary status */}
          <div className="illustration-card" style={{ borderLeft: '4px solid #047857', background: 'linear-gradient(135deg, #ffffff, #f0fdf4)' }}>
            <div className="card-title-green" style={{ color: '#047857' }}>
              <span style={{ backgroundColor: '#e6fcf4', color: '#047857', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🧠</span>
              Distillation Complete
            </div>
            <div className="card-desc">
              12 decisions & tasks extracted by LLaMA 3.1 JSON model from raw transcripts.
            </div>
          </div>

          {/* Right Card: Checklist details */}
          <div className="illustration-card" style={{ borderLeft: '4px solid #7c3aed', background: 'linear-gradient(135deg, #ffffff, #faf5ff)' }}>
            <div className="card-title-purple">
              <span>📋</span> Action Checklist
            </div>
            <div className="card-desc">
              Checklist ready. Tasks mapped to owners and synced with the Prisma database.
            </div>
          </div>
        </div>

        <div className="setup-info">
          <svg viewBox="0 0 100 100" className="setup-avatar" style={{ width: '48px', height: '48px', marginBottom: '12px' }}>
            <circle cx="50" cy="50" r="50" fill="#ecfdf5" />
            <path d="M50 20a15 15 0 1 0 0 30 15 15 0 0 0 0-30zM50 58c-20 0-36 10-36 22h72c0-12-16-22-36-22z" fill="#047857" />
          </svg>
          <h4 className="setup-title">Quick and easy processing</h4>
          <p className="setup-desc">
            Enhance your productivity by uploading audio files directly to transcribe speech, isolate outcomes, and download structured reports.
          </p>
        </div>
      </section>

      {/* 4. Integrations Row */}
      <section className="integrations-bar">
        <div className="integration-item">🎬 <b>Zoom Audio</b> <span>• Recordings</span></div>
        <div className="integration-item">🔵 <b>Google Meet</b> <span>• Auto-sync</span></div>
        <div className="integration-item">🟢 <b>Teams Sync</b> <span>• Direct link</span></div>
        <div className="integration-item">📭 <b>Slack Alerts</b> <span>• Task sync</span></div>
        <div className="integration-item">☁️ <b>Cloudinary</b> <span>• Media storage</span></div>
      </section>

      {/* 5. Features Grid */}
      <section id="features" className="features-grid" style={{ scrollMarginTop: '40px' }}>
        {/* Left Interactive Mock Dashboard Widget */}
        <div>
          <div className="scheduler-widget">
            <div className="widget-header">
              <div>
                <h4 className="widget-title">Weekly_Project_Sync.mp3</h4>
                <div className="widget-sub">⚡ Extracted Action Checklist</div>
              </div>
              <div className="widget-date">Interactive Demo</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '10px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: task.completed ? '#f9fafb' : '#ffffff',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => toggleTask(task.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => {}} // Handled by div click
                    style={{ cursor: 'pointer', accentColor: '#047857' }} 
                  />
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 500, 
                    color: task.completed ? '#9ca3af' : '#374151',
                    textDecoration: task.completed ? 'line-through' : 'none'
                  }}>
                    {task.text}
                  </span>
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '0.75rem', 
                    color: '#6b7280', 
                    backgroundColor: '#f3f4f6', 
                    padding: '2px 8px', 
                    borderRadius: '6px',
                    fontWeight: 600
                  }}>
                    👤 {task.owner}
                  </span>
                </div>
              ))}
            </div>

            <div className="confirm-bar">
              <div className="confirm-info">
                <span style={{ color: '#10b981' }}>✔</span>
                <span>{completedCount} of {tasks.length} items completed</span>
              </div>
              <button className="confirm-btn" onClick={onGetStarted}>Try Free</button>
            </div>
          </div>
        </div>

        {/* Right Accordion List */}
        <div>
          <div className="badge" style={{ marginBottom: '12px' }}>🟢 Features</div>
          <h2 className="features-accordion-title">Everything you need to keep conversations moving</h2>

          <div className={`accordion-item ${activeAccordion === 'times' ? 'active' : ''}`} onClick={() => setActiveAccordion(activeAccordion === 'times' ? '' : 'times')}>
            <div className="accordion-header">
              <span>🟢 Whisper Speech-To-Text</span>
              <span>{activeAccordion === 'times' ? '➖' : '➕'}</span>
            </div>
            {activeAccordion === 'times' && (
              <p className="accordion-content">
                Powered by Groq's LPU hardware running Whisper-large-v3, transcription resolves in seconds. Transcribe any meeting recording file (.mp3, .wav, .m4a) accurately.
              </p>
            )}
          </div>

          <div className={`accordion-item ${activeAccordion === 'shows' ? 'active' : ''}`} onClick={() => setActiveAccordion(activeAccordion === 'shows' ? '' : 'shows')}>
            <div className="accordion-header">
              <span>⚪ LLM LLaMA 3.1 Summaries</span>
              <span>{activeAccordion === 'shows' ? '➖' : '➕'}</span>
            </div>
            {activeAccordion === 'shows' && (
              <p className="accordion-content">
                LLaMA 3.1 JSON Mode parses raw transcripts to extract reliable paragraph abstracts, highlight key decisions, and compile checklist action items.
              </p>
            )}
          </div>

          <div className={`accordion-item ${activeAccordion === 'momentum' ? 'active' : ''}`} onClick={() => setActiveAccordion(activeAccordion === 'momentum' ? '' : 'momentum')}>
            <div className="accordion-header">
              <span>⚪ Database-Linked Checklist Sync</span>
              <span>{activeAccordion === 'momentum' ? '➖' : '➕'}</span>
            </div>
            {activeAccordion === 'momentum' && (
              <p className="accordion-content">
                Check off completed items inside your workspace. The state updates in the database via Prisma ORM instantly, and you can export summary reports.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Value Proposition Rows */}
      <section className="value-prop-section">
        <div>
          <h2 className="value-title" style={{ maxWidth: '400px' }}>You want outcomes, but sorting through hours of audio slows momentum.</h2>
          <span className="value-prop-link" onClick={() => scrollToSection('features')}>OUR FEATURES</span>
        </div>
        <div>
          <p className="value-desc">
            Productive teams need clear action items, not raw transcripts. We distill long conversations into core outcomes, saving hours of manual review.
          </p>
          <button className="btn-solid" onClick={onGetStarted}>Start Now</button>
        </div>
      </section>

      {/* 7. Triple Feature Cards */}
      <section id="value-prop" className="cards-section" style={{ scrollMarginTop: '40px' }}>
        <div className="cards-section-header">
          <div className="badge">🟢 Value Proposition</div>
          <h2>All you require to keep discussions flowing smoothly</h2>
        </div>

        <div className="cards-grid">
          <div className="grid-card-white">
            <div>
              <h4 className="card-grid-title">Voice-to-Text ASR</h4>
              <p className="card-grid-desc">
                Upload any MP3, WAV, or M4A file. Audio is saved securely on Cloudinary and transcribed by Groq Whisper instantly.
              </p>
            </div>
            <div className="card-indicator">
              <div style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
              <span>ASR Engine Connected</span>
            </div>
          </div>

          {/* Central Green Card */}
          <div className="grid-card-green">
            <div>
              <h4 className="card-grid-title">Automated Action Items</h4>
              <p className="card-grid-desc">
                Extract tasks, identify assignees, and capture decisions in a structured checklist automatically.
              </p>
            </div>

            <div className="email-mock">
              <div className="email-header">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=50&h=50" className="email-avatar" alt="Avatar" />
                <div className="email-title">Task Notification</div>
              </div>
              <div className="email-body">
                Hi Sarah, LLaMA extracted a task for you: <b>Finalize Q3 roadmap</b> from Weekly_Project_Sync.mp3.
              </div>
              <div className="email-actions">
                <span className="email-btn-secondary">View Details</span>
                <span className="email-btn-primary" onClick={onGetStarted}>Open Task</span>
              </div>
            </div>
          </div>

          <div className="grid-card-white">
            <div>
              <h4 className="card-grid-title">Prisma Multi-Tenant Sync</h4>
              <p className="card-grid-desc">
                Safely organize your meeting logs under your Google Cloud OAuth account. Protect sensitive team conversations.
              </p>
            </div>
            <div className="card-indicator">
              <div style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
              <span>Database Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Bottom CTA Banner */}
      <section className="bottom-cta-banner">
        <div className="badge" style={{ backgroundColor: 'white', borderColor: '#d1fae5' }}>🟢 Try free</div>
        <h2>Ensure your discussions flow smoothly with all summaries at hand</h2>
        <p className="bottom-cta-desc">
          Every meaningful conversation begins with carving out outcomes. We ensure that your action items are never forgotten.
        </p>
        <button className="btn-solid" style={{ backgroundColor: '#022c22' }} onClick={onGetStarted}>Get Started Free</button>
      </section>

      {/* 9. Center Simple Developer Footer */}
      <footer className="footer-section">
        <hr className="footer-divider" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '60px', gap: '16px' }}>
          <div className="logo-container" onClick={onGetStarted}>
            <div className="logo-box">M</div>
            <span className="logo-text">Minutely</span>
          </div>
          <div style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: '600', letterSpacing: '-0.2px' }}>
            Created with ❤️ by Arpan Dey
          </div>
        </div>
      </footer>
    </div>
  );
}
