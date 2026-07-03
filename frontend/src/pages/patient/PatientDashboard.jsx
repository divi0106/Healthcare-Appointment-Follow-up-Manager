import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import UrgencyChip from '../../components/UrgencyChip';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/appointments');
    setAppointments(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    await api.post(`/appointments/${id}/cancel`);
    load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 18 }}>
        <h1>My appointments</h1>
        <Link to="/patient/find-doctor" className="btn btn-primary">Book appointment</Link>
      </div>

      {appointments.length === 0 && (
        <div className="empty-state card">
          <p>No appointments yet.</p>
          <Link to="/patient/find-doctor" className="btn btn-primary">Find a doctor</Link>
        </div>
      )}

      {appointments.map((appt) => (
        <div key={appt.id} className="card">
          <div className="card-row">
            <div>
              <h3 style={{ marginBottom: 4 }}>Dr. {appt.doctor.user.name}</h3>
              <p className="muted" style={{ marginBottom: 6 }}>{appt.doctor.specialisation}</p>
              <p style={{ fontSize: '0.88rem', fontFamily: 'monospace' }}>
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

          {appt.status === 'HELD' && (
            <>
              <hr className="divider" />
              <p className="hint">Your slot is held. Fill symptoms to confirm.</p>
              <Link to={`/patient/symptom-form/${appt.id}`} className="btn btn-primary">
                Fill symptom form & confirm
              </Link>
            </>
          )}

          {appt.status === 'NEEDS_RESCHEDULE' && (
            <>
              <hr className="divider" />
              <p className="hint" style={{ color: '#bd4332' }}>
                Doctor is unavailable. Please book a new slot.
              </p>
              <Link to="/patient/find-doctor" className="btn btn-secondary">Find a new slot</Link>
            </>
          )}

          {appt.status === 'COMPLETED' && appt.postVisit?.summaryStatus === 'READY' && (
            <>
              <hr className="divider" />
              <div className="section-title" style={{ marginTop: 0 }}>Visit summary</div>
              <p>{appt.postVisit.patientSummary}</p>
              {appt.postVisit.followUpSteps?.length > 0 && (
                <ul>{appt.postVisit.followUpSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
              )}
            </>
          )}

          {appt.status === 'CONFIRMED' && (
            <>
              <hr className="divider" />
              <button className="btn btn-danger" onClick={() => handleCancel(appt.id)}>
                Cancel appointment
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}