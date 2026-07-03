import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function FindDoctor() {
  const navigate = useNavigate();
  const [specialisation, setSpecialisation] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [searched, setSearched] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [onLeave, setOnLeave] = useState(false);
  const [error, setError] = useState('');
  const [holding, setHolding] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    const { data } = await api.get('/doctors', {
      params: specialisation ? { specialisation } : {},
    });
    setDoctors(data);
    setSearched(true);
    setSelectedDoctor(null);
    setSlots([]);
  }

  async function loadAvailability(doctor, forDate) {
    setSelectedDoctor(doctor);
    setSlots([]);
    setError('');
    const { data } = await api.get(`/doctors/${doctor.id}/availability`, { params: { date: forDate } });
    setOnLeave(data.onLeave);
    setSlots(data.slots);
  }

  async function handleHold(slotStart) {
    setHolding(true);
    setError('');
    try {
      const { data } = await api.post('/appointments/hold', {
        doctorId: selectedDoctor.id,
        slotStart,
      });
      navigate(`/patient/symptom-form/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'That slot was just taken. Please pick another.');
      loadAvailability(selectedDoctor, date);
    } finally {
      setHolding(false);
    }
  }

  return (
    <div>
      <h1>Find a doctor</h1>
      <form onSubmit={handleSearch} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label>Specialisation</label>
          <input
            placeholder="e.g. General Medicine"
            value={specialisation}
            onChange={(e) => setSpecialisation(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {searched && doctors.length === 0 && (
        <div className="empty-state card">No doctors found.</div>
      )}

      {doctors.map((doc) => (
        <div key={doc.id} className="card">
          <div className="card-row">
            <div>
              <h3 style={{ marginBottom: 2 }}>Dr. {doc.user.name}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                {doc.specialisation} · {doc.slotDurationMin}-min slots
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => loadAvailability(doc, date)}>
              View availability
            </button>
          </div>

          {selectedDoctor?.id === doc.id && (
            <>
              <hr className="divider" />
              <div className="field" style={{ maxWidth: 220 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  min={todayISO()}
                  onChange={(e) => { setDate(e.target.value); loadAvailability(doc, e.target.value); }}
                />
              </div>
              {onLeave && <p className="hint" style={{ color: '#bd4332' }}>Doctor is on leave this date.</p>}
              {!onLeave && slots.length === 0 && <p className="hint">No open slots on this date.</p>}
              {!onLeave && slots.length > 0 && (
                <div className="slot-grid">
                  {slots.map((s) => (
                    <button key={s} className="slot-btn" disabled={holding} onClick={() => handleHold(s)}>
                      {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              )}
              {error && <div className="error-text">{error}</div>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}