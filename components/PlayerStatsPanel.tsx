import React from 'react';
import { PlayerState, StatusEffect } from '../types';
import { getSkillDefinition } from '../constants';

interface PlayerStatsPanelProps {
  player: PlayerState | null;
}

const PixelStatBar: React.FC<{current: number, max: number, color: string, label: string}> = ({ current, max, color, label}) => (
  <div className="mb-2"> 
    <div className="text-xs text-[var(--pixel-text-dim)] mb-0.5 flex justify-between">
      <span className="font-pixel-header text-[0.7em]">{label}</span> 
      <span>{current}/{max}</span>
    </div>
    <div className="h-3.5 bg-[var(--pixel-bg-dark)] border border-[var(--pixel-border)] p-0.5"> 
      <div style={{ width: `${Math.max(0, Math.min(100, (current / max) * 100))}%`, backgroundColor: color, height: '100%' }} />
    </div>
  </div>
);

const StatGridItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-[var(--pixel-bg-dark)] p-1.5 border border-[var(--pixel-border)] text-center"> 
    <div className="font-pixel-header text-[0.65em] text-[var(--pixel-highlight)] leading-tight">{label}</div> 
    <div className="text-sm font-semibold text-[var(--pixel-text)] leading-tight mt-0.5">{value}</div> 
  </div>
);

const StatusEffectDisplay: React.FC<{ effect: StatusEffect }> = ({ effect }) => (
  <li 
    className={`text-xs p-1 border border-[var(--pixel-border)] flex items-center gap-1 truncate ${effect.isBuff ? 'bg-green-900/50' : 'bg-red-900/50'}`}
    title={`${effect.name}: ${effect.description} (남은 턴: ${effect.remainingDuration})`}
  >
    <span className="text-sm">{effect.icon}</span>
    <span className="flex-grow truncate">{effect.name}</span>
    <span className="text-[var(--pixel-text-dim)]">({effect.remainingDuration}턴)</span>
  </li>
);


export const PlayerStatsPanel: React.FC<PlayerStatsPanelProps> = ({ player }) => {
  if (!player) {
    return (
      <div className="pixel-panel-inset h-full text-center flex items-center justify-center">
        <p className="text-[var(--pixel-text-dim)] text-sm">플레이어 데이터...</p>
      </div>
    );
  }

  const learnedSkills = player.learnedSkillIds
    .map(id => getSkillDefinition(id))
    .filter(skill => skill !== undefined);

  return (
    <div className="h-full flex flex-col space-y-2 overflow-y-auto text-sm pr-1"> 
      <h3 className="pixel-header text-base leading-tight"> 
        {player.name} - LV {player.level}
      </h3>
      
      <PixelStatBar current={player.hp} max={player.maxHp} color="var(--pixel-success)" label="HP" />
      <PixelStatBar current={player.mp} max={player.maxMp} color="var(--pixel-mp)" label="MP" />

      <div className="grid grid-cols-2 gap-1.5"> 
        <StatGridItem label="경험치" value={`${player.exp}/${player.expToNextLevel}`} />
        <StatGridItem label="골드" value={`${player.gold} G`} />
        <StatGridItem label="공격" value={player.attack} />
        <StatGridItem label="방어" value={player.defense} />
        <StatGridItem label="속도" value={player.speed} />
        <StatGridItem label="행운" value={player.luck} />
        <StatGridItem label="치명타" value={`${player.critChance}%`} />
        <StatGridItem label="위치" value={player.currentLocation} />
      </div>
      
      {player.activeStatusEffects && player.activeStatusEffects.length > 0 && (
        <div className="pt-1.5 border-t-2 border-[var(--pixel-border)]">
          <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1">상태 효과:</h4>
          <ul className="space-y-1 text-xs max-h-20 overflow-y-auto">
            {player.activeStatusEffects.map((effect) => (
              <StatusEffectDisplay key={`${effect.id}-${effect.remainingDuration}`} effect={effect} />
            ))}
          </ul>
        </div>
      )}

      <div className="pt-1.5 border-t-2 border-[var(--pixel-border)]"> 
        <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1">장비:</h4> 
        <div className="text-xs space-y-1"> 
          <p><span className="font-medium text-[var(--pixel-text-dim)]">무기:</span> {player.equipment.weapon?.name || <span className="italic text-[var(--pixel-border)]">없음</span>}</p>
          <p><span className="font-medium text-[var(--pixel-text-dim)]">갑옷:</span> {player.equipment.armor?.name || <span className="italic text-[var(--pixel-border)]">없음</span>}</p>
          <p><span className="font-medium text-[var(--pixel-text-dim)]">장신구:</span> {player.equipment.accessory?.name || <span className="italic text-[var(--pixel-border)]">없음</span>}</p>
        </div>
      </div>

      <div className="pt-1.5 border-t-2 border-[var(--pixel-border)]"> 
        <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1">스킬:</h4> 
        {learnedSkills.length > 0 ? (
          <ul className="space-y-1 text-xs max-h-24 overflow-y-auto"> 
            {learnedSkills.map((skill) => skill && (
              <li key={skill.id} className="text-[var(--pixel-text)] bg-[var(--pixel-bg-dark)] p-1 border border-[var(--pixel-border)] truncate"> 
                {skill.icon && <span className="mr-1.5">{skill.icon}</span>}
                {skill.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--pixel-border)] italic text-center">스킬 없음</p>
        )}
      </div>

      <div className="flex-grow mt-1.5 pt-1.5 border-t-2 border-[var(--pixel-border)]"> 
        <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1">주요 소지품:</h4> 
        {player.inventory.filter(item => item.type === 'keyItem').length > 0 ? (
          <ul className="space-y-1 max-h-20 overflow-y-auto pr-0.5 text-xs"> 
            {player.inventory.filter(item => item.type === 'keyItem').map((item) => (
              <li key={item.id} className="text-[var(--pixel-text)] bg-[var(--pixel-bg-dark)] p-1 border border-[var(--pixel-border)] truncate"> 
                {item.icon && <span className="mr-1.5">{item.icon}</span>}
                {item.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--pixel-border)] italic text-center">주요 소지품 없음</p>
        )}
      </div>
    </div>
  );
};