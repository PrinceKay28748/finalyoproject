import { useState } from 'react';

const tabs = [
  { id: 'overview', label: 'Overview', icon: '🗺️' },
  { id: 'routes', label: 'Routes', icon: '🧭' },
  { id: 'profiles', label: 'Profiles', icon: '⚙️' },
  { id: '3d', label: '3D & Weather', icon: '🌦️' },
  { id: 'accessibility', label: 'Accessibility', icon: '♿' },
  { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { id: 'account', label: 'Account', icon: '👤' },
];

export default function HelpGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const content = {
    overview: (
      <div className="help-pane">
        <h4>Welcome to UG Navigator</h4>
        <p className="help-lead">Your intelligent campus navigation companion for the University of Ghana, Legon.</p>
        <div className="help-card">
          <span className="help-card-icon">📍</span>
          <div>
            <strong>Smart Routing</strong>
            <p>Search any campus landmark and get turn-by-turn directions optimized for your chosen profile.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🌐</span>
          <div>
            <strong>2D & 3D Views</strong>
            <p>Switch between standard 2D map and immersive 3D satellite view with terrain elevation.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🌤️</span>
          <div>
            <strong>Live Weather</strong>
            <p>Real-time weather overlay with rain particle effects in 3D mode and 5-day forecasts.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">📊</span>
          <div>
            <strong>Crowd Analytics</strong>
            <p>Heatmap shows popular routes and congestion patterns around campus throughout the day.</p>
          </div>
        </div>
      </div>
    ),
    routes: (
      <div className="help-pane">
        <h4>Getting Around Campus</h4>
        <p className="help-lead">Plan your journey from anywhere to anywhere on the Legon campus.</p>
        <div className="help-step">
          <span className="help-step-num">1</span>
          <div>
            <strong>Set Your Start</strong>
            <p>Tap "Where to?" or use your current location as the starting point. You can also search for any landmark.</p>
          </div>
        </div>
        <div className="help-step">
          <span className="help-step-num">2</span>
          <div>
            <strong>Choose Destination</strong>
            <p>Search for your destination by name (e.g., "Balme Library", "Business School").</p>
          </div>
        </div>
        <div className="help-step">
          <span className="help-step-num">3</span>
          <div>
            <strong>Select Profile</strong>
            <p>Choose between Standard, Night Safety, Fastest, or Accessible to tailor the route to your needs.</p>
          </div>
        </div>
        <div className="help-step">
          <span className="help-step-num">4</span>
          <div>
            <strong>Navigate</strong>
            <p>Follow the turn-by-turn directions. Enable voice guidance for hands-free navigation.</p>
          </div>
        </div>
      </div>
    ),
    profiles: (
      <div className="help-pane">
        <h4>Route Profiles</h4>
        <p className="help-lead">Each profile optimizes your route differently. Switch between them anytime.</p>
        <div className="help-profile-card" style={{ borderLeftColor: '#2563eb' }}>
          <div className="help-profile-header">
            <span className="help-profile-icon" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>⚖️</span>
            <div>
              <strong>Standard</strong>
              <p>Balanced route — the best mix of distance, safety, and walking conditions.</p>
            </div>
          </div>
        </div>
        <div className="help-profile-card" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="help-profile-header">
            <span className="help-profile-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>🌙</span>
            <div>
              <strong>Night Safety</strong>
              <p>Prioritizes well-lit main roads and high-traffic paths for safer navigation after dark.</p>
            </div>
          </div>
        </div>
        <div className="help-profile-card" style={{ borderLeftColor: '#22c55e' }}>
          <div className="help-profile-header">
            <span className="help-profile-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>⚡</span>
            <div>
              <strong>Fastest</strong>
              <p>The shortest possible route — gets you there as quickly as possible.</p>
            </div>
          </div>
        </div>
        <div className="help-profile-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="help-profile-header">
            <span className="help-profile-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>♿</span>
            <div>
              <strong>Accessible</strong>
              <p>Avoids steep inclines, stairs, and rough terrain. Ideal for wheelchair users and those with mobility concerns.</p>
            </div>
          </div>
        </div>
      </div>
    ),
    '3d': (
      <div className="help-pane">
        <h4>3D Mode & Weather</h4>
        <p className="help-lead">Toggle 3D mode for an immersive satellite view with real-time weather effects.</p>
        <div className="help-card">
          <span className="help-card-icon">🛰️</span>
          <div>
            <strong>Satellite View</strong>
            <p>High-resolution satellite imagery with 3D terrain from MapTiler. Tilt and rotate to explore campus from any angle.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🌧️</span>
          <div>
            <strong>Rainfall Visualization</strong>
            <p>Live rain particle effects render on the 3D map when weather data detects precipitation. Intensity matches real rainfall.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🚦</span>
          <div>
            <strong>Congestion Heatmap</strong>
            <p>In 3D mode, a color-coded heatmap overlay shows popular routes and congestion areas based on aggregated user data.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">📅</span>
          <div>
            <strong>5-Day Forecast</strong>
            <p>Tap the weather banner in the route sheet to see the extended forecast with highs, lows, and precipitation probability.</p>
          </div>
        </div>
      </div>
    ),
    accessibility: (
      <div className="help-pane">
        <h4>Accessibility Features</h4>
        <p className="help-lead">UG Navigator is built with inclusive design at its core.</p>
        <div className="help-card">
          <span className="help-card-icon">♿</span>
          <div>
            <strong>Accessible Routing</strong>
            <p>The Accessible profile avoids steep slopes, stairs, and uneven terrain — optimized for wheelchair users.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">📢</span>
          <div>
            <strong>Voice Guidance</strong>
            <p>Enable voice guidance in the route sheet for spoken turn-by-turn directions. Perfect for hands-free navigation.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">⚠️</span>
          <div>
            <strong>Report Obstacles</strong>
            <p>Found a blocked ramp, broken sidewalk, or poor lighting? Use the Report feature to alert the campus community.</p>
          </div>
        </div>
        <div className="help-note">
          <span>💡</span>
          <span>Reports are reviewed by administrators and help improve routes for everyone.</span>
        </div>
      </div>
    ),
    heatmap: (
      <div className="help-pane">
        <h4>Heatmap & Analytics</h4>
        <p className="help-lead">Visualize where people are walking on campus with aggregated, anonymous data.</p>
        <div className="help-card">
          <span className="help-card-icon">🔥</span>
          <div>
            <strong>Popular Routes</strong>
            <p>Areas with more foot traffic appear warmer (red) while quieter areas appear cooler (blue).</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🕐</span>
          <div>
            <strong>Time Filters</strong>
            <p>Filter heatmap data by time of day: Morning, Midday, Afternoon, Evening, or Night to see how patterns shift.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">📈</span>
          <div>
            <strong>Data Points</strong>
            <p>The legend shows how many data points are being displayed. Heatmap data is sampled and anonymized for privacy.</p>
          </div>
        </div>
        <div className="help-note">
          <span>🔒</span>
          <span>All heatmap data is aggregated and anonymous. Individual routes are never tracked.</span>
        </div>
      </div>
    ),
    account: (
      <div className="help-pane">
        <h4>Account & Settings</h4>
        <p className="help-lead">Manage your profile, preferences, and account settings.</p>
        <div className="help-card">
          <span className="help-card-icon">✏️</span>
          <div>
            <strong>Edit Profile</strong>
            <p>Change your display name and username. Your profile is synced across devices.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🌙</span>
          <div>
            <strong>Dark Mode</strong>
            <p>Toggle dark mode for comfortable nighttime use. Preference is saved locally.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">🔐</span>
          <div>
            <strong>Security</strong>
            <p>Change your password anytime. Account deletion is permanent — all data will be erased.</p>
          </div>
        </div>
        <div className="help-card">
          <span className="help-card-icon">📱</span>
          <div>
            <strong>Cross-Platform</strong>
            <p>UG Navigator works in any browser. Your preferences sync via your account across sessions.</p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={e => e.stopPropagation()}>
        <div className="help-modal-header">
          <div className="help-modal-title-row">
            <div className="modal-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: 14, fontSize: 22 }}>
              📖
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px 0' }}>UG Navigator Guide</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--sub)' }}>Everything you need to navigate campus</p>
            </div>
          </div>
          <button className="help-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="help-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`help-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="help-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="help-body">
          {content[activeTab]}
        </div>

        <div className="help-footer">
          <span className="help-footer-text">UG Navigator v1.0 — University of Ghana, Legon</span>
        </div>
      </div>
      <style>{`
        .help-modal {
          max-width: 560px;
          max-height: 90vh;
          height: 90vh;
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
        }
        .help-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px 28px 16px;
          flex-shrink: 0;
        }
        .help-modal-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .help-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 40px;
          border: none;
          background: rgba(0,0,0,0.06);
          color: var(--text);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .help-close-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
        .ug-root.dark .help-close-btn { background: rgba(255,255,255,0.08); color: #d1d5db; }
        .ug-root.dark .help-close-btn:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
        .help-tabs {
          display: flex;
          gap: 4px;
          padding: 0 28px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .help-tabs::-webkit-scrollbar { display: none; }
        .help-tab-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 13px;
          border: none;
          background: transparent;
          color: var(--sub);
          font-size: 12px;
          font-weight: 500;
          font-family: 'Outfit', sans-serif;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .help-tab-btn:hover { background: rgba(37,99,235,0.06); color: var(--text); }
        .help-tab-btn.active { background: rgba(37,99,235,0.1); color: #2563eb; font-weight: 600; }
        .help-tab-icon { font-size: 15px; }
        .help-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 28px 20px;
          scrollbar-width: thin;
        }
        .help-pane h4 {
          font-size: 18px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          color: var(--text);
          margin: 0 0 6px 0;
        }
        .help-lead {
          font-size: 13px;
          color: var(--sub);
          margin: 0 0 16px 0;
          line-height: 1.5;
        }
        .help-card {
          display: flex;
          gap: 12px;
          padding: 12px 14px;
          background: var(--hover-row);
          border-radius: 14px;
          margin-bottom: 8px;
          transition: transform 0.15s;
        }
        .help-card:hover { transform: translateX(3px); }
        .help-card-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
        .help-card strong {
          display: block;
          font-size: 14px;
          color: var(--text);
          margin-bottom: 3px;
        }
        .help-card p {
          font-size: 12px;
          color: var(--sub);
          margin: 0;
          line-height: 1.5;
        }
        .help-step {
          display: flex;
          gap: 14px;
          padding: 12px 0;
          border-bottom: 0.5px solid var(--border);
        }
        .help-step:last-child { border-bottom: none; }
        .help-step-num {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          background: rgba(37,99,235,0.1);
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
          font-family: 'Outfit', sans-serif;
        }
        .help-step strong {
          display: block;
          font-size: 14px;
          color: var(--text);
          margin-bottom: 3px;
        }
        .help-step p {
          font-size: 12px;
          color: var(--sub);
          margin: 0;
          line-height: 1.5;
        }
        .help-profile-card {
          padding: 12px 14px;
          margin-bottom: 8px;
          background: var(--hover-row);
          border-radius: 14px;
          border-left: 3px solid;
          transition: transform 0.15s;
        }
        .help-profile-card:hover { transform: translateX(3px); }
        .help-profile-header {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .help-profile-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .help-profile-header strong {
          display: block;
          font-size: 14px;
          color: var(--text);
          margin-bottom: 2px;
        }
        .help-profile-header p {
          font-size: 12px;
          color: var(--sub);
          margin: 0;
          line-height: 1.5;
        }
        .help-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 14px;
          margin-top: 8px;
          background: rgba(37,99,235,0.06);
          border-radius: 12px;
          font-size: 12px;
          color: var(--sub);
          line-height: 1.5;
        }
        .help-footer {
          padding: 12px 28px;
          border-top: 0.5px solid var(--border);
          flex-shrink: 0;
        }
        .help-footer-text {
          font-size: 11px;
          color: var(--sub);
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}