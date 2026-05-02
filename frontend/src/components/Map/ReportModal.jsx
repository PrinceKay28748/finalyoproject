// frontend/src/components/Map/ReportModal.jsx
// Accessibility report dialog — matches your existing design (no gradients)

import { useState, useEffect } from 'react';
import { submitReport } from '../../services/reportService';
import './ReportModal.css';

const ISSUE_TYPES = [
  { value: 'blocked_ramp', label: 'Blocked ramp', icon: '🚧' },
  { value: 'missing_curb', label: 'Missing curb cut', icon: '📐' },
  { value: 'broken_surface', label: 'Broken / uneven surface', icon: '🕳️' },
  { value: 'poor_lighting', label: 'Poor lighting', icon: '💡' },
  { value: 'construction', label: 'Construction / road closed', icon: '🚧' },
  { value: 'other', label: 'Other issue', icon: '📝' },
];

const SEVERITY_OPTIONS = [
  { value: 1, label: 'Mild', description: 'Annoying but passable', color: '#22c55e' },
  { value: 2, label: 'Moderate', description: 'Difficult to navigate', color: '#f59e0b' },
  { value: 3, label: 'Severe', description: 'Impassable / dangerous', color: '#ef4444' },
];

export default function ReportModal({ isOpen, onClose, onSubmit, defaultLocation, user }) {
  const [selectedIssue, setSelectedIssue] = useState('blocked_ramp');
  const [customDescription, setCustomDescription] = useState('');
  const [severity, setSeverity] = useState(2);
  const [location, setLocation] = useState(defaultLocation);
  const [locationName, setLocationName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Update location when defaultLocation changes
  useEffect(() => {
    if (defaultLocation) {
      setLocation(defaultLocation);
      if (defaultLocation.lat && defaultLocation.lng) {
        fetchLocationName(defaultLocation.lat, defaultLocation.lng);
      }
    }
  }, [defaultLocation]);

  const fetchLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        const shortName = data.display_name.split(',').slice(0, 2).join(', ');
        setLocationName(shortName);
      }
    } catch (err) {
      console.warn('[ReportModal] Failed to get location name:', err);
    }
  };

  const resetForm = () => {
    setSelectedIssue('blocked_ramp');
    setCustomDescription('');
    setSeverity(2);
    setError('');
    setSuccess(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    if (!location || !location.lat || !location.lng) {
      setError('Location is required. Please try again.');
      setIsSubmitting(false);
      return;
    }

    if (selectedIssue === 'other' && !customDescription.trim()) {
      setError('Please describe the issue');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await submitReport({
        lat: location.lat,
        lng: location.lng,
        location_name: locationName,
        issue_type: selectedIssue,
        custom_description: selectedIssue === 'other' ? customDescription : undefined,
        severity: severity
      });
      
      console.log('[ReportModal] Submit success:', result);
      
      setSuccess(true);
      setIsSubmitting(false);

    } catch (err) {
      console.error('[ReportModal] Submit error:', err);
      setError(err.message || 'Failed to submit report');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={handleClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h2>Report accessibility issue</h2>
          <button className="report-modal-close" onClick={handleClose}>✕</button>
        </div>

        {/* Success Popup - replaces form content */}
        {success ? (
          <div className="report-success-popup">
            <div className="success-checkmark">✓</div>
            <h3>Report Submitted!</h3>
            <p>Thank you for helping improve campus accessibility.</p>
            <p className="success-note">Admin will review your report shortly.</p>
            <button className="success-close-btn" onClick={handleClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Location preview */}
            <div className="report-location-preview">
              <span className="report-location-icon">📍</span>
              <div className="report-location-info">
                <span className="report-location-label">Location</span>
                <span className="report-location-coords">
                  {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Select location on map'}
                </span>
                {locationName && <span className="report-location-name">{locationName}</span>}
              </div>
            </div>

            {/* Issue type selection */}
            <div className="report-form-group">
              <label className="report-label">What's the problem?</label>
              <div className="report-issue-grid">
                {ISSUE_TYPES.map((issue) => (
                  <button
                    key={issue.value}
                    type="button"
                    className={`report-issue-btn ${selectedIssue === issue.value ? 'active' : ''}`}
                    onClick={() => setSelectedIssue(issue.value)}
                  >
                    <span className="report-issue-icon">{issue.icon}</span>
                    <span className="report-issue-label">{issue.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom description for "other" */}
            {selectedIssue === 'other' && (
              <div className="report-form-group">
                <label className="report-label">Describe the issue</label>
                <textarea
                  className="report-textarea"
                  rows={3}
                  placeholder="What happened? Where exactly? ..."
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                />
              </div>
            )}

            {/* Severity selection */}
            <div className="report-form-group">
              <label className="report-label">How severe?</label>
              <div className="report-severity-grid">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`report-severity-btn ${severity === opt.value ? 'active' : ''}`}
                    onClick={() => setSeverity(opt.value)}
                  >
                    <div className="report-severity-dot" style={{ backgroundColor: opt.color }} />
                    <div className="report-severity-info">
                      <span className="report-severity-label">{opt.label}</span>
                      <span className="report-severity-desc">{opt.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="report-error">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Actions */}
            <div className="report-actions">
              <button type="button" className="report-btn report-btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="report-btn report-btn-primary" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </form>
        )}

        <div className="report-note">
          <p>📍 Reports are manually verified by admins before affecting route calculations.</p>
        </div>
      </div>
    </div>
  );
}