import React, { useEffect, useState } from 'react';
import { KnowledgeAnalysisService, KnowledgeReport } from '@/services/KnowledgeAnalysisService';

const KnowledgeTab: React.FC = () => {
  const [report, setReport] = useState<KnowledgeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await KnowledgeAnalysisService.analyze();
      setReport(r);
    } catch (e) {
      setError('Failed to analyze knowledge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Analyzing…</div>;
  if (error) return <div style={{ color: '#ef4444' }}>{error}</div>;
  if (!report) return null;

  return (
    <div className="settings-tab">
      <h3>Knowledge Gap Analysis</h3>
      <div style={{ marginBottom: 8, color: '#64748b' }}>
        Attempts: {report.summary.totalAttempts} · Avg Score: {report.summary.overallAverage}%
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <section>
          <h4>Weak Pages (lowest average first)</h4>
          {report.pages.length === 0 && <p>No quiz data yet.</p>}
          <ul>
            {report.pages.slice(0, 10).map((p) => (
              <li key={p.sourceUrl} style={{ marginBottom: 10 }}>
                <a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.documentTitle || p.sourceUrl}</a>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Attempts: {p.attempts} · Avg: {Math.round(p.averageScore * 100) / 100}%
                </div>
                {p.recentMissed.length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary>Recent missed questions</summary>
                    <ul>
                      {p.recentMissed.map((m, idx) => (
                        <li key={idx}>
                          {m.question}
                          {m.explanation && (
                            <div style={{ fontSize: 12, color: '#475569' }}>Explanation: {m.explanation}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Frequent Weak Terms</h4>
          {report.weakKeywords.length === 0 && <p>No weak terms yet.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {report.weakKeywords.map(k => (
              <span key={k.term} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', fontSize: 12 }}>
                {k.term} · {k.count}
              </span>
            ))}
          </div>
        </section>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={load}>Re-analyze</button>
      </div>
    </div>
  );
};

export default KnowledgeTab;


