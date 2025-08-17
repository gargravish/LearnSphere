import React from 'react';
import SettingsPage from './SettingsPage';
import QuizHistory from './QuizHistory';
import KnowledgeTab from './KnowledgeTab';
import './Options.css';

const Options: React.FC = () => {
  return (
    <div className="options-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <SettingsPage />
      </div>
      <div>
        <QuizHistory />
        <div style={{ marginTop: 16 }}>
          <KnowledgeTab />
        </div>
      </div>
    </div>
  );
};

export default Options;
