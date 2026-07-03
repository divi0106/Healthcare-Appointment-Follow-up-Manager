import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import UrgencyChip from '../../components/UrgencyChip';
import StatusBadge from '../../components/StatusBadge';

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export default function DoctorQueue() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments').then(({ data }) => {
      setAppointments(data.filter((a) => isToday(a.slotStart) && a.status === 'CONFIRMED'));
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="muted">Loading today's queue…</p>;

  return (
    <div>
      <h1>Today's queue</h1>
      {appointments.length === 0 && (
        <div className="empty-state card">No confirmed appointments for today.</div>
      )}
      {appointments
        .sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart))
        .map((appt) => (
          <div key={appt.id} className="card">
            <div className="card-row">
              <div>
                <h3 style={{ marginBottom: 2 }}>{appt.patient.name}</h3>
                <p className="muted mono" style={{ marginBottom: 0, fontFamily: 'monospace' }}>
                  {new Date(appt.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

            {appt.symptomForm && (
              <>
                <hr className="divider" />
                {appt.symptomForm.summaryStatus === 'READY' ? (
                  <>
                    <p><strong>Chief complaint:</strong> {appt.symptomForm.chiefComplaint}</p>
                    <p className="muted" style={{ fontSize: '0.88rem' }}>
                      "{appt.symptomForm.rawSymptoms}"
                    </p>
                  </>
                ) : (
                  <p className="muted">AI summary pending — raw symptoms: "{appt.symptomForm.rawSymptoms}"</p>
                )}
              </>
            )}

            <hr className="divider" />
            <Link to={`/doctor/post-visit/${appt.id}`} className="btn btn-primary">
              Complete visit notes
            </Link>
          </div>
        ))}
    </div>
  );
}