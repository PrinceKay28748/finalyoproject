export default function LogoutConfirmationModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>🚪</div>
          <h2>Sign Out</h2>
          <p>Are you sure you want to end your current session? You'll need to sign back in to access your saved routes.</p>
        </div>
        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>Stay Signed In</button>
          <button 
            className="modal-btn modal-btn-danger" 
            onClick={() => { onConfirm(); onClose(); }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}