import { useEffect, useState } from 'react';
import api from '../../api/client';

const DAYS = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

const defaultHours = () =>
  Object.fromEntries(DAYS.map((d) => [d.key, { enabled: false, start: '09:00', end: '17:00' }]));

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', specialisation: '', slotDurationMin: 30 });
  const [hours, setHours] = useState(defaultHours());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data } = await api.get('/admin/doctors');
    setDoctors(data);
  }

  useEffect(() => { load(); }, []);

  function toggleDay(key) {
    setHours((h) => ({ ...h, [key]: { ...h[key], enabled: !h[key].enabled } }));
  }

  function updateDayTime(key, field, value) {
    setHours((h) => ({ ...h, [key]: { ...h[key], [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const workingHours = Object.fromEntries(
        DAYS.filter((d) => hours[d.key].enabled).map((d) => [d.key, [hours[d.key].start, hours[d.key].end]])
      );
      await api.post('/admin/doctors', {
        ...form,
        slotDurationMin: Number(form.slotDurationMin),
        workingHours,
      });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', specialisation: '', slotDurationMin: 30 });
      setHours(defaultHours());
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create doctor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 18 }}>
        <h1>Doctors</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add doctor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <div className="field-row">
            <div className="field">
              <label>Full name</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Specialisation</label>
              <input required value={form.specialisation} onChange={(e) => setForm((f) => ({ ...f, specialisation: e.target.value }))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input type="text" required minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Slot duration (minutes)</label>
            <input type="number" min={5} max={180} value={form.slotDurationMin} onChange={(e) => setForm((f) => ({ ...f, slotDurationMin: e.target.value }))} />
          </div>

          <div className="section-title">Working hours</div>
          {DAYS.map((d) => (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <label style={{ width: 60, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={hours[d.key].enabled}
                  onChange={() => toggleDay(d.key)}
                  style={{ width: 'auto', marginRight: 6 }}
                />
                {d.label}
              </label>
              <input type="time" style={{ width: 130 }} disabled={!hours[d.key].enabled} value={hours[d.key].start} onChange={(e) => updateDayTime(d.key, 'start', e.target.value)} />
              <span className="muted">to</span>
              <input type="time" style={{ width: 130 }} disabled={!hours[d.key].enabled} value={hours[d.key].end} onChange={(e) => updateDayTime(d.key, 'end', e.target.value)} />
            </div>
          ))}

          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 12 }}>
            {submitting ? 'Creating…' : 'Create doctor profile'}
          </button>
        </form>
      )}

      {doctors.map((doc) => (
        <div key={doc.id} className="card">
          <h3 style={{ marginBottom: 2 }}>Dr. {doc.user.name}</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            {doc.specialisation} · {doc.slotDurationMin}-min slots · {doc.user.email}
          </p>
        </div>
      ))}
    </div>
  );
}