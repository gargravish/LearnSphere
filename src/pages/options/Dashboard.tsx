import React, { useEffect, useState } from 'react';
import { StorageService } from '@/services/StorageService';
import { KnowledgeAnalysisService, KnowledgeReport } from '@/services/KnowledgeAnalysisService';
import { QuizStats } from '@/db/types';
import { LineChart, BarList } from './components/SimpleCharts';

const formatDate = (ms?: number) => (ms ? new Date(ms).toLocaleString() : '—');

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
  </div>
);

const Chip: React.FC<{ text: string }> = ({ text }) => (
  <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 8px', fontSize: 12 }}>{text}</span>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [report, setReport] = useState<KnowledgeReport | null>(null);
  const [topics, setTopics] = useState<Array<{ topic: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentScores, setRecentScores] = useState<number[]>([]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, t, recent] = await Promise.all([
        KnowledgeAnalysisService.analyze(),
        StorageService.getTopChatTopics(5),
        StorageService.getRecentQuizResults(10)
      ]);
      setReport(r);
      setTopics(t);
      setRecentScores(recent.map((q: any) => q.percentage).reverse());
      // Compute stats from merged analysis summary (includes Dexie + local)
      setStats({
        attempts: r.summary.totalAttempts,
        averageScore: r.summary.overallAverage,
        lastAttemptAt: r.summary.lastAttemptAt
      });
    } catch (e) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const rows: string[] = [];
    rows.push('type,title/url,attempts,average,lastAttempt');
    report.pages.forEach(p => {
      rows.push(['page', (p.documentTitle || p.sourceUrl).replace(/,/g, ' '), p.attempts, Math.round(p.averageScore * 100) / 100, formatDate(p.lastAttemptAt)].join(','));
    });
    rows.push('');
    rows.push('term,count');
    report.weakKeywords.forEach(k => rows.push(`${k.term},${k.count}`));
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learnsphere-dashboard-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    load();
    const handleFocus = () => load();
    window.addEventListener('focus', handleFocus);
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes['quizResults']) {
        load();
      }
    };
    try {
      chrome.storage.onChanged.addListener(listener);
    } catch {}
    return () => {
      window.removeEventListener('focus', handleFocus);
      try { chrome.storage.onChanged.removeListener(listener); } catch {}
    };
  }, []);

  return (
    <div>
      <h3>Dashboard</h3>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <StatCard label="Quiz Attempts" value={String(stats?.attempts ?? 0)} />
        <StatCard label="Average Score" value={`${stats?.averageScore ?? 0}%`} />
        <StatCard label="Last Attempt" value={formatDate(stats?.lastAttemptAt)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Last 10 Scores</div>
        <LineChart values={recentScores} />
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <section>
          <h4>Weak Pages</h4>
          {!report || report.pages.length === 0 ? (
            <p>No data yet. Take quizzes to populate this section.</p>
          ) : (
            <ul>
              {report.pages.slice(0, 5).map((p) => (
                <li key={p.sourceUrl} style={{ marginBottom: 10 }}>
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.documentTitle || p.sourceUrl}</a>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Attempts: {p.attempts} · Avg: {Math.round(p.averageScore * 100) / 100}% · Last: {formatDate(p.lastAttemptAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4>Top Chat Topics</h4>
          {topics.length === 0 ? (
            <p>No chat topics yet.</p>
          ) : (
            <BarList items={topics.map(t => ({ label: t.topic, value: t.count }))} />
          )}
        </section>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={load}>Refresh</button>
        <button onClick={exportCsv} style={{ marginLeft: 8 }}>Export CSV</button>
      </div>
    </div>
  );
};

export default Dashboard;


