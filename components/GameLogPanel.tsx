import React, { useEffect, useRef } from 'react';
import { GameLogEntry } from '../types';

interface GameLogPanelProps {
  logEntries: GameLogEntry[];
}

export const GameLogPanel: React.FC<GameLogPanelProps> = ({ logEntries }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "auto" }); 
  }, [logEntries]);

  const getEntryStyle = (type: GameLogEntry['type']): string => {
    switch (type) {
      case 'narration': return 'log-narration';
      case 'dialogue': return 'log-dialogue';
      case 'event': return 'log-event';
      case 'reward': return 'log-reward';
      case 'error': return 'log-error';
      case 'location': return 'log-location';
      case 'system': return 'log-system';
      case 'combat': return 'log-combat';
      case 'combat_action': return 'log-combat_action';
      case 'combat_result': return 'log-combat_result';
      default: return 'text-[var(--pixel-text)]';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="pixel-header text-base leading-tight">게임 로그</h3> {/* Slightly larger header */}
      <div className="flex-grow overflow-y-auto space-y-1.5 pr-1 text-sm leading-relaxed"> {/* Increased base font size, spacing, line-height */}
        {logEntries.length === 0 && (
          <p className="log-system text-center italic py-2.5">모험을 시작하세요...</p>
        )}
        {logEntries.map((entry) => (
          <div key={entry.id} className={`p-1 rounded-sm ${getEntryStyle(entry.type)} bg-[var(--pixel-bg-dark)] border border-[var(--pixel-border)]`}> {/* Increased padding */}
            {entry.type === 'dialogue' && entry.speaker && (
              <span className="log-dialogue-speaker mr-1.5">{entry.speaker}:</span>
            )}
            {entry.message}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};