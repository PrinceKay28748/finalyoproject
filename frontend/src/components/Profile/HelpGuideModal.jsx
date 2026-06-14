import { useState } from 'react';

export default function HelpGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('basics');

  if (!isOpen) return null;

  const sections = {
    basics: (
      <div className="help-content-pane">
        <h4>Getting Around</h4>
        <p>Use the "Where to?" box to search for any campus landmark. UG Navigator will calculate the best path based on your selected profile.</p>
        <ul>
          <li><strong>Standard:</strong> Balanced speed and accessibility.</li>
          <li><strong>Night Safety:</strong> Prioritizes well-lit main roads.</li>
          <li><strong>Fastest:</strong> The shortest distance possible.</li>
        </ul>
      </div>
    ),
    accessibility: (
      <div className="help-content-pane">
        <h4>Accessibility First</h4>
        <p>The "Accessible" profile avoids steep inclines and stairs. Use the "Report" feature if you encounter a new obstacle like construction or a broken sidewalk.</p>
      </div>
    ),
    expansion: (
      <div className="help-content-pane">
        <div className="expansion-banner">🚀 Coming Soon</div>
        <h4>Accra City-Wide</h4>
        <p>We are currently mapping the entire Accra metropolitan area. Soon, you'll be able to navigate from East Legon to Osu with the same safety and accessibility focus.</p>
        <p style={{ fontSize: '12px', color: 'var(--sub)' }}>Interested in beta testing Accra City mode? Contact the admin team.</p>
      </div>
    )
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">📖</div>
          <h2>UG Navigator Guide</h2>
        </div>
        
        <div className="help-tabs">
          {['basics', 'accessibility', 'expansion'].map(tab => (
            <button 
              key={tab}
              className={`help-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="help-body">
          {sections[activeTab]}
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
      <style>{`
        .help-modal { max-width: 500px; }
        .help-tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .help-tab-btn { 
          background: none; border: none; padding: 6px 12px; font-size: 13px; 
          color: var(--sub); cursor: pointer; border-radius: 20px; transition: all 0.2s;
        }
        .help-tab-btn.active { background: rgba(37, 99, 235, 0.1); color: #2563eb; font-weight: 600; }
        .help-content-pane h4 { margin: 0 0 10px 0; color: var(--text); }
        .help-content-pane p { font-size: 14px; color: var(--sub); line-height: 1.6; margin-bottom: 12px; }
        .help-content-pane ul { padding-left: 20px; font-size: 14px; color: var(--sub); }
        .help-content-pane li { margin-bottom: 6px; }
        .expansion-banner { 
          display: inline-block; padding: 4px 10px; background: #fef3c7; color: #92400e; 
          border-radius: 8px; font-size: 11px; font-weight: 700; margin-bottom: 12px;
        }
        .ug-root.dark .expansion-banner { background: #451a03; color: #fbbf24; }
      `}</style>
    </div>
  );
}