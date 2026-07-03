import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import UrgencyChip from '../../components/UrgencyChip';

export default function SymptomForm() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmitSymptoms(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post(`/appointments/${appointmentId}/symptom-form`, { rawSymptoms: symptoms });
      setSummary(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit symptoms. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError('');
    try {
      await api.post(`/appointments/${appointmentId}/confirm`);
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.error || 'Hold expired. Please book again.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>Before your visit</h1>
      <p className="muted">Describe your symptoms. The doctor will see an AI summary before you arrive.</p>

      {!summary && (
        <form onSubmit={handleSubmitSymptoms} className="card">
          <div className="field">
            <label>Your symptoms</label>
            <textarea
              required
              minLength={5}
              placeholder="e.g. Sharp pain in lower right abdomen for 2 days, mild fever since yesterday."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Analysing…' : 'Submit symptoms'}
          </button>
        </form>
      )}

      {summary && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>AI pre-visit summary</div>
          {summary.summaryStatus === 'READY' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <UrgencyChip urgency={summary.urgency} />
              </div>
              <p><strong>Chief complaint:</strong> {summary.chiefComplaint}</p>
              {summary.suggestedQuestions?.length > 0 && (
                <>
                  <strong style={{ fontSize: '0.88rem' }}>Questions to ask your doctor</strong>
                  <ul>{summary.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
            </>
          ) : (
            <p className="muted">AI summary unavailable — your doctor will review your symptoms directly.</p>
          )}
          <hr className="divider" />
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Confirming…' : 'Confirm appointment'}
          </button>
        </div>
      )}
    </div>
  );
}