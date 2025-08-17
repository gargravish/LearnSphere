import React from 'react';
import SettingsPage from './SettingsPage';
import QuizHistory from './QuizHistory';
import KnowledgeTab from './KnowledgeTab';
import Dashboard from './Dashboard';
import RevisionPlan from './RevisionPlan';
import './Options.css';

const Options: React.FC = () => {
  return (
    <div className="options-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <SettingsPage />
      </div>
      <div>
        <Dashboard />
        <div style={{ marginTop: 16 }}>
          <QuizHistory />
        </div>
        <div style={{ marginTop: 16 }}>
          <KnowledgeTab />
        </div>
        <div style={{ marginTop: 16 }}>
          <RevisionPlan />
        </div>
      </div>
    </div>
  );
};

export default Options;
