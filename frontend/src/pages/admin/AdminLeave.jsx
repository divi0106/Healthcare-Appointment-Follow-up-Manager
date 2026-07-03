import { useEffect, useState } from 'react';
import api from '../../api/client';

export default function AdminLeave() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [leave, setLeave] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/admin/doctors').then(({ data }) => {
      setDoctors(data);
      if (data.length) setSelectedDoctorId(data[0].id);
    });
  }, []);

  async function loadLeave(doctorId) {
    if (!doctorId) return;
    const { data } = await api.get(`/admin/doctors/${doctorId}/leave`);
    setLeave(data);
  }

  useEffect(() => { loadLeave(selectedDoctorId); }, [selectedDoctorId]);

  async function handleMarkLeave(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const { data } = await api.post(`/admin/doctors/${selectedDoctorId}/leave`, { date, reason });
      setMessage(data.message);
      setDate('');
      setReason('');
      loadLeave(selectedDoctorId);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark leave.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(leaveDate) {
    const dateOnly = new Date(leaveDate).toISOString().slice(0, 10);
    await api.delete(`/admin/doctors/${selectedDoctorId}/leave/${dateOnly}`);
    loadLeave(selectedDoctorId);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Leave management</h1>

      <div className="field">
        <label>Doctor</label>
        <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.user.name} — {d.specialisation}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleMarkLeave} className="card">
        <div className="field-row">
          <div className="field">
            <label>Leave date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Reason (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. conference" />
          </div>
        </div>
        <p className="hint">
          Patients with existing bookings on this date will be automatically notified.
        </p>
        {error && <div className="error-text">{error}</div>}
        {message && <p style={{ color: '#4f8a6b', fontSize: '0.88rem' }}>{message}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting || !selectedDoctorId}>
          {submitting ? 'Saving…' : 'Mark as leave'}
        </button>
      </form>

      <div className="section-title">Upcoming leave days</div>
      {leave.length === 0 && <p className="muted">No leave days recorded.</p>}
      {leave.map((l) => (
        <div key={l.id} className="card card-row">
          <div>
            <strong>{new Date(l.date).toLocaleDateString()}</strong>
            {l.reason && <p className="muted" style={{ marginBottom: 0 }}>{l.reason}</p>}
          </div>
          <button className="btn btn-secondary" onClick={() => handleRemove(l.date)}>Remove</button>
        </div>
      ))}
    </div>
  );
}