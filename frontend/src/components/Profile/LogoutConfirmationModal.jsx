// frontend/src/components/Profile/LogoutConfirmationModal.jsx
import "./LogoutConfirmationModal.css";

const IconLogout = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function LogoutConfirmationModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="logout-modal-icon">
          <IconLogout />
        </div>
        <h3>Sign Out</h3>
        <p>Are you sure you want to sign out of UG Navigator?</p>
        <div className="logout-modal-actions">
          <button className="logout-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="logout-modal-btn-confirm" onClick={onConfirm}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}