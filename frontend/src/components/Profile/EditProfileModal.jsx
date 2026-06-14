import { useState } from 'react';

export default function EditProfileModal({ isOpen, onClose, currentUsername, onUpdate }) {
  const [username, setUsername] = useState(currentUsername || '');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">👤</div>
          <h2>Edit Username</h2>
          <p>This is how you will appear to other users on the campus network.</p>
        </div>
        <input 
          className="ug-search-input" // Reusing your high-quality input styles
          style={{ width: '100%', marginBottom: '10px' }}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Enter new username"
          autoFocus
        />
        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-primary" onClick={() => { onUpdate(username); onClose(); }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}