import React, { useEffect, useState } from 'react';
import { StorageService } from '@/services/StorageService';
import { QuizResult } from '@/db/types';

const formatDate = (ms: number) => new Date(ms).toLocaleString();

const ScoreBadge: React.FC<{ pct: number }> = ({ pct }) => {
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <span style={{
      background: '#f1f5f9',
      border: `1px solid ${color}`,
      color,
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12
    }}>{pct}%</span>
  );
};

const QuizHistory: React.FC = () => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await StorageService.getRecentQuizResults(50);
      setResults(items);
    } catch (e) {
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Loading results…</div>;
  if (error) return <div style={{ color: '#ef4444' }}>{error}</div>;

  return (
    <div>
      <h3>Quiz Results</h3>
      {results.length === 0 && (
        <p>No results yet. Take a quiz to see your history here.</p>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {results.map((r) => (
          <details key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
            <summary style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <strong>{r.documentTitle || 'Untitled'}</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>{formatDate(r.createdAt)}</div>
              </div>
              <ScoreBadge pct={r.percentage} />
            </summary>
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <a href={r.sourceUrl} target="_blank" rel="noreferrer">Open source page</a>
                <div style={{ fontSize: 12, color: '#64748b' }}>Score: {r.correctCount}/{r.totalQuestions}</div>
              </div>
              <ol style={{ marginLeft: 18 }}>
                {r.details.map((d, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600 }}>{d.question}</div>
                    <ul style={{ marginLeft: 16 }}>
                      {d.options.map((o, idx) => (
                        <li key={idx}
                          style={{
                            color: idx === d.correctIndex ? '#16a34a' : idx === d.selectedIndex && !d.isCorrect ? '#ef4444' : undefined
                          }}>
                          {idx === d.selectedIndex ? '• ' : '- '}{o}
                          {idx === d.correctIndex ? ' (correct)' : ''}
                        </li>
                      ))}
                    </ul>
                    <div style={{ fontSize: 12, color: d.isCorrect ? '#16a34a' : '#ef4444' }}>
                      {d.isCorrect ? 'You answered correctly.' : 'Your answer was incorrect.'}
                    </div>
                    {d.explanation && (
                      <div style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e5e7eb', padding: 8, borderRadius: 6, marginTop: 6 }}>
                        <strong>Explanation:</strong> {d.explanation}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={load}>Refresh</button>
      </div>
    </div>
  );
};

export default QuizHistory;


