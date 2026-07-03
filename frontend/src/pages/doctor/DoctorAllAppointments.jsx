import { useEffect, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import UrgencyChip from '../../components/UrgencyChip';

export default function DoctorAllAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments').then(({ data }) => {
      setAppointments(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>All appointments</h1>
      {appointments.length === 0 && <div className="empty-state card">No appointments yet.</div>}
      {appointments.map((appt) => (
        <div key={appt.id} className="card">
          <div className="card-row">
            <div>
              <h3 style={{ marginBottom: 2 }}>{appt.patient.name}</h3>
              <p className="muted" style={{ marginBottom: 0, fontFamily: 'monospace', fontSize: '0.88rem' }}>
                {new Date(appt.slotStart).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <StatusBadge status={appt.status} />
              {appt.symptomForm?.urgency && (
                <div style={{ marginTop: 8 }}>
                  <UrgencyChip urgency={appt.symptomForm.urgency} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}