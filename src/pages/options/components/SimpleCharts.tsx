import React from 'react';

export const LineChart: React.FC<{
  values: number[]; // 0..100
  width?: number;
  height?: number;
  color?: string;
}> = ({ values, width = 320, height = 80, color = '#2563eb' }) => {
  if (!values || values.length === 0) return null;
  const maxX = width;
  const maxY = height;
  const stepX = values.length > 1 ? maxX / (values.length - 1) : maxX;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = maxY - (Math.max(0, Math.min(100, v)) / 100) * maxY;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  );
};

export const BarList: React.FC<{
  items: Array<{ label: string; value: number }>;
  max?: number;
  color?: string;
}> = ({ items, max, color = '#10b981' }) => {
  if (!items || items.length === 0) return null;
  const localMax = typeof max === 'number' ? max : Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((it) => {
        const pct = Math.round((it.value / localMax) * 100);
        return (
          <div key={it.label}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{it.label} · {it.value}</div>
            <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, background: color, height: 8 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};


