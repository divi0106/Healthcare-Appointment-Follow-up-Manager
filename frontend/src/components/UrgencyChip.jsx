export default function UrgencyChip({ urgency }) {
  if (!urgency) return null;
  const level = String(urgency).toLowerCase();
  const labels = { low: 'Low urgency', medium: 'Medium urgency', high: 'High urgency' };
  return (
    <span className={`urgency-chip urgency-${level}`}>
      <span className="dot" />
      {labels[level] || urgency}
    </span>
  );
}