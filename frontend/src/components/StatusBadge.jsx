const LABELS = {
  HELD: 'Held', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled',
  COMPLETED: 'Completed', NEEDS_RESCHEDULE: 'Needs reschedule',
};
const CLASS = {
  HELD: 'badge-held', CONFIRMED: 'badge-confirmed', CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed', NEEDS_RESCHEDULE: 'badge-reschedule',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${CLASS[status] || ''}`}>{LABELS[status] || status}</span>;
}