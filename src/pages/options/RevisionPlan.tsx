import React, { useEffect, useState } from 'react';
import { RevisionPlanService } from '@/services/RevisionPlanService';
import { RevisionPlan, RevisionPlanItem } from '@/db/types';

const RevisionPlanView: React.FC = () => {
  const [plan, setPlan] = useState<RevisionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const latest = await RevisionPlanService.getLatest();
      if (latest) setPlan(latest as RevisionPlan);
    } catch (e) {
      setError('Failed to load revision plan');
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const p = await RevisionPlanService.generate();
      setPlan(p);
    } catch (e) {
      setError('Failed to generate revision plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h3>Revision Plan</h3>
      {loading && <div>Working…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {!plan && (
        <div>
          <p>No revision plan yet.</p>
          <button onClick={generate}>Generate Plan</button>
        </div>
      )}
      {plan && (
        <div>
          <div style={{ marginBottom: 8, color: '#64748b' }}>Created: {new Date(plan.createdAt).toLocaleString()}</div>
          <ol style={{ marginLeft: 18 }}>
            {plan.items.map((it: RevisionPlanItem, idx: number) => (
              <li key={idx} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{it.title}</strong>
                  <span style={{ fontSize: 12, color: '#475569' }}>{it.status}</span>
                </div>
                {it.description && <div style={{ fontSize: 13, color: '#334155' }}>{it.description}</div>}
                {it.sourceUrl && (
                  <div style={{ fontSize: 12 }}>
                    <a href={it.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div>
            <button onClick={generate}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevisionPlanView;


