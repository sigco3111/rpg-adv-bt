import React, { useState } from 'react';
import { Scene, PlayerState, SceneType, SceneChoice, CombatEnemyInstance, Skill, StatusEffect } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface GameScreenProps {
  scene: Scene | null;
  player: PlayerState | null; 
  isLoading: boolean;
  isGameOver: boolean;
  isCombatActive: boolean;
  currentEnemies: CombatEnemyInstance[];
  combatTurn: 'player' | 'enemy' | 'enemy_acting' | null;
  playerTargetId: string | null;
  activeSkill: Skill | null;
  combatMessage: string | null;

  onAdvance: (nextSceneId: string | null) => void;
  onChoice: (choice: SceneChoice) => void;
  onResetGame: () => void;
  onRestPlayer: () => void; 
  onOpenShop: (sceneId: string) => void; 
  
  onPlayerAttack: (targetId: string) => void;
  onPlayerSkillAction: (skillId: string, targetId?: string) => void;
  onPlayerUseItemInCombat: (itemId: string, targetId?: string) => void;
  onFleeAttempt: () => void;
  onSetPlayerTarget: (enemyCombatId: string | null) => void;
  onSetActiveSkillForTargeting: (skill: Skill | null) => void;
  onOpenSkillModal: () => void;
  onOpenInventoryModal: () => void;
  onRestartCurrentCombat: () => void;
}

const EnemyStatusEffectsDisplay: React.FC<{ effects: StatusEffect[] }> = ({ effects }) => {
  if (!effects || effects.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {effects.map(effect => (
        <span key={`${effect.id}-${effect.remainingDuration}`} title={`${effect.name} (${effect.remainingDuration}턴)`} className="text-xs">
          {effect.icon}
        </span>
      ))}
    </div>
  );
};


export const GameScreen: React.FC<GameScreenProps> = ({
  scene, player, isLoading, isGameOver,
  isCombatActive, currentEnemies, combatTurn, playerTargetId, activeSkill, combatMessage,
  onAdvance, onChoice, onResetGame, onRestPlayer, onOpenShop,
  onPlayerAttack, onPlayerSkillAction, onPlayerUseItemInCombat, onFleeAttempt,
  onSetPlayerTarget, onSetActiveSkillForTargeting, onOpenSkillModal, onOpenInventoryModal,
  onRestartCurrentCombat
}) => {
  const [isTargetingAttack, setIsTargetingAttack] = useState(false);

  if (isGameOver) {
    return (
       <div className="pixel-panel-inset text-center flex flex-col items-center justify-center h-full p-2">
        <h2 className="pixel-header text-xl text-[var(--pixel-error)] mb-3">게임 오버</h2> 
        <p className="text-sm text-[var(--pixel-text-dim)] mb-4"> 
          여정이 너무 일찍 끝났습니다...
        </p>
        <button
          onClick={onResetGame}
          className="pixel-button pixel-button-primary text-sm" 
          aria-label="새 스크립트로 다시 시작"
        >
          새 스크립트 시작
        </button>
      </div>
    );
  }
  
  if (isLoading && !scene && !isCombatActive && !player) { 
     return (
      <div className="pixel-panel-inset text-center flex flex-col items-center justify-center h-full">
        <LoadingSpinner />
        <p className="text-[var(--pixel-text-dim)] mt-3 text-sm">게임 데이터 로딩...</p> 
      </div>
    );
  }

  if (isCombatActive && player) {
    const handleEnemyClick = (enemyCombatId: string) => {
      if (combatTurn !== 'player') return;
      onSetPlayerTarget(enemyCombatId);
      if (isTargetingAttack) {
        onPlayerAttack(enemyCombatId);
        setIsTargetingAttack(false);
        onSetPlayerTarget(null);
      } else if (activeSkill) {
        if (activeSkill.targetType === 'enemy_single') {
          onPlayerSkillAction(activeSkill.id, enemyCombatId);
        }
        onSetActiveSkillForTargeting(null); 
        onSetPlayerTarget(null);
      }
    };

    return (
      <div className="flex flex-col h-full overflow-y-auto p-1 text-sm"> 
        <h2 className="pixel-header text-lg text-[var(--pixel-error)] mb-1.5 leading-tight"> 
          전투! - {scene?.title}
        </h2>
        
        <div className="mb-2.5 space-y-1.5"> 
          <h3 className="text-sm text-[var(--pixel-highlight)] font-pixel-header">적:</h3> 
          {currentEnemies.map(enemy => (
            <div 
              key={enemy.combatId} 
              onClick={() => (isTargetingAttack || activeSkill?.targetType === 'enemy_single') && enemy.currentHp > 0 && handleEnemyClick(enemy.combatId) }
              className={`p-1.5 rounded-none border-2  
                ${enemy.currentHp <= 0 ? 'bg-[var(--pixel-bg-dark)] opacity-50 border-[var(--pixel-border)]' : 
                  (isTargetingAttack || activeSkill?.targetType === 'enemy_single') ? 'cursor-pointer border-[var(--pixel-highlight)]' : 'bg-[var(--pixel-bg-panel)] border-[var(--pixel-border)]'}
                ${playerTargetId === enemy.combatId && enemy.currentHp > 0 ? 'border-[var(--pixel-highlight)] ring-2 ring-[var(--pixel-highlight)]' : ''}`}
              aria-label={`${enemy.name} HP ${enemy.currentHp}/${enemy.maxHp}`}
            >
              <div className="flex justify-between items-center text-xs"> 
                <span className={enemy.currentHp <= 0 ? "line-through" : ""}>{enemy.name}</span>
                <span>HP: {enemy.currentHp}/{enemy.maxHp}</span>
              </div>
              <div className="w-full bg-[var(--pixel-bg-dark)] h-2.5 mt-1 border border-[var(--pixel-border)] p-px"> 
                <div 
                  className="bg-[var(--pixel-error)] h-full" 
                  style={{ width: `${(enemy.currentHp / (enemy.maxHp || 1)) * 100}%` }}
                ></div>
              </div>
              <EnemyStatusEffectsDisplay effects={enemy.activeStatusEffects} />
            </div>
          ))}
        </div>

        <div className="mb-2.5 p-1.5 bg-[var(--pixel-bg-dark)] border-2 border-[var(--pixel-border)]"> 
          <h3 className="text-sm text-[var(--pixel-success)] font-pixel-header">{player.name}</h3> 
          <div className="text-xs">HP: {player.hp}/{player.maxHp} | MP: {player.mp}/{player.maxMp}</div>
        </div>

        {combatMessage && <p className="text-center text-[var(--pixel-accent)] font-pixel-header my-1.5 text-xs">{combatMessage}</p>} 
        {isTargetingAttack && <p className="text-center text-[var(--pixel-highlight)] my-1 text-xs">공격 대상 선택.</p>} 
        {activeSkill && activeSkill.targetType === 'enemy_single' && <p className="text-center text-[var(--pixel-highlight)] my-1 text-xs">{activeSkill.name} 스킬 대상 선택.</p>}

        {combatTurn === 'player' && (
          <div className="grid grid-cols-2 gap-1.5 mt-auto"> 
            <button
              onClick={() => { 
                setIsTargetingAttack(true); 
                onSetActiveSkillForTargeting(null);
                onSetPlayerTarget(null);
              }}
              className="pixel-button text-xs !bg-[var(--pixel-error)]" 
            >공격</button>
            <button
              onClick={() => {
                setIsTargetingAttack(false);
                onSetPlayerTarget(null);
                onOpenSkillModal();
              }}
              className="pixel-button text-xs !bg-[var(--pixel-mp)]" 
            >스킬</button>
            <button
              onClick={() => {
                setIsTargetingAttack(false);
                onSetActiveSkillForTargeting(null);
                onSetPlayerTarget(null);
                onOpenInventoryModal();
              }}
              className="pixel-button text-xs !bg-[var(--pixel-success)]" 
            >아이템</button>
            <button
              onClick={() => {
                setIsTargetingAttack(false);
                onSetActiveSkillForTargeting(null);
                onSetPlayerTarget(null);
                onFleeAttempt();
              }}
              className={`pixel-button text-xs ${scene?.type === SceneType.COMBAT_BOSS ? '!bg-gray-500 !text-gray-400 !cursor-not-allowed' : '!bg-[var(--pixel-accent)] !text-[var(--pixel-bg-dark)]'}`} 
              disabled={scene?.type === SceneType.COMBAT_BOSS}
            >도망</button>
          </div>
        )}
        {combatTurn === 'enemy_acting' && (
            <div className="text-center text-[var(--pixel-text-dim)] mt-auto py-1.5 text-sm">적의 턴...</div> 
        )}
      </div>
    );
  }

  if (!isCombatActive && scene && player && player.hp > 0 && !isGameOver) {
    if (scene.type === SceneType.COMBAT_NORMAL) {
      return (
        <div className="flex flex-col h-full overflow-y-auto p-1.5 text-sm"> 
          <div className="mb-2.5 pr-0.5">
            <h2 className="pixel-header text-lg text-[var(--pixel-success)] mb-1.5 leading-tight">{scene.title} - 전투 승리!</h2>
            <p className="text-sm text-[var(--pixel-text-dim)] mb-2.5 whitespace-pre-line leading-relaxed">
              {combatMessage || "적을 물리쳤다. 다시 싸우거나 진행한다."}
            </p>
          </div>
          <div className="space-y-1.5 mt-auto"> 
            <button
              onClick={onRestartCurrentCombat}
              disabled={isLoading}
              className="pixel-button pixel-button-primary w-full text-xs" 
              aria-label="다시 싸우기"
            >
              다시 싸우기
            </button>
            {scene.nextSceneId && (
              <button
                onClick={() => onAdvance(scene.nextSceneId)}
                disabled={isLoading}
                className="pixel-button w-full text-xs" 
                aria-label="계속 진행"
              >
                계속 진행
              </button>
            )}
            {!scene.nextSceneId && (
               <p className="text-center text-[var(--pixel-border)] italic py-1.5 text-xs">다음 경로 없음.</p>
            )}
          </div>
        </div>
      );
    } else if (scene.type === SceneType.TOWN) {
      return (
        <div className="flex flex-col h-full overflow-y-auto p-1.5 text-sm"> 
          <div className="mb-2.5 pr-0.5">
            <h2 className="pixel-header text-lg text-[var(--pixel-highlight)] mb-1.5 leading-tight">{scene.title}</h2>
          </div>
          <div className="space-y-1.5 mt-auto"> 
            <p className="text-sm text-[var(--pixel-text-dim)] mb-1.5 text-center">무엇을 할까?</p>
            <button
              onClick={() => onOpenShop(scene.id)}
              disabled={isLoading}
              className="pixel-button w-full text-xs !bg-[var(--pixel-accent)] !text-[var(--pixel-bg-dark)]" 
            >상점</button>
            <button
              onClick={onRestPlayer}
              disabled={isLoading}
              className="pixel-button w-full text-xs !bg-[var(--pixel-success)]" 
            >휴식 (HP/MP 회복)</button>
            {scene.nextSceneId && (
              <button
                onClick={() => onAdvance(scene.nextSceneId)}
                disabled={isLoading}
                className="pixel-button w-full text-xs" 
              >마을 떠나기</button>
            )}
            {!scene.nextSceneId && (
               <p className="text-center text-[var(--pixel-border)] italic py-1.5 text-xs">다음 경로 없음.</p>
            )}
          </div>
        </div>
      );
    } else { 
      const showContinueButton = scene.type !== SceneType.CHOICE && scene.nextSceneId;
      return (
        <div className="flex flex-col h-full overflow-y-auto p-1.5 text-sm"> 
          <div className="mb-2.5 pr-0.5 flex-grow">
            <h2 className="pixel-header text-lg text-[var(--pixel-highlight)] mb-1.5 leading-tight">{scene.title}</h2>
            <p className="text-sm text-[var(--pixel-text)] whitespace-pre-line leading-relaxed">{scene.content}</p> 
          </div>
          
          <div className="space-y-1.5 mt-auto"> 
            {scene.type === SceneType.CHOICE && scene.choices && scene.choices.length > 0 && (
              <div className="space-y-1.5"> 
                {scene.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => onChoice(choice)}
                    disabled={isLoading}
                    className="pixel-button w-full text-xs" 
                  >{choice.text}</button>
                ))}
              </div>
            )}

            {showContinueButton && (
              <button
                onClick={() => onAdvance(scene.nextSceneId!)}
                disabled={isLoading}
                className="pixel-button w-full text-xs" 
              >계속하기</button>
            )}
            
            {!scene.nextSceneId && scene.type !== SceneType.CHOICE && (
               <p className="text-center text-[var(--pixel-border)] italic py-1.5 text-xs">다음 경로 없음.</p>
            )}
          </div>
        </div>
      );
    }
  }

  if (!isLoading) {
      return (
        <div className="pixel-panel-inset text-center flex flex-col items-center justify-center h-full p-2">
            <p className="text-[var(--pixel-text-dim)] text-sm">시작할 장면이 없습니다.</p> 
            <button
                onClick={onResetGame} 
                className="pixel-button pixel-button-primary mt-3 text-sm" 
            >
                메인 메뉴
            </button>
        </div>
    );
  }
  
  return <div className="pixel-panel-inset text-center flex flex-col items-center justify-center h-full"><LoadingSpinner /><p className="text-[var(--pixel-text-dim)] mt-3 text-sm">로딩 중...</p></div>; 
};