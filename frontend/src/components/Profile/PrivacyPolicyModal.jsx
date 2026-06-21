import { useState } from 'react';

const sections = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'data', label: 'Data Collected', icon: '📊' },
  { id: 'cookies', label: 'Cookies', icon: '🍪' },
  { id: 'usage', label: 'How We Use Data', icon: '🔧' },
  { id: 'sharing', label: 'Data Sharing', icon: '🤝' },
  { id: 'rights', label: 'Your Rights', icon: '🛡️' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'contact', label: 'Contact', icon: '📧' },
];

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content privacy-modal" onClick={e => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <div className="privacy-title-row">
            <div className="modal-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', width: 48, height: 48, borderRadius: 14, fontSize: 22 }}>
              🛡️
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px 0' }}>Privacy & Cookies</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--sub)' }}>How we handle your data</p>
            </div>
          </div>
          <button className="help-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="privacy-tabs">
          {sections.map(s => (
            <button
              key={s.id}
              className={`privacy-tab-btn ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="privacy-body">
          {activeSection === 'overview' && (
            <div className="privacy-pane">
              <h4>Privacy Policy Overview</h4>
              <p className="privacy-lead">Last updated: June 2026</p>
              <p>UG Navigator ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our campus navigation service.</p>
              <div className="privacy-highlight">
                <strong>Our Promise</strong>
                <p>We collect only the minimum data needed to provide navigation services. We never sell your personal information. Your location data is processed locally and never stored permanently.</p>
              </div>
              <p>By using UG Navigator, you agree to the collection and use of information in accordance with this policy. If you do not agree, please discontinue use of the service.</p>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="privacy-pane">
              <h4>Information We Collect</h4>
              <p className="privacy-lead">We collect only what is necessary for navigation and analytics.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">👤</span>
                <div>
                  <strong>Account Information</strong>
                  <p>Email address and username — required for authentication and personalization. Stored securely in our database.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📍</span>
                <div>
                  <strong>Location Data</strong>
                  <p>Your current location is used only to show your position on the map and calculate routes. Location data is not stored or tracked after your session ends.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🗺️</span>
                <div>
                  <strong>Route History</strong>
                  <p>Anonymized route segments (start/end points) are sampled and aggregated for heatmap visualization. Individual routes are never identifiable.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📱</span>
                <div>
                  <strong>Device Information</strong>
                  <p>Basic device info (screen size, browser type) is collected to optimize your experience. No device identifiers or fingerprints are stored.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'cookies' && (
            <div className="privacy-pane">
              <h4>Cookie Policy</h4>
              <p className="privacy-lead">We use cookies minimally and transparently.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">🍪</span>
                <div>
                  <strong>Session Cookies</strong>
                  <p>We use essential session cookies to keep you logged in during your visit. These are temporary and expire when you close your browser.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">💾</span>
                <div>
                  <strong>Local Storage</strong>
                  <p>We use browser local storage (IndexedDB) to save your preferences such as dark mode toggle, active route profile, and map settings. This data never leaves your device.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📊</span>
                <div>
                  <strong>Analytics Cookies</strong>
                  <p>We do not use third-party analytics cookies. Anonymous usage data is collected via our own backend endpoints and is not shared with advertisers.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🚫</span>
                <div>
                  <strong>Third-Party Cookies</strong>
                  <p>We do not use tracking cookies, advertising cookies, or any third-party tracking mechanisms. Map tiles are served from MapTiler with no user tracking.</p>
                </div>
              </div>
              <div className="privacy-highlight">
                <strong>Managing Cookies</strong>
                <p>You can clear your local storage and cookies at any time through your browser settings. Note that this will reset your preferences and require re-authentication.</p>
              </div>
            </div>
          )}

          {activeSection === 'usage' && (
            <div className="privacy-pane">
              <h4>How We Use Your Data</h4>
              <p className="privacy-lead">Your data serves specific, limited purposes.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">🧭</span>
                <div>
                  <strong>Navigation</strong>
                  <p>Your location and route data are used in real-time to calculate paths and provide turn-by-turn directions. No location history is retained.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🔥</span>
                <div>
                  <strong>Heatmap Generation</strong>
                  <p>Anonymized, bucketed coordinates are aggregated to show popular walking routes on campus. Individual contributions cannot be identified.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">⚙️</span>
                <div>
                  <strong>Service Improvement</strong>
                  <p>Aggregated analytics help us understand usage patterns, identify popular destinations, and improve routing algorithms.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📧</span>
                <div>
                  <strong>Communication</strong>
                  <p>Your email is used only for account-related notifications (password resets). We do not send marketing emails.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sharing' && (
            <div className="privacy-pane">
              <h4>Data Sharing & Third Parties</h4>
              <p className="privacy-lead">We share only what is necessary to provide the service.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">🗺️</span>
                <div>
                  <strong>Map Services</strong>
                  <p>Map tiles are served by MapTiler. Coordinates are sent to MapTiler only to load the visible map area. No personal data is shared.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🌤️</span>
                <div>
                  <strong>Weather Data</strong>
                  <p>Coordinates are sent to Open-Meteo (with 7Timer fallback) to fetch weather data. These requests are anonymous and not linked to your account.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🔐</span>
                <div>
                  <strong>Authentication</strong>
                  <p>Authentication is handled by Supabase. Only your email and hashed credentials are processed. We never store passwords in plain text.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📋</span>
                <div>
                  <strong>No Third-Party Sharing</strong>
                  <p>We do not sell, rent, or share your personal data with advertisers, marketers, or any other third parties for their own purposes.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'rights' && (
            <div className="privacy-pane">
              <h4>Your Rights (GDPR & Privacy)</h4>
              <p className="privacy-lead">You have control over your data.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">👁️</span>
                <div>
                  <strong>Right to Access</strong>
                  <p>You can view your profile data at any time from the Profile page. This includes your username, email, and account creation date.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">✏️</span>
                <div>
                  <strong>Right to Rectify</strong>
                  <p>You can update your username and other profile information directly through the Profile settings.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🗑️</span>
                <div>
                  <strong>Right to Delete</strong>
                  <p>You can delete your account and all associated data at any time from the Danger Zone in Profile settings. This action is permanent.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📥</span>
                <div>
                  <strong>Right to Data Portability</strong>
                  <p>Contact us to request a copy of your personal data in a machine-readable format. We will respond within 30 days.</p>
                </div>
              </div>
              <div className="privacy-highlight">
                <strong>GDPR Compliance</strong>
                <p>UG Navigator is fully compliant with the General Data Protection Regulation (GDPR). If you are a resident of the European Economic Area (EEA), you have all rights afforded under GDPR.</p>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="privacy-pane">
              <h4>Data Security</h4>
              <p className="privacy-lead">We implement industry-standard security measures.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">🔐</span>
                <div>
                  <strong>Encryption</strong>
                  <p>All data transmitted between your device and our servers is encrypted using TLS/SSL. Passwords are hashed using bcrypt and never stored in plain text.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🛡️</span>
                <div>
                  <strong>Authentication</strong>
                  <p>We use Supabase Auth with industry-standard JWT tokens. Tokens expire after 15 minutes and refresh tokens rotate securely.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">📋</span>
                <div>
                  <strong>Data Minimization</strong>
                  <p>We collect only the data necessary for navigation. Location data is ephemeral and not stored. Route analytics are aggregated and anonymized.</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🔍</span>
                <div>
                  <strong>Audit Logging</strong>
                  <p>Account-affecting actions (login, password change, account deletion) are logged for security auditing. Logs are retained for 90 days.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'contact' && (
            <div className="privacy-pane">
              <h4>Contact Us</h4>
              <p className="privacy-lead">Have questions about your privacy? We're here to help.</p>
              <div className="privacy-card">
                <span className="privacy-card-icon">📧</span>
                <div>
                  <strong>Email</strong>
                  <p>pkay28748@gmail.com</p>
                  <p style={{ fontSize: 12, color: 'var(--sub)', marginTop: 4 }}>Response time: within 48 hours</p>
                </div>
              </div>
              <div className="privacy-card">
                <span className="privacy-card-icon">🏛️</span>
                <div>
                  <strong>Data Controller</strong>
                  <p>UG Navigator<br />University of Ghana, Legon<br />Accra, Ghana</p>
                </div>
              </div>
              <div className="privacy-highlight">
                <strong>Data Protection Officer</strong>
                <p>If you have concerns about how your data is handled, please contact our Data Protection Officer at the email above. We take all privacy concerns seriously and will respond promptly.</p>
              </div>
            </div>
          )}
        </div>

        <div className="help-footer">
          <span className="help-footer-text">UG Navigator v1.0 — Privacy Policy & Cookie Notice</span>
        </div>
      </div>

      <style>{`
        .privacy-modal {
          max-width: 600px;
          max-height: 90vh;
          height: 90vh;
          display: flex;
          flex-direction: column;
          padding: 0;
          overflow: hidden;
        }
        .privacy-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px 28px 16px;
          flex-shrink: 0;
        }
        .privacy-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .privacy-tabs {
          display: flex;
          gap: 4px;
          padding: 0 28px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .privacy-tabs::-webkit-scrollbar { display: none; }
        .privacy-tab-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 12px;
          border: none;
          background: transparent;
          color: var(--sub);
          font-size: 11px;
          font-weight: 500;
          font-family: 'Outfit', sans-serif;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .privacy-tab-btn:hover { background: rgba(37,99,235,0.06); color: var(--text); }
        .privacy-tab-btn.active { background: rgba(37,99,235,0.1); color: #2563eb; font-weight: 600; }
        .privacy-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 28px 20px;
          scrollbar-width: thin;
        }
        .privacy-pane h4 {
          font-size: 18px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          color: var(--text);
          margin: 0 0 4px 0;
        }
        .privacy-lead {
          font-size: 12px;
          color: var(--sub);
          margin: 0 0 16px 0;
          opacity: 0.7;
        }
        .privacy-pane > p {
          font-size: 13px;
          color: var(--sub);
          line-height: 1.7;
          margin: 0 0 12px 0;
        }
        .privacy-card {
          display: flex;
          gap: 12px;
          padding: 12px 14px;
          background: var(--hover-row);
          border-radius: 14px;
          margin-bottom: 8px;
          transition: transform 0.15s;
        }
        .privacy-card:hover { transform: translateX(3px); }
        .privacy-card-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
        .privacy-card strong {
          display: block;
          font-size: 14px;
          color: var(--text);
          margin-bottom: 3px;
        }
        .privacy-card p {
          font-size: 12px;
          color: var(--sub);
          margin: 0;
          line-height: 1.5;
        }
        .privacy-highlight {
          padding: 14px 16px;
          margin: 12px 0;
          background: rgba(37,99,235,0.06);
          border-left: 3px solid #2563eb;
          border-radius: 12px;
        }
        .privacy-highlight strong {
          display: block;
          font-size: 14px;
          color: var(--text);
          margin-bottom: 6px;
        }
        .privacy-highlight p {
          font-size: 12px;
          color: var(--sub);
          margin: 0;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}