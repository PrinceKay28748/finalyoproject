import { useState } from 'react';

export default function EditProfileModal({ isOpen, onClose, currentUsername, onUpdate }) {
  const [username, setUsername] = useState(currentUsername || '');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2>Edit Username</h2>
          <p>This is how you will appear to other users on the campus network.</p>
        </div>
        <div className="modal-form-group">
          <input 
            className="ug-search-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter new username"
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-primary" onClick={() => { onUpdate(username); onClose(); }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}