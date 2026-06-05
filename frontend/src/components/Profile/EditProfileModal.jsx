// frontend/src/components/Profile/EditProfileModal.jsx
import { useState } from "react";
import { API_URL } from "../../config";
import { useAuthContext } from "../../context/AuthContext";
import "./EditProfileModal.css";

export default function EditProfileModal({ isOpen, onClose, currentUsername, onUpdate }) {
  const [username, setUsername] = useState(currentUsername || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { getAuthHeader, user } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate username
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      setIsLoading(false);
      return;
    }

    if (username.length > 50) {
      setError("Username must be less than 50 characters");
      setIsLoading(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError("Username can only contain letters, numbers, underscore and dash");
      setIsLoading(false);
      return;
    }

    try {
      // Update username in your backend
      const response = await fetch(`${API_URL}/auth/update-username`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update username");
      }

      onUpdate(username);
      onClose();
    } catch (err) {
      console.error("[EditProfileModal] Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Username</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-form-group">
            <label htmlFor="username">New Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter new username"
              autoComplete="off"
              autoFocus
            />
            <p className="modal-hint">Letters, numbers, underscore and dash only. 3-50 characters.</p>
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
            <button type="submit" className="modal-btn-save" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}