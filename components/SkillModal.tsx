import React from 'react';
import { PlayerState, Skill } from '../types';
import { getSkillDefinition, ALL_STATUS_EFFECT_DEFINITIONS } from '../constants';

interface SkillModalProps {
  player: PlayerState;
  isOpen: boolean;
  onClose: () => void;
  onUseSkill: (skillId: string, targetId?: string) => void;
  isCombatMode: boolean;
  onSetActiveSkillForTargeting?: (skill: Skill) => void;
}

const SkillCard: React.FC<{
  skill: Skill;
  playerMp: number;
  onAction: () => void;
}> = ({ skill, playerMp, onAction }) => {
  const canUseSkill = playerMp >= skill.mpCost;

  const getAppliesEffectDescription = () => {
    if (skill.appliesStatusEffect) {
      const effectDef = ALL_STATUS_EFFECT_DEFINITIONS[skill.appliesStatusEffect.effectId];
      if (effectDef) {
        let desc = `${effectDef.name} 부여`;
        if (skill.appliesStatusEffect.chance && skill.appliesStatusEffect.chance < 1) {
          desc += ` (${Math.round(skill.appliesStatusEffect.chance * 100)}%)`;
        }
        return desc;
      }
    }
    return '';
  };
  const appliesEffectDesc = getAppliesEffectDescription();
  
  return (
    <div className={`bg-[var(--pixel-bg-dark)] p-2 border-2 flex flex-col text-sm ${canUseSkill ? 'border-[var(--pixel-border)]' : 'border-[var(--pixel-error)] opacity-70'}`}> 
      <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1 truncate leading-tight"> 
        {skill.icon && <span className="mr-1.5">{skill.icon}</span>}
        {skill.name}
      </h4>
      <p className="text-xs text-[var(--pixel-text-dim)] mb-1">MP: {skill.mpCost}</p> 
      <p className="text-xs text-[var(--pixel-text)] mb-1.5 flex-grow min-h-[28px] leading-relaxed">{skill.description}</p> 
      {skill.effectValue && skill.effectType !== 'etc' && <p className="text-xs text-[var(--pixel-success)]">효과치: {skill.effectValue}</p>} 
      {appliesEffectDesc && <p className="text-xs text-[var(--pixel-accent)]">추가 효과: {appliesEffectDesc}</p>}
      <button
        onClick={onAction}
        disabled={!canUseSkill}
        className="pixel-button mt-1.5 w-full text-xs !py-1.5 !px-2 !bg-[var(--pixel-mp)]" 
      >
        사용
      </button>
    </div>
  );
};

export const SkillModal: React.FC<SkillModalProps> = ({ 
  player, isOpen, onClose, onUseSkill, isCombatMode, onSetActiveSkillForTargeting 
}) => {
  if (!isOpen) return null;

  const learnedSkills = player.learnedSkillIds
    .map(id => getSkillDefinition(id))
    .filter(skill => skill !== undefined) as Skill[];

  const handleSkillAction = (skill: Skill) => {
    if (player.mp < skill.mpCost) return;

    if (isCombatMode) {
      if (skill.targetType === 'enemy_single' && onSetActiveSkillForTargeting) {
        onSetActiveSkillForTargeting(skill);
        onClose(); 
      } else {
        onUseSkill(skill.id); 
        if(skill.targetType !== 'enemy_single') onClose();
      }
    } else {
      // Non-combat skill usage (primarily self-buffs or heals)
      if (skill.targetType === 'self' || skill.effectType === 'heal_hp' || skill.effectType === 'heal_mp' || skill.appliesStatusEffect?.effectId === 'attack_buff') {
         onUseSkill(skill.id);
      } else {
        console.log(`${skill.name} - 전투 중에만 사용 가능하거나, 비전투 시 자신에게 사용할 수 없는 스킬입니다.`);
        // Optionally add a log entry here for user feedback
      }
      onClose();
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="skill-modal-title">
      <div className="modal-content w-full max-w-xl">
        <div className="flex justify-between items-center mb-4"> 
          <h2 id="skill-modal-title" className="pixel-header text-xl !mb-0 !pb-0 !border-none text-[var(--pixel-highlight)]">스킬 목록</h2>
          <div className="text-base text-[var(--pixel-mp)]">MP: {player.mp}/{player.maxMp}</div> 
          <button onClick={onClose} className="text-[var(--pixel-text-dim)] text-3xl leading-none" aria-label="스킬 목록 닫기">&times;</button> 
        </div>

        {learnedSkills.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1.5"> 
            {learnedSkills.map(skillDef => (
              <SkillCard
                key={skillDef.id}
                skill={skillDef}
                playerMp={player.mp}
                onAction={() => handleSkillAction(skillDef)}
              />
            ))}
          </div>
        ) : (
          <p className="text-[var(--pixel-text-dim)] italic text-center py-3 text-sm">습득한 스킬이 없습니다.</p> 
        )}

        <button 
          onClick={onClose} 
          className="pixel-button w-full mt-5 text-sm" 
        >
          닫기
        </button>
      </div>
    </div>
  );
};