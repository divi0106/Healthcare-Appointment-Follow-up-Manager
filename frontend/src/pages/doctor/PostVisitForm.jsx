import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const emptyItem = () => ({ drugName: '', dosage: '', frequencyPerDay: 1, durationDays: 5, instructions: '' });

export default function PostVisitForm() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        doctorNotes: notes,
        prescriptionItems: items
          .filter((it) => it.drugName.trim())
          .map((it) => ({
            ...it,
            frequencyPerDay: Number(it.frequencyPerDay),
            durationDays: Number(it.durationDays),
          })),
      };
      const { data } = await api.post(`/appointments/${appointmentId}/post-visit`, payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit notes. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h1>Visit completed</h1>
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Patient summary</div>
          {result.summaryStatus === 'READY' ? (
            <p>{result.patientSummary}</p>
          ) : (
            <p className="muted">Patient summary is being generated and will appear shortly.</p>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/doctor')}>
            Back to queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Complete visit notes</h1>
      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>Clinical notes</label>
          <textarea
            required
            minLength={5}
            placeholder="Diagnosis, observations, treatment reasoning…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="section-title">Prescription</div>
        {items.map((item, i) => (
          <div key={i} className="card" style={{ background: '#f6f4ef' }}>
            <div className="field-row">
              <div className="field">
                <label>Drug name</label>
                <input value={item.drugName} onChange={(e) => updateItem(i, 'drugName', e.target.value)} />
              </div>
              <div className="field">
                <label>Dosage</label>
                <input placeholder="e.g. 500mg" value={item.dosage} onChange={(e) => updateItem(i, 'dosage', e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Times per day</label>
                <input type="number" min={1} max={6} value={item.frequencyPerDay} onChange={(e) => updateItem(i, 'frequencyPerDay', e.target.value)} />
              </div>
              <div className="field">
                <label>Duration (days)</label>
                <input type="number" min={1} max={180} value={item.durationDays} onChange={(e) => updateItem(i, 'durationDays', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Instructions (optional)</label>
              <input placeholder="e.g. take after meals" value={item.instructions} onChange={(e) => updateItem(i, 'instructions', e.target.value)} />
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-secondary" onClick={() => setItems((p) => [...p, emptyItem()])}>
          + Add medication
        </button>

        {error && <div className="error-text">{error}</div>}
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Complete visit'}
          </button>
        </div>
      </form>
    </div>
  );
}