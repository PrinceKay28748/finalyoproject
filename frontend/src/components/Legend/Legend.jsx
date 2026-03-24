import "./Legend.css";

// Displays a card on the map showing the selected start and destination names
// Only rendered after the user presses Show on Map
export default function Legend({ startText, destText, visible }) {
  if (!visible) return null;

  return (
    <div className="legend">
      {startText && (
        <div className="legend-row">
          <div className="legend-dot legend-dot--start" />
          <span className="legend-label">FROM</span>
          <span className="legend-value">{startText}</span>
        </div>
      )}
      {destText && (
        <div className="legend-row">
          <div className="legend-dot legend-dot--dest" />
          <span className="legend-label">TO</span>
          <span className="legend-value">{destText}</span>
        </div>
      )}
    </div>
  );
}