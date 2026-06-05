// frontend/src/components/Profile/DeleteAccountModal.jsx
import { useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { API_URL } from "../../config";
import "./EditProfileModal.css"; // Reuse same styles

export default function DeleteAccountModal({ isOpen, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { getAuthHeader, logout } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (confirmText !== "DELETE") {
      setError('Please type "DELETE" to confirm');
      setIsLoading(false);
      return;
    }

    try {
      // Delete account from your backend
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "DELETE",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      // Delete from Supabase Auth
      const { error: supabaseError } = await supabase.auth.admin.deleteUser(
        (await supabase.auth.getUser()).data.user?.id
      );

      if (supabaseError) {
        console.warn("[DeleteAccountModal] Supabase deletion warning:", supabaseError);
      }

      // Logout user
      await logout();
      
      if (onConfirm) onConfirm();
      onClose();
    } catch (err) {
      console.error("[DeleteAccountModal] Error:", err);
      setError(err.message || "Failed to delete account");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ color: "#ef4444" }}>Delete Account</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-form-group">
            <p style={{ marginBottom: "16px", color: "var(--text)" }}>
              <strong>Warning:</strong> This action is permanent and cannot be undone.
              All your data will be deleted.
            </p>
            <label htmlFor="confirm-delete">
              Type <strong style={{ color: "#ef4444" }}>DELETE</strong> to confirm
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="modal-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="modal-btn-save" 
              style={{ background: "#ef4444" }}
              disabled={isLoading || confirmText !== "DELETE"}
            >
              {isLoading ? "Deleting..." : "Permanently Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}