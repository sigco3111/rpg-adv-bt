import React from 'react';
import { PlayerState, StatChartData } from '../types';
import { MAX_STAT_VALUE_FOR_CHART } from '../constants';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatsChartModalProps {
  player: PlayerState;
  onClose: () => void;
}

export const StatsChartModal: React.FC<StatsChartModalProps> = ({ player, onClose }) => {
  const data: StatChartData[] = [
    { subject: '공격', value: player.attack, fullMark: MAX_STAT_VALUE_FOR_CHART },
    { subject: '방어', value: player.defense, fullMark: MAX_STAT_VALUE_FOR_CHART },
    { subject: '속도', value: player.speed, fullMark: MAX_STAT_VALUE_FOR_CHART },
    { subject: 'HP', value: player.maxHp, fullMark: Math.max(player.maxHp, MAX_STAT_VALUE_FOR_CHART + 20) },
    { subject: 'MP', value: player.maxMp, fullMark: Math.max(player.maxMp, MAX_STAT_VALUE_FOR_CHART) },
    { subject: '행운', value: player.luck, fullMark: MAX_STAT_VALUE_FOR_CHART },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-lg"> {/* Slightly wider */}
        <div className="flex justify-between items-center mb-4"> {/* Increased margin */}
          <h2 className="pixel-header text-xl !mb-0 !pb-0 !border-none text-[var(--pixel-highlight)]">능력치 프로필</h2>
          <button onClick={onClose} className="text-[var(--pixel-text-dim)] text-3xl leading-none">&times;</button> {/* Larger close button, hover removed */}
        </div>
        
        <div style={{ width: '100%', height: 320 }} className="bg-[var(--pixel-bg-dark)] border-2 border-[var(--pixel-border)] p-2"> {/* Increased height and padding */}
          <ResponsiveContainer>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} style={{ fontFamily: "'VT323', monospace", fontSize: '12px' }}> {/* VT323 for chart text, increased base font size */}
              <PolarGrid stroke="var(--pixel-border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--pixel-text-dim)', fontSize: 11 }} /> {/* Increased tick font size */}
              <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 10']} tick={{ fill: 'var(--pixel-border)', fontSize: 10 }} /> {/* Increased tick font size */}
              <Radar name={player.name} dataKey="value" stroke="var(--pixel-highlight)" fill="var(--pixel-highlight)" fillOpacity={0.6} />
              <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'var(--pixel-bg-panel)', 
                    border: '2px solid var(--pixel-border)', 
                    fontFamily: "'VT323', monospace",
                    fontSize: '12px', /* Increased tooltip font size */
                    color: 'var(--pixel-text)'
                }} 
                itemStyle={{color: 'var(--pixel-text)'}}
                labelStyle={{color: 'var(--pixel-highlight)', fontFamily: "'Press Start 2P', cursive", fontSize: '11px'}} /* Tooltip title with Press Start 2P */
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px', fontFamily: "'VT323', monospace" }} /* Increased font size and padding */
                payload={[{ value: player.name, type: 'line', color: 'var(--pixel-highlight)' }]}
                formatter={(value) => <span style={{color: 'var(--pixel-text)'}}>{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <button 
          onClick={onClose} 
          className="pixel-button w-full mt-5 text-sm" /* Button text uses Press Start 2P, larger */
        >
          닫기
        </button>
      </div>
    </div>
  );
};