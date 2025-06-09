
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  GameScript, Stage, Scene, PlayerState, Character, SceneChoice, GameLogEntry, SceneType, CharacterType, GameItem, PlayerEquipment, CombatEnemyInstance, Skill, MinimapLayoutNode, MinimapLayoutEdge, MinimapNodeData, GameLogicHookState, StatusEffect, StatusEffectId, StatusEffectDefinition
} from '../types';
import { 
  LOCAL_STORAGE_SCRIPT_KEY, PLAYER_DEFAULT_HP, PLAYER_DEFAULT_GOLD, PLAYER_DEFAULT_EXP, 
  COMBAT_REWARDS, PLAYER_DEFAULT_MP, PLAYER_DEFAULT_LEVEL, PLAYER_DEFAULT_EXP_TO_NEXT_LEVEL,
  PLAYER_DEFAULT_BASE_ATTACK, PLAYER_DEFAULT_BASE_DEFENSE, PLAYER_DEFAULT_BASE_SPEED,
  PLAYER_DEFAULT_BASE_LUCK, PLAYER_DEFAULT_CRIT_CHANCE, ITEM_SMALL_POTION, ITEM_BASIC_SWORD,
  getItemDefinition, SHOP_INVENTORIES, DEFAULT_BUY_PRICE_MULTIPLIER, DEFAULT_SHOP_ITEM_IDS,
  ENEMY_DEFAULT_HP, ENEMY_DEFAULT_ATTACK, ENEMY_DEFAULT_DEFENSE, BOSS_DEFAULT_HP_MULTIPLIER, 
  BOSS_DEFAULT_ATTACK_MULTIPLIER, BOSS_DEFAULT_DEFENSE_MULTIPLIER, PLAYER_DEFAULT_SKILLS, getSkillDefinition,
  EXP_TO_NEXT_LEVEL_MULTIPLIER, LEVEL_UP_HP_GAIN, LEVEL_UP_MP_GAIN, LEVEL_UP_ATTACK_GAIN,
  LEVEL_UP_DEFENSE_GAIN, LEVEL_UP_SPEED_GAIN, LEVEL_UP_LUCK_GAIN, SKILLS_BY_LEVEL,
  LOCAL_STORAGE_GAME_STATE_KEY,
  MINIMAP_NODE_WIDTH, MINIMAP_NODE_HEIGHT, MINIMAP_GAP_X, MINIMAP_GAP_Y,
  ALL_STATUS_EFFECT_DEFINITIONS
} from '../constants';
import { loadFromLocalStorage, saveToLocalStorage, removeFromLocalStorage } from '../utils/localStorage';


const calculateDerivedStats = (
  basePlayer: PlayerState,
  baseEnemy?: CombatEnemyInstance // Changed: Now CombatEnemyInstance
): PlayerState | CombatEnemyInstance => {
  const target = baseEnemy ? {
    ...baseEnemy, // Spreads CombatEnemyInstance (includes activeStatusEffects, skills?, combatId etc)
    baseAttack: baseEnemy.baseAttack ?? ENEMY_DEFAULT_ATTACK,
    baseDefense: baseEnemy.baseDefense ?? ENEMY_DEFAULT_DEFENSE,
    skills: baseEnemy.skills || [], // Ensures target.skills is string[] for convenience
  } : { ...basePlayer };

  let newAttack = target.baseAttack ?? 0;
  let newDefense = target.baseDefense ?? 0;
  let newSpeed = (target as PlayerState).baseSpeed ?? 0;
  let newLuck = (target as PlayerState).baseLuck ?? 0;
  let newMaxHp = target.maxHp;
  let newMaxMp = (target as PlayerState).maxMp ?? 0;
  let newCritChance = (target as PlayerState).critChance ?? PLAYER_DEFAULT_CRIT_CHANCE;

  if (!baseEnemy) { // Player equipment
    Object.values((target as PlayerState).equipment).forEach(item => {
      if (item && item.effects) {
        newAttack += item.effects.attack || 0;
        newDefense += item.effects.defense || 0;
        newSpeed += item.effects.speed || 0;
        newLuck += item.effects.luck || 0;
        newMaxHp += item.effects.hp || 0;
        newMaxMp += item.effects.mp || 0;
        newCritChance += item.effects.critChance || 0;
      }
    });
  }
  
  // Apply status effect stat modifiers
  // target.activeStatusEffects is StatusEffect[] for PlayerState.
  // For enemy, target is { ...CombatEnemyInstance, ... }, so target.activeStatusEffects is StatusEffect[].
  target.activeStatusEffects.forEach(effect => { // Removed ?.
    effect.statModifiers?.forEach(mod => {
      let valueChange = mod.value;
      if (mod.isPercentage) {
        switch(mod.stat) {
          case 'attack': valueChange = (target.baseAttack ?? 0) * mod.value; break;
          case 'defense': valueChange = (target.baseDefense ?? 0) * mod.value; break;
          // Add other stats if they can be percentage modified
        }
      }
      switch(mod.stat) {
        case 'attack': newAttack += valueChange; break;
        case 'defense': newDefense += valueChange; break;
        case 'speed': newSpeed += valueChange; break;
        case 'luck': newLuck += valueChange; break;
        case 'maxHp': newMaxHp += valueChange; break;
        case 'maxMp': newMaxMp += valueChange; break;
        case 'critChance': newCritChance += valueChange; break;
      }
    });
  });
  
  newAttack = Math.max(0, newAttack);
  newDefense = Math.max(0, newDefense);
  newSpeed = Math.max(0, newSpeed);
  newLuck = Math.max(0, newLuck);
  newMaxHp = Math.max(1, newMaxHp);
  newMaxMp = Math.max(0, newMaxMp);
  newCritChance = Math.max(0, Math.min(100, newCritChance));

  const currentHp = Math.min(target.hp, newMaxHp);
  const currentMp = baseEnemy ? 0 : Math.min((target as PlayerState).mp, newMaxMp);


  if (baseEnemy) {
    // When baseEnemy is true, 'target' was constructed from 'baseEnemy' and includes 'skills: string[]'.
    // We assert this type for clarity and to satisfy the compiler if CFA is struggling.
    const enemyTarget = target as (typeof target & { skills: string[] });
    return { 
      ...enemyTarget, 
      attack: newAttack, 
      defense: newDefense, 
      maxHp: newMaxHp,
      hp: currentHp, 
      skills: enemyTarget.skills, 
      currentHp: currentHp, 
    } as CombatEnemyInstance;
  } else {
    return { 
      ...(target as PlayerState), 
      attack: newAttack, defense: newDefense, speed: newSpeed, luck: newLuck, 
      maxHp: newMaxHp, maxMp: newMaxMp, hp: currentHp, mp: currentMp, critChance: newCritChance
    };
  }
};

const initialLogicState: GameLogicHookState = {
  script: null,
  currentStage: null,
  currentScene: null,
  player: null,
  gameLog: [],
  isLoading: false,
  error: null,
  isGameOver: false,
  isShopOpen: false,
  currentShopId: null,
  currentShopItems: [],
  shopError: null,
  isCombatActive: false,
  currentEnemies: [],
  combatTurn: null,
  playerTargetId: null,
  activeSkill: null,
  combatMessage: null,
  isDelegationModeActive: false,
  awaitingPostDelegatedNormalCombatChoice: false,
  lastVisitedTownSceneId: null,
  pendingSafeSceneTransition: null,
  minimapLayout: null,
};


export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameLogicHookState>(initialLogicState);

  const addLogEntry = useCallback((type: GameLogEntry['type'], message: string, speaker?: string) => {
    setGameState(prev => ({
      ...prev,
      gameLog: [...prev.gameLog, { id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now() }].slice(-100) 
    }));
  }, []);

  const toggleDelegationMode = useCallback(() => {
    setGameState(prev => {
      const newMode = !prev.isDelegationModeActive;
      addLogEntry('system', `전투 위임 모드가 ${newMode ? '활성화' : '비활성화'}되었습니다.`);
      return { 
        ...prev, 
        isDelegationModeActive: newMode,
        awaitingPostDelegatedNormalCombatChoice: newMode ? prev.awaitingPostDelegatedNormalCombatChoice : false,
      };
    });
  }, [addLogEntry]);

  const initializePlayer = useCallback((script: GameScript, stage: Stage): PlayerState => {
    const playerChar = stage.characters.find(c => c.type === CharacterType.PLAYER);
    if (!playerChar) throw new Error("플레이어 캐릭터를 스크립트에서 찾을 수 없습니다.");
    
    const initialEquipment: PlayerEquipment = { weapon: null, armor: null, accessory: null };
    const initialInventory: GameItem[] = [];

    const starterPotionDef = getItemDefinition(ITEM_SMALL_POTION.id);
    if (starterPotionDef) initialInventory.push({ ...starterPotionDef, quantity: 3 });
    
    const starterSwordDef = getItemDefinition(ITEM_BASIC_SWORD.id);
    if (starterSwordDef) initialEquipment.weapon = { ...starterSwordDef, quantity: 1};

    let player: PlayerState = {
      name: playerChar.name,
      level: PLAYER_DEFAULT_LEVEL,
      hp: PLAYER_DEFAULT_HP,
      maxHp: PLAYER_DEFAULT_HP,
      mp: PLAYER_DEFAULT_MP,
      maxMp: PLAYER_DEFAULT_MP,
      exp: PLAYER_DEFAULT_EXP,
      expToNextLevel: PLAYER_DEFAULT_EXP_TO_NEXT_LEVEL,
      gold: PLAYER_DEFAULT_GOLD,
      baseAttack: PLAYER_DEFAULT_BASE_ATTACK,
      baseDefense: PLAYER_DEFAULT_BASE_DEFENSE,
      baseSpeed: PLAYER_DEFAULT_BASE_SPEED,
      baseLuck: PLAYER_DEFAULT_BASE_LUCK,
      attack: PLAYER_DEFAULT_BASE_ATTACK, 
      defense: PLAYER_DEFAULT_BASE_DEFENSE,
      speed: PLAYER_DEFAULT_BASE_SPEED,
      luck: PLAYER_DEFAULT_BASE_LUCK,
      critChance: PLAYER_DEFAULT_CRIT_CHANCE,
      inventory: initialInventory,
      equipment: initialEquipment,
      currentLocation: stage.scenes[0]?.newLocationName || script.worldSettings.keyLocations?.split(',')[0]?.trim() || "알 수 없는 위치",
      learnedSkillIds: [...PLAYER_DEFAULT_SKILLS],
      visitedSceneIds: stage.scenes.length > 0 ? [stage.scenes[0].id] : [],
      activeStatusEffects: [],
    };
    
    player = calculateDerivedStats(player) as PlayerState; 
    player.hp = Math.min(player.hp, player.maxHp);
    player.mp = Math.min(player.mp, player.maxMp);

    return player;
  }, []);
  
  const handleLevelUp = useCallback((playerState: PlayerState, currentLog: GameLogEntry[]): { updatedPlayer: PlayerState, newLogEntries: GameLogEntry[] } => {
    let modifiablePlayer = { ...playerState }; 
    let oldLevel = modifiablePlayer.level;
    const newLogEntries: GameLogEntry[] = [];

    const createLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLogEntries.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now() });
    };
  
    while (modifiablePlayer.exp >= modifiablePlayer.expToNextLevel) {
      const oldExpToNextLevel = modifiablePlayer.expToNextLevel;
      
      modifiablePlayer.level += 1;
      modifiablePlayer.exp -= oldExpToNextLevel;
      modifiablePlayer.expToNextLevel = Math.floor(oldExpToNextLevel * EXP_TO_NEXT_LEVEL_MULTIPLIER);
  
      const hpGain = LEVEL_UP_HP_GAIN;
      const mpGain = LEVEL_UP_MP_GAIN;
      const attackGain = LEVEL_UP_ATTACK_GAIN;
      const defenseGain = LEVEL_UP_DEFENSE_GAIN;
      const speedGain = LEVEL_UP_SPEED_GAIN;
      const luckGain = LEVEL_UP_LUCK_GAIN;
  
      modifiablePlayer.maxHp += hpGain;
      modifiablePlayer.maxMp += mpGain;
  
      modifiablePlayer.baseAttack += attackGain;
      modifiablePlayer.baseDefense += defenseGain;
      modifiablePlayer.baseSpeed += speedGain;
      modifiablePlayer.baseLuck += luckGain;
      
      createLog('reward', `${modifiablePlayer.name}이(가) 레벨 ${modifiablePlayer.level}(으)로 상승했습니다!`);
      createLog('event', `최대 HP +${hpGain}, 최대 MP +${mpGain}, 기본 공격력 +${attackGain}, 기본 방어력 +${defenseGain}, 기본 속도 +${speedGain}, 기본 행운 +${luckGain}. HP/MP가 모두 회복되었습니다.`);

      for (let lvl = oldLevel + 1; lvl <= modifiablePlayer.level; lvl++) {
        const skillsForThisLevel = SKILLS_BY_LEVEL[lvl];
        if (skillsForThisLevel) {
          skillsForThisLevel.forEach(skillId => {
            if (!modifiablePlayer.learnedSkillIds.includes(skillId)) {
              modifiablePlayer.learnedSkillIds.push(skillId);
              const newSkillDef = getSkillDefinition(skillId);
              if (newSkillDef) {
                createLog('reward', `${modifiablePlayer.name}이(가) 새로운 스킬 "${newSkillDef.name}"을(를) 습득했습니다!`);
              }
            }
          });
        }
      }
      oldLevel = modifiablePlayer.level; 
    }
    let finalPlayer = calculateDerivedStats(modifiablePlayer) as PlayerState;
    finalPlayer.hp = finalPlayer.maxHp;
    finalPlayer.mp = finalPlayer.maxMp;
    finalPlayer.activeStatusEffects = modifiablePlayer.activeStatusEffects.filter(eff => eff.isBuff); // Clear non-buffs on level up
  
    return { updatedPlayer: finalPlayer, newLogEntries }; 
  }, []);


  const addItemToInventory = (playerState: PlayerState, itemDefinition: GameItem, quantity: number = 1): PlayerState => {
    const newInventory = [...playerState.inventory];
    const existingItemIndex = newInventory.findIndex(i => i.id === itemDefinition.id);

    if (existingItemIndex > -1) {
      newInventory[existingItemIndex] = {
        ...newInventory[existingItemIndex],
        quantity: newInventory[existingItemIndex].quantity + quantity,
      };
    } else {
      newInventory.push({ ...itemDefinition, quantity });
    }
    return { ...playerState, inventory: newInventory };
  };

  const applyStatusEffect = useCallback(<T extends PlayerState | CombatEnemyInstance>(
    target: T, 
    effectId: StatusEffectId, 
    duration: number, 
    potency?: number,
    sourceId?: string
  ): T => {
    const effectDef = ALL_STATUS_EFFECT_DEFINITIONS[effectId];
    if (!effectDef) {
      console.error(`Status effect definition not found for ID: ${effectId}`);
      return target;
    }

    let newActiveEffects = [...(target.activeStatusEffects || [])];
    const existingEffectIndex = newActiveEffects.findIndex(e => e.id === effectId);

    const appliedPotency = potency ?? (effectDef.tickEffect?.basePotency ?? effectDef.statModifiers?.[0]?.value ?? 0);

    if (existingEffectIndex > -1) { // Stack or refresh
      newActiveEffects[existingEffectIndex] = {
        ...newActiveEffects[existingEffectIndex], // Keep original definition parts
        remainingDuration: Math.max(newActiveEffects[existingEffectIndex].remainingDuration, duration), // Or just set to new duration
        appliedPotency: appliedPotency, // Update potency if needed
        sourceCharacterId: sourceId,
      };
    } else {
      newActiveEffects.push({
        ...effectDef,
        remainingDuration: duration,
        appliedPotency: appliedPotency,
        sourceCharacterId: sourceId,
      });
    }
    
    if(effectDef.onApplyLog) addLogEntry('status_effect', effectDef.onApplyLog.replace("{target}", target.name).replace("{effectName}", effectDef.name));

    const updatedTargetWithEffects = { ...target, activeStatusEffects: newActiveEffects };
    
    if ('level' in updatedTargetWithEffects) { // PlayerState
      return calculateDerivedStats(updatedTargetWithEffects as PlayerState) as T;
    } else { // CombatEnemyInstance
        // When applying to an enemy, player state is needed for context in calculateDerivedStats if it were to use player stats.
        // However, calculateDerivedStats for an enemy should primarily use enemy's own stats.
        // Assuming gameState.player is available and up-to-date for any potential contextual needs (though it seems less direct for enemy stat recalc).
        // The first argument to calculateDerivedStats is PlayerState, but it's only used if the second argument (baseEnemy) is undefined.
        // So, we need a "dummy" or current player state here.
        const currentPlayerState = gameState.player || initializePlayer(gameState.script!, gameState.currentStage!); // Fallback, should ideally have player
      return calculateDerivedStats(currentPlayerState, updatedTargetWithEffects as CombatEnemyInstance) as T;
    }
  }, [addLogEntry, gameState.player, gameState.script, gameState.currentStage, initializePlayer]);

  const removeStatusEffect = useCallback(<T extends PlayerState | CombatEnemyInstance>(
    target: T, 
    effectIdToRemove: StatusEffectId | StatusEffectId[]
  ): T => {
    const idsToRemove = Array.isArray(effectIdToRemove) ? effectIdToRemove : [effectIdToRemove];
    let newActiveEffects = target.activeStatusEffects || [];
    let effectRemoved = false;

    idsToRemove.forEach(id => {
      const index = newActiveEffects.findIndex(eff => eff.id === id);
      if (index > -1) {
        const removedEffect = newActiveEffects[index];
        if(removedEffect.onExpireLog) addLogEntry('status_effect', removedEffect.onExpireLog.replace("{target}", target.name).replace("{effectName}", removedEffect.name));
        newActiveEffects = newActiveEffects.filter((_, i) => i !== index);
        effectRemoved = true;
      }
    });
    
    if (!effectRemoved) return target;

    const updatedTargetWithEffectsRemoved = { ...target, activeStatusEffects: newActiveEffects };
    if ('level' in updatedTargetWithEffectsRemoved) { // PlayerState
      return calculateDerivedStats(updatedTargetWithEffectsRemoved as PlayerState) as T;
    } else { // CombatEnemyInstance
      const currentPlayerState = gameState.player || initializePlayer(gameState.script!, gameState.currentStage!); // Fallback
      return calculateDerivedStats(currentPlayerState, updatedTargetWithEffectsRemoved as CombatEnemyInstance) as T;
    }
  }, [addLogEntry, gameState.player, gameState.script, gameState.currentStage, initializePlayer]);


  const processTurnStartStatusEffects = useCallback(<T extends PlayerState | CombatEnemyInstance>(
    target: T, 
    isPlayer: boolean
  ): { updatedTarget: T, preventedAction: boolean, logEntries: GameLogEntry[] } => {
    let updatedEffects: StatusEffect[] = [];
    let hpChange = 0;
    let mpChange = 0;
    let preventedAction = false;
    const turnLogEntries: GameLogEntry[] = [];

    (target.activeStatusEffects || []).forEach(effect => {
      let currentEffect = { ...effect };
      currentEffect.remainingDuration -= 1;

      if (currentEffect.tickEffect) {
        const tickVal = currentEffect.appliedPotency;
        if (currentEffect.tickEffect.statToAffect === 'hp') {
          hpChange += currentEffect.tickEffect.canBeNegative ? -tickVal : tickVal;
        } else if (currentEffect.tickEffect.statToAffect === 'mp') {
          mpChange += currentEffect.tickEffect.canBeNegative ? -tickVal : tickVal;
        }
         if (currentEffect.onTickLog) {
            turnLogEntries.push({ id: crypto.randomUUID(), type: 'status_effect', message: currentEffect.onTickLog.replace("{target}", target.name).replace("{effectName}", currentEffect.name).replace("{value}", Math.abs(tickVal).toString()), timestamp: Date.now() });
        }
      }

      if (currentEffect.preventsAction) {
        preventedAction = true;
        // Log for action prevention can be added here
      }

      if (currentEffect.remainingDuration > 0) {
        updatedEffects.push(currentEffect);
      } else {
        if (currentEffect.onExpireLog) {
            turnLogEntries.push({ id: crypto.randomUUID(), type: 'status_effect', message: currentEffect.onExpireLog.replace("{target}", target.name).replace("{effectName}", currentEffect.name), timestamp: Date.now() });
        }
      }
    });

    let newHp = Math.max(0, Math.min(target.hp + hpChange, target.maxHp));
    let newMp = isPlayer ? Math.max(0, Math.min((target as PlayerState).mp + mpChange, (target as PlayerState).maxMp)) : 0;

    let modifiedTarget = { 
        ...target, 
        hp: newHp, 
        activeStatusEffects: updatedEffects 
    };
    if (isPlayer) (modifiedTarget as PlayerState).mp = newMp;
    
    // Recalculate derived stats after HP/MP changes and effect updates
    const finalTarget = isPlayer 
        ? calculateDerivedStats(modifiedTarget as PlayerState) as T 
        : calculateDerivedStats(gameState.player!, modifiedTarget as CombatEnemyInstance) as T;


    return { updatedTarget: finalTarget, preventedAction, logEntries: turnLogEntries };
  }, [gameState.player]);


  const startCombat = useCallback((scene: Scene) => {
    setGameState(prev => {
      if (!prev.script || !prev.currentStage || !prev.player) return prev;
      let newLog = [...prev.gameLog];
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };

      const enemyDefinitions = scene.combatDetails?.enemyCharacterIds
        .map(id => prev.currentStage?.characters.find(c => c.id === id))
        .filter(c => c !== undefined) as Character[];

      if (!enemyDefinitions || enemyDefinitions.length === 0) {
        internalLog('error', `전투 시작 오류: ID가 ${scene.id}인 장면의 적 정보를 찾을 수 없습니다.`);
        return {...prev, isCombatActive: false, combatMessage: "적 정보 없음", gameLog: newLog}; 
      }
      
      const isBossFight = scene.type === SceneType.COMBAT_BOSS;

      const enemies: CombatEnemyInstance[] = enemyDefinitions.map((def, index) => {
        const baseHp = def.hp ?? (isBossFight ? ENEMY_DEFAULT_HP * BOSS_DEFAULT_HP_MULTIPLIER : ENEMY_DEFAULT_HP);
        const baseAttack = def.attack ?? (isBossFight ? ENEMY_DEFAULT_ATTACK * BOSS_DEFAULT_ATTACK_MULTIPLIER : ENEMY_DEFAULT_ATTACK);
        const baseDefense = def.defense ?? (isBossFight ? ENEMY_DEFAULT_DEFENSE * BOSS_DEFAULT_DEFENSE_MULTIPLIER : ENEMY_DEFAULT_DEFENSE);
        
        // Initial enemy object for calculateDerivedStats
        const initialEnemy: CombatEnemyInstance = {
          ...def,
          combatId: `${def.id}_${index}_${crypto.randomUUID()}`, 
          maxHp: baseHp,
          hp: baseHp, // currentHp will be set by calculateDerivedStats based on this hp
          currentHp: baseHp, // Also set explicitly
          baseAttack: baseAttack,
          baseDefense: baseDefense,
          attack: baseAttack, 
          defense: baseDefense,
          activeStatusEffects: [],
          skills: def.skills || [],
        };
        return calculateDerivedStats(prev.player!, initialEnemy) as CombatEnemyInstance;
      });
      
      internalLog('combat', `${scene.content} 전투 시작!`);
      enemies.forEach(e => internalLog('combat_action', `${e.name}이(가) 나타났다!`));

      let updatedPlayer = { ...prev.player };
      const { updatedTarget: playerAfterEffects, logEntries: playerStatusLogs } = processTurnStartStatusEffects(updatedPlayer, true);
      newLog.push(...playerStatusLogs);
      newLog = newLog.slice(-100);
      updatedPlayer = playerAfterEffects as PlayerState;

      return {
        ...prev,
        player: updatedPlayer,
        isCombatActive: true,
        currentEnemies: enemies, 
        currentScene: scene, 
        combatTurn: 'player',
        playerTargetId: null,
        activeSkill: null,
        combatMessage: `${updatedPlayer.name}의 턴!`,
        awaitingPostDelegatedNormalCombatChoice: false,
        pendingSafeSceneTransition: null, 
        gameLog: newLog,
      };
    });
  }, [processTurnStartStatusEffects]);

  const advanceToScene = useCallback((sceneId: string | null) => {
    setGameState(prev => {
      if (!prev.script || !prev.currentStage || !prev.player || prev.isGameOver || prev.isCombatActive) {
         if (prev.isCombatActive && !prev.pendingSafeSceneTransition) { 
            console.warn("Attempted to advance scene while combat is active and not retreating.");
            return prev;
         }
      }
      let newLog = [...prev.gameLog];
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };

      if (sceneId === null) {
        internalLog('event', "현재 챕터의 마지막에 도달했습니다.");
        const currentStageIndex = prev.script.stages.findIndex(s => s.id === prev.currentStage.id);
        const isLastStage = currentStageIndex === prev.script.stages.length - 1;
        if (isLastStage) {
            internalLog('system', `축하합니다! ${prev.script.worldSettings.title} 모험을 완료했습니다! 게임을 초기화하거나 새 스크립트를 로드하세요.`);
            return {
                ...prev,
                isGameOver: true, 
                isLoading: false,
                currentScene: null,
                combatMessage: "게임 완료!",
                awaitingPostDelegatedNormalCombatChoice: false,
                pendingSafeSceneTransition: null,
                gameLog: newLog,
            }
        } else {
            internalLog('system', "다음 스테이지로 진행하는 기능은 아직 구현되지 않았습니다. 현재 스테이지가 종료됩니다.");
             return { 
                ...prev, 
                isLoading: false, 
                currentScene: null,
                awaitingPostDelegatedNormalCombatChoice: false,
                pendingSafeSceneTransition: null,
                gameLog: newLog,
            }; 
        }
      }

      const nextScene = prev.currentStage.scenes.find(s => s.id === sceneId);
      if (!nextScene) {
        return { 
            ...prev, 
            error: `ID가 ${sceneId}인 장면을 찾을 수 없습니다.`,
            awaitingPostDelegatedNormalCombatChoice: false,
            pendingSafeSceneTransition: null,
            gameLog: newLog, 
        };
      }
      
      let updatedPlayer = { ...prev.player };
      let sceneSpecificLog = nextScene.content;
      let newLastVisitedTownId = prev.lastVisitedTownSceneId;

      if (!updatedPlayer.visitedSceneIds.includes(nextScene.id)) {
        updatedPlayer.visitedSceneIds = [...updatedPlayer.visitedSceneIds, nextScene.id];
      }

      if (nextScene.newLocationName) {
        updatedPlayer.currentLocation = nextScene.newLocationName;
        internalLog('location', `${nextScene.newLocationName}에 도착했습니다.`);
      }

      if (nextScene.type === SceneType.TOWN) {
        newLastVisitedTownId = nextScene.id;
        // Clear temporary non-buff status effects when entering a town
        updatedPlayer.activeStatusEffects = updatedPlayer.activeStatusEffects.filter(effect => effect.isBuff);
      }

      if (nextScene.type === SceneType.ITEM_GET && nextScene.item) {
        const itemDefinition = getItemDefinition(nextScene.item);
        if (itemDefinition) {
          updatedPlayer = addItemToInventory(updatedPlayer, itemDefinition, 1);
          sceneSpecificLog = `${nextScene.content} ${itemDefinition.name}을(를) 획득했습니다!`;
          internalLog('reward', `${itemDefinition.name}을(를) 획득했습니다!`);
        } else {
          internalLog('error', `아이템 "${nextScene.item}"의 정의를 찾을 수 없습니다.`);
          updatedPlayer = addItemToInventory(updatedPlayer, { id: crypto.randomUUID(), name: nextScene.item, type: 'keyItem', quantity: 1, description: '알 수 없는 아이템.' },1);
          sceneSpecificLog = `${nextScene.content} ${nextScene.item}을(를) 획득했습니다! (정의되지 않은 아이템)`;
          internalLog('reward', `${nextScene.item}을(를) 획득했습니다! (정의되지 않은 아이템)`);
        }
      }
      
      const finalPlayerState = calculateDerivedStats(updatedPlayer) as PlayerState;
      
      if (nextScene.type !== SceneType.COMBAT_NORMAL && nextScene.type !== SceneType.COMBAT_BOSS) {
        if (sceneSpecificLog) {
           if (nextScene.type === SceneType.DIALOGUE) {
           } else if (nextScene.type === SceneType.TOWN) {
               internalLog('narration', sceneSpecificLog);
           } else if (nextScene.type !== SceneType.CHOICE) { 
               internalLog('narration', sceneSpecificLog);
           }
        }
      }

      const newState = {
        ...prev,
        currentScene: nextScene,
        player: finalPlayerState,
        isLoading: false,
        awaitingPostDelegatedNormalCombatChoice: false,
        lastVisitedTownSceneId: newLastVisitedTownId,
        pendingSafeSceneTransition: null, 
        isCombatActive: (nextScene.type === SceneType.COMBAT_NORMAL || nextScene.type === SceneType.COMBAT_BOSS) ? prev.isCombatActive : false, 
        combatMessage: (nextScene.type === SceneType.COMBAT_NORMAL || nextScene.type === SceneType.COMBAT_BOSS) ? prev.combatMessage : null,
        gameLog: newLog,
      };
      return newState;
    });
  }, []); 
  
  useEffect(() => {
    if (gameState.currentScene && 
        (gameState.currentScene.type === SceneType.COMBAT_NORMAL || gameState.currentScene.type === SceneType.COMBAT_BOSS) &&
        !gameState.isCombatActive && !gameState.isLoading && !gameState.isGameOver && !gameState.pendingSafeSceneTransition) { 
      
      if (gameState.awaitingPostDelegatedNormalCombatChoice && gameState.currentScene.type === SceneType.COMBAT_NORMAL) {
          return; 
      }
      startCombat(gameState.currentScene);
    }
  }, [gameState.currentScene, gameState.isCombatActive, gameState.isLoading, gameState.isGameOver, startCombat, gameState.awaitingPostDelegatedNormalCombatChoice, gameState.pendingSafeSceneTransition]);

  const checkCombatEndCondition = useCallback(() => {
    setGameState(prev => {
      if (!prev.isCombatActive || !prev.player || !prev.currentScene || prev.pendingSafeSceneTransition) return prev;
      
      let newLog = [...prev.gameLog];
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };

      let nextStateUpdate: Partial<GameLogicHookState> = {};

      if (prev.player.hp <= 0) {
        internalLog('combat_result', `${prev.player.name}이(가) 쓰러졌습니다...`);
        
        let safeSceneId: string | null = prev.lastVisitedTownSceneId;
        if (!safeSceneId && prev.script && prev.script.stages.length > 0) {
          const findSafeScene = (stages: Stage[]): string | null => {
            for (const stage of stages) {
              const townInStage = stage.scenes.find(s => s.type === SceneType.TOWN);
              if (townInStage) return townInStage.id;
              const nonCombatScene = stage.scenes.find(s => s.type !== SceneType.COMBAT_NORMAL && s.type !== SceneType.COMBAT_BOSS);
              if (nonCombatScene) return nonCombatScene.id;
            }
            return null;
          };
          safeSceneId = findSafeScene(prev.script.stages);
        }

        if (safeSceneId) {
          internalLog('system', `잠시 후 안전한 장소(${safeSceneId})로 이동합니다.`);
          const updatedPlayerHp = Math.max(1, Math.floor(prev.player.maxHp * 0.1)); 
          const goldPenalty = Math.floor(prev.player.gold * 0.2); 
          const updatedPlayerGold = Math.max(0, prev.player.gold - goldPenalty);
          internalLog('event', `${goldPenalty} 골드를 잃었습니다.`);
          
          const playerWithClearedEffects = { ...prev.player, hp: updatedPlayerHp, gold: updatedPlayerGold, activeStatusEffects: [] };
          const finalPlayerState = calculateDerivedStats(playerWithClearedEffects) as PlayerState;
          
          return { 
              ...prev, 
              player: finalPlayerState,
              pendingSafeSceneTransition: safeSceneId, 
              isGameOver: false, 
              combatTurn: null, 
              combatMessage: "전투 패배... 안전한 곳으로 이동합니다.",
              awaitingPostDelegatedNormalCombatChoice: false,
              gameLog: newLog,
          };
        } else {
          internalLog('error', "안전한 장소를 찾을 수 없습니다. 게임 오버.");
           return { 
            ...prev, 
            isCombatActive: false, 
            isGameOver: true, 
            combatTurn: null, 
            combatMessage: "게임 오버...",
            awaitingPostDelegatedNormalCombatChoice: false,
            pendingSafeSceneTransition: null,
            gameLog: newLog,
          };
        }
      }

      const allEnemiesDefeated = prev.currentEnemies.every(enemy => enemy.currentHp <= 0);
      if (allEnemiesDefeated) {
        const rewards = prev.currentScene.type === SceneType.COMBAT_BOSS ? COMBAT_REWARDS.boss : COMBAT_REWARDS.normal;
        
        let playerWithRewards = { ...prev.player, gold: prev.player.gold + rewards.gold, exp: prev.player.exp + rewards.exp };
        internalLog('reward', `${rewards.gold} 골드와 ${rewards.exp} 경험치를 얻었다.`);
        
        const { updatedPlayer: playerAfterLevelUp, newLogEntries: levelUpLogs } = handleLevelUp(playerWithRewards, newLog);
        newLog.push(...levelUpLogs);
        newLog = newLog.slice(-100);
        
        // Clear temporary combat status effects for player after victory
        const playerAfterCombat = {
          ...playerAfterLevelUp,
          activeStatusEffects: playerAfterLevelUp.activeStatusEffects.filter(effect => effect.isBuff) // Keep buffs, remove others
        };
        const finalPlayerStateAfterCombat = calculateDerivedStats(playerAfterCombat) as PlayerState;
        
        if (prev.currentScene.type === SceneType.COMBAT_BOSS) {
          internalLog('combat_result', `보스 전투 승리!`);
          let bossVictoryMessage = "보스 전투 승리!";
          if (prev.isDelegationModeActive) {
            bossVictoryMessage += " [전투 위임]";
          }
          
          const nextSceneId = prev.currentScene.nextSceneId ?? null;
          if (nextSceneId) {
            bossVictoryMessage += " 잠시 후 다음 장면으로 진행합니다...";
            setTimeout(() => advanceToScene(nextSceneId), 1500); 
          } else {
            bossVictoryMessage += " 다음 장면이 없습니다.";
             const currentStageIndex = prev.script!.stages.findIndex(s => s.id === prev.currentStage!.id);
             const isLastStage = currentStageIndex === prev.script!.stages.length - 1;
             if (isLastStage) {
                 internalLog('system', `축하합니다! ${prev.script!.worldSettings.title} 모험을 완료했습니다! 게임을 초기화하거나 새 스크립트를 로드하세요.`);
                 return {
                     ...prev,
                     player: finalPlayerStateAfterCombat,
                     isCombatActive: false,
                     combatTurn: null,
                     isGameOver: true, 
                     combatMessage: "게임 완료!",
                     awaitingPostDelegatedNormalCombatChoice: false,
                     pendingSafeSceneTransition: null,
                     gameLog: newLog,
                 }
             }
          }
          internalLog('system', bossVictoryMessage); 

          return { 
            ...prev, 
            player: finalPlayerStateAfterCombat, 
            isCombatActive: false, 
            combatTurn: null, 
            combatMessage: bossVictoryMessage,
            awaitingPostDelegatedNormalCombatChoice: false,
            pendingSafeSceneTransition: null,
            gameLog: newLog,
          };

        } else { 
          internalLog('combat_result', `전투 승리!`);
          if (prev.isDelegationModeActive) {
            internalLog('system', "전투 승리! [전투 위임] 행동을 선택하세요.");
            nextStateUpdate.awaitingPostDelegatedNormalCombatChoice = true;
          } else {
            nextStateUpdate.awaitingPostDelegatedNormalCombatChoice = false;
          }
          
          return { 
            ...prev, 
            ...nextStateUpdate,
            player: finalPlayerStateAfterCombat, 
            isCombatActive: false, 
            combatTurn: null, 
            combatMessage: "전투 승리! 다시 싸우거나 계속 진행할 수 있습니다.",
            pendingSafeSceneTransition: null,
            gameLog: newLog,
          };
        }
      }
      return { ...prev, gameLog: newLog }; 
    });
  }, [advanceToScene, handleLevelUp]);

  useEffect(() => {
    if (gameState.pendingSafeSceneTransition) {
      const targetSceneId = gameState.pendingSafeSceneTransition;
      const timer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          isCombatActive: false, 
          currentEnemies: [],    
          playerTargetId: null,
          activeSkill: null,
          pendingSafeSceneTransition: null, 
          combatMessage: "안전한 곳으로 이동했습니다.", 
        }));
        advanceToScene(targetSceneId);
      }, 1500); 

      return () => clearTimeout(timer);
    }
  }, [gameState.pendingSafeSceneTransition, advanceToScene]);

  const processEnemyTurns = useCallback(() => {
    setGameState(prev => {
      let newGameLog = [...prev.gameLog];
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newGameLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now() });
        newGameLog = newGameLog.slice(-100);
      };

      if (!prev.isCombatActive || prev.combatTurn !== 'enemy_acting' || !prev.player || prev.pendingSafeSceneTransition) {
        return { ...prev, gameLog: newGameLog, combatMessage: prev.combatMessage || (prev.isCombatActive ? "적 턴 오류" : "전투가 종료되었습니다.") };
      }
      
      let updatedPlayer = { ...prev.player };
      let updatedEnemies = [...prev.currentEnemies];
      const enemyActionMessages: string[] = [];

      updatedEnemies = updatedEnemies.map(enemy => {
        if (enemy.currentHp <= 0) return enemy;

        const { updatedTarget: enemyAfterEffects, preventedAction, logEntries: enemyStatusLogs } = processTurnStartStatusEffects(enemy, false);
        newGameLog.push(...enemyStatusLogs);
        let currentEnemy = enemyAfterEffects as CombatEnemyInstance;

        if (preventedAction) {
          const stunEffect = currentEnemy.activeStatusEffects.find(e => e.preventsAction);
          const preventMsg = `${currentEnemy.name}은(는) ${stunEffect?.name || '알 수 없는 효과'}로 인해 행동할 수 없다!`;
          enemyActionMessages.push(preventMsg);
          internalLog('combat_action', preventMsg);
          return currentEnemy;
        }
        
        if (updatedPlayer.hp > 0) { // Enemy acts only if player is alive
          const damage = Math.max(1, currentEnemy.attack - updatedPlayer.defense);
          updatedPlayer.hp = Math.max(0, updatedPlayer.hp - damage);
          const logMsg = `${currentEnemy.name}이(가) ${updatedPlayer.name}에게 ${damage}의 피해를 입혔다! (남은 HP: ${updatedPlayer.hp})`;
          enemyActionMessages.push(logMsg);
          internalLog('combat_action', logMsg); 
        }
        return currentEnemy;
      });
      
      if (enemyActionMessages.length === 0 && updatedEnemies.some(e => e.currentHp > 0) && updatedPlayer.hp > 0) { 
        const noActionMsg = "적들이 행동하지 못했다.";
        internalLog('combat_action', noActionMsg);
      }

      const finalPlayerState = calculateDerivedStats(updatedPlayer) as PlayerState;
      
      const { updatedTarget: playerAfterEnemyTurnEffects, logEntries: playerPostEnemyStatusLogs } = processTurnStartStatusEffects(finalPlayerState, true);
      newGameLog.push(...playerPostEnemyStatusLogs);
      
      const newCombatTurn = 'player';
      const newCombatMessage = (playerAfterEnemyTurnEffects as PlayerState).hp <= 0 ? "플레이어 쓰러짐..." : `${(playerAfterEnemyTurnEffects as PlayerState).name}의 턴!`;
      
      return { 
        ...prev, 
        player: playerAfterEnemyTurnEffects as PlayerState,
        currentEnemies: updatedEnemies,
        combatTurn: newCombatTurn, 
        combatMessage: newCombatMessage,
        gameLog: newGameLog.slice(-100)
      };
    });
    setTimeout(() => checkCombatEndCondition(), 100); // Slight delay to allow state update for logs
  }, [checkCombatEndCondition, processTurnStartStatusEffects]);

  useEffect(() => {
    if (gameState.isCombatActive && gameState.combatTurn === 'enemy' && !gameState.isGameOver && !gameState.pendingSafeSceneTransition) {
      setGameState(prev => ({ ...prev, combatTurn: 'enemy_acting', combatMessage: "적의 턴..." }));
    }
  }, [gameState.isCombatActive, gameState.combatTurn, gameState.isGameOver, gameState.pendingSafeSceneTransition]);

  useEffect(() => {
    let timerId: number | undefined;
    if (gameState.isCombatActive && gameState.combatTurn === 'enemy_acting' && !gameState.isGameOver && !gameState.pendingSafeSceneTransition) {
      const delay = gameState.isDelegationModeActive ? 500 : 1000;
      
      timerId = window.setTimeout(() => {
        processEnemyTurns();
      }, delay);
    }
    return () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [
      gameState.isCombatActive, 
      gameState.combatTurn, 
      gameState.isGameOver, 
      gameState.pendingSafeSceneTransition, 
      gameState.isDelegationModeActive, 
      processEnemyTurns
  ]);

  const handlePlayerAttack = useCallback((targetEnemyCombatId: string) => {
    setGameState(prev => {
      if (!prev.isCombatActive || prev.combatTurn !== 'player' || !prev.player || prev.pendingSafeSceneTransition) return prev;
      
      const { updatedTarget: playerAfterEffects, preventedAction, logEntries: playerStatusLogs } = processTurnStartStatusEffects(prev.player, true);
      let newLog = [...prev.gameLog, ...playerStatusLogs].slice(-100);
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };

      let currentPlayerState = playerAfterEffects as PlayerState;

      if (preventedAction) {
        const stunEffect = currentPlayerState.activeStatusEffects.find(e => e.preventsAction);
        internalLog('combat_action', `${currentPlayerState.name}은(는) ${stunEffect?.name || '효과'}로 인해 행동할 수 없다!`);
        return { ...prev, player: currentPlayerState, combatTurn: 'enemy' as const, combatMessage: "적의 턴으로 넘어갑니다.", gameLog: newLog };
      }

      const targetEnemyIndex = prev.currentEnemies.findIndex(e => e.combatId === targetEnemyCombatId);
      if (targetEnemyIndex === -1) {
        internalLog('error', '잘못된 대상입니다.');
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }

      const targetEnemy = { ...prev.currentEnemies[targetEnemyIndex] }; // Create a mutable copy
      if (targetEnemy.currentHp <= 0) {
        internalLog('system', `${targetEnemy.name}은(는) 이미 쓰러져 있습니다.`);
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }
      
      const damage = Math.max(1, currentPlayerState.attack - targetEnemy.defense);
      // targetEnemy.hp = Math.max(0, targetEnemy.currentHp - damage); // Use hp for calculation, currentHp for display
      // targetEnemy.currentHp = targetEnemy.hp;
      const newEnemyHp = Math.max(0, targetEnemy.currentHp - damage);


      const updatedEnemies = [...prev.currentEnemies];
      updatedEnemies[targetEnemyIndex] = calculateDerivedStats(
        currentPlayerState, 
        {...targetEnemy, hp: newEnemyHp, currentHp: newEnemyHp }
      ) as CombatEnemyInstance;


      internalLog('combat_action', `${currentPlayerState.name}이(가) ${targetEnemy.name}에게 공격! ${damage}의 피해를 입혔다.`);
      if (updatedEnemies[targetEnemyIndex].currentHp <= 0) {
        internalLog('combat_result', `${targetEnemy.name}을(를) 쓰러뜨렸다!`);
      }
      
      return { 
        ...prev, 
        player: currentPlayerState,
        currentEnemies: updatedEnemies, 
        combatTurn: 'enemy' as const, 
        playerTargetId: null, 
        activeSkill: null,
        combatMessage: "적의 턴으로 넘어갑니다.",
        gameLog: newLog,
      };
    });
    setTimeout(() => checkCombatEndCondition(), 100);
  }, [checkCombatEndCondition, processTurnStartStatusEffects]);

  const handlePlayerSkill = useCallback((skillId: string, targetEnemyCombatId?: string) => {
    setGameState(prev => {
      if (!prev.isCombatActive || prev.combatTurn !== 'player' || !prev.player || prev.pendingSafeSceneTransition) return prev;

      const { updatedTarget: playerAfterEffects, preventedAction, logEntries: playerStatusLogs } = processTurnStartStatusEffects(prev.player, true);
      let newLog = [...prev.gameLog, ...playerStatusLogs].slice(-100);
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };

      let currentPlayerState = playerAfterEffects as PlayerState;
      if (preventedAction) {
        const stunEffect = currentPlayerState.activeStatusEffects.find(e => e.preventsAction);
        internalLog('combat_action', `${currentPlayerState.name}은(는) ${stunEffect?.name || '효과'}로 인해 행동할 수 없다!`);
        return { ...prev, player: currentPlayerState, combatTurn: 'enemy' as const, combatMessage: "적의 턴으로 넘어갑니다.", gameLog: newLog };
      }
      
      const skill = getSkillDefinition(skillId);
      if (!skill) {
        internalLog('error', '알 수 없는 스킬입니다.');
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }
      if (currentPlayerState.mp < skill.mpCost) {
        internalLog('system', 'MP가 부족합니다.');
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }

      currentPlayerState = { ...currentPlayerState, mp: currentPlayerState.mp - skill.mpCost };
      let updatedEnemies = [...prev.currentEnemies];
      let logMsg = `${currentPlayerState.name}이(가) ${skill.name} 사용! (MP ${skill.mpCost} 소모)`;

      // Apply direct skill effects
      if (skill.effectType === 'damage_hp' && skill.effectValue) {
        if (skill.targetType === 'enemy_single') {
            if (!targetEnemyCombatId) { 
              internalLog('error', '스킬 대상을 선택해야 합니다.');
              return { ...prev, player: currentPlayerState, activeSkill: skill, playerTargetId: null, gameLog: newLog }; 
            }
            const targetIdx = updatedEnemies.findIndex(e => e.combatId === targetEnemyCombatId);
            if (targetIdx === -1 || updatedEnemies[targetIdx].currentHp <= 0) {
              internalLog('error', '잘못된 대상이거나 이미 쓰러진 적입니다.');
              return { ...prev, player: currentPlayerState, activeSkill: skill, playerTargetId: null, gameLog: newLog };
            }
            const enemyTarget = { ...updatedEnemies[targetIdx] }; // Mutable copy
            const damage = Math.max(1, skill.effectValue + currentPlayerState.attack - enemyTarget.defense); 
            // enemyTarget.hp = Math.max(0, enemyTarget.currentHp - damage);
            // enemyTarget.currentHp = enemyTarget.hp;
            const newEnemyHp = Math.max(0, enemyTarget.currentHp - damage);
            updatedEnemies[targetIdx] = calculateDerivedStats(currentPlayerState, {...enemyTarget, hp: newEnemyHp, currentHp: newEnemyHp}) as CombatEnemyInstance;
            logMsg += ` ${updatedEnemies[targetIdx].name}에게 ${damage}의 피해!`;
            if (updatedEnemies[targetIdx].currentHp <= 0) logMsg += ` ${updatedEnemies[targetIdx].name}을(를) 쓰러뜨렸다!`;
        }
      } else if (skill.effectType === 'heal_hp' && skill.effectValue) {
         if (skill.targetType === 'self') {
            const healAmount = skill.effectValue || 0;
            currentPlayerState.hp = Math.min(currentPlayerState.maxHp, currentPlayerState.hp + healAmount);
            logMsg += ` 자신의 HP를 ${healAmount} 회복했다. (현재 HP: ${currentPlayerState.hp})`;
          }
      } else if (skill.effectType === 'heal_mp' && skill.effectValue) {
         if (skill.targetType === 'self') {
            const healAmount = skill.effectValue || 0;
            currentPlayerState.mp = Math.min(currentPlayerState.maxMp, currentPlayerState.mp + healAmount);
            logMsg += ` 자신의 MP를 ${healAmount} 회복했다. (현재 MP: ${currentPlayerState.mp})`;
          }
      }
      
      // Apply status effects from skill
      if (skill.appliesStatusEffect) {
        const { effectId, duration, potency, chance } = skill.appliesStatusEffect;
        const applyChance = chance ?? 1;
        if (Math.random() < applyChance) {
            if (skill.targetType === 'enemy_single' && targetEnemyCombatId) {
                const targetIdx = updatedEnemies.findIndex(e => e.combatId === targetEnemyCombatId);
                if (targetIdx > -1 && updatedEnemies[targetIdx].currentHp > 0) {
                    updatedEnemies[targetIdx] = applyStatusEffect(updatedEnemies[targetIdx], effectId, duration, potency, currentPlayerState.name);
                    logMsg += ` (${updatedEnemies[targetIdx].name}에게 ${ALL_STATUS_EFFECT_DEFINITIONS[effectId].name} 효과 적용)`;
                }
            } else if (skill.targetType === 'self') {
                currentPlayerState = applyStatusEffect(currentPlayerState, effectId, duration, potency, currentPlayerState.name);
                 logMsg += ` (자신에게 ${ALL_STATUS_EFFECT_DEFINITIONS[effectId].name} 효과 적용)`;
            }
        } else {
           logMsg += ` (하지만 ${ALL_STATUS_EFFECT_DEFINITIONS[effectId].name} 효과는 적용되지 않았다!)`;
        }
      }
      
      internalLog('combat_action', logMsg);
      
      const finalPlayerState = calculateDerivedStats(currentPlayerState) as PlayerState;
      return { 
        ...prev, 
        player: finalPlayerState, 
        currentEnemies: updatedEnemies, 
        combatTurn: 'enemy' as const, 
        playerTargetId: null, 
        activeSkill: null,
        combatMessage: "적의 턴으로 넘어갑니다.",
        gameLog: newLog,
      };
    });
     setTimeout(() => checkCombatEndCondition(), 100);
  }, [checkCombatEndCondition, applyStatusEffect, processTurnStartStatusEffects]);


  const handlePlayerUseItemInCombat = useCallback((itemId: string, targetEnemyCombatId?: string) => {
    setGameState(prev => {
      if (!prev.isCombatActive || prev.combatTurn !== 'player' || !prev.player || prev.pendingSafeSceneTransition) return prev;
      
      const { updatedTarget: playerAfterEffects, preventedAction, logEntries: playerStatusLogs } = processTurnStartStatusEffects(prev.player, true);
      let newLog = [...prev.gameLog, ...playerStatusLogs].slice(-100);
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };
      
      let currentPlayerState = playerAfterEffects as PlayerState;
       if (preventedAction) {
        const stunEffect = currentPlayerState.activeStatusEffects.find(e => e.preventsAction);
        internalLog('combat_action', `${currentPlayerState.name}은(는) ${stunEffect?.name || '효과'}로 인해 행동할 수 없다!`);
        return { ...prev, player: currentPlayerState, combatTurn: 'enemy' as const, combatMessage: "적의 턴으로 넘어갑니다.", gameLog: newLog };
      }

      const itemIndex = currentPlayerState.inventory.findIndex(i => i.id === itemId);
      if (itemIndex === -1) {
        internalLog('error', "가방에 해당 아이템이 없습니다.");
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }
      const itemToUse = { ...currentPlayerState.inventory[itemIndex] };
      if (itemToUse.type !== 'consumable' || !itemToUse.effects) {
        internalLog('system', `${itemToUse.name}은(는) 전투 중에 사용할 수 없습니다.`);
        return {...prev, player: currentPlayerState, gameLog: newLog};
      }

      let logMsg = `${currentPlayerState.name}이(가) ${itemToUse.name}을(를) 사용!`;
      let effectAppliedThisTurn = false;

      if (itemToUse.effects.hp && itemToUse.effects.hp > 0) { 
         const healAmount = itemToUse.effects.hp;
         currentPlayerState.hp = Math.min(currentPlayerState.maxHp, currentPlayerState.hp + healAmount);
         logMsg += ` HP를 ${healAmount} 회복했다. (현재 HP: ${currentPlayerState.hp})`;
         effectAppliedThisTurn = true;
      } 
      if (itemToUse.effects.mp && itemToUse.effects.mp > 0) {
        const mpAmount = itemToUse.effects.mp;
        currentPlayerState.mp = Math.min(currentPlayerState.maxMp, currentPlayerState.mp + mpAmount);
        logMsg += ` MP를 ${mpAmount} 회복했다. (현재 MP: ${currentPlayerState.mp})`;
        effectAppliedThisTurn = true;
      }
      if (itemToUse.effects.curesEffect) {
        itemToUse.effects.curesEffect.forEach(effectIdToCure => {
            currentPlayerState = removeStatusEffect(currentPlayerState, effectIdToCure);
        });
        logMsg += ` 상태 이상을 일부 치료했다.`;
        effectAppliedThisTurn = true;
      }
      // TODO: Add item applying status effects to enemies if needed

      if (!effectAppliedThisTurn) {
         internalLog('system', `${itemToUse.name}을(를) 사용했지만 전투에 큰 영향은 없었다.`);
         return {...prev, player: currentPlayerState, gameLog: newLog};
      }

      let newInventory = [...currentPlayerState.inventory];
      if (itemToUse.quantity > 1) {
        newInventory[itemIndex] = { ...itemToUse, quantity: itemToUse.quantity - 1 };
      } else {
        newInventory.splice(itemIndex, 1);
      }
      currentPlayerState.inventory = newInventory;
      internalLog('combat_action', logMsg);
      
      const finalPlayerState = calculateDerivedStats(currentPlayerState) as PlayerState;
      return { 
        ...prev, 
        player: finalPlayerState, 
        combatTurn: 'enemy' as const, 
        playerTargetId: null, 
        activeSkill: null,
        combatMessage: "적의 턴으로 넘어갑니다.",
        gameLog: newLog,
      };
    });
    setTimeout(() => checkCombatEndCondition(), 100);
  }, [checkCombatEndCondition, removeStatusEffect, processTurnStartStatusEffects]);

  const handleFleeAttempt = useCallback(() => {
    setGameState(prev => {
      if (!prev.isCombatActive || prev.combatTurn !== 'player' || !prev.player || !prev.currentScene || prev.pendingSafeSceneTransition) return prev;
      let newLog = [...prev.gameLog];
      const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        newLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now()});
        newLog = newLog.slice(-100);
      };
      
      if (prev.currentScene.type === SceneType.COMBAT_BOSS) {
        internalLog('combat_action', '강력한 적에게서는 도망칠 수 없다!');
        return { ...prev, combatMessage: "도망칠 수 없다!", gameLog: newLog };
      }

      const fleeSuccess = Math.random() < 0.5; 

      if (fleeSuccess) {
        internalLog('combat_result', '도망에 성공했다!');
        const playerAfterFlee = {
          ...prev.player,
          activeStatusEffects: prev.player.activeStatusEffects.filter(eff => eff.isBuff) // Keep buffs
        };
        
        return { 
            ...prev, 
            player: calculateDerivedStats(playerAfterFlee) as PlayerState,
            isCombatActive: false, 
            combatTurn: null, 
            combatMessage: "도망 성공!",
            awaitingPostDelegatedNormalCombatChoice: false, 
            currentEnemies: [],
            gameLog: newLog,
        }; 
      } else {
        internalLog('combat_action', '도망에 실패했다...');
        return { ...prev, combatTurn: 'enemy' as const, playerTargetId: null, activeSkill: null, combatMessage: "도망 실패! 적의 턴!", gameLog: newLog };
      }
    });
  }, []);

  const restartCurrentCombat = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentScene || prev.isCombatActive || 
          (prev.currentScene.type !== SceneType.COMBAT_NORMAL && prev.currentScene.type !== SceneType.COMBAT_BOSS)) {
        addLogEntry('error', '현재 장면에서 전투를 다시 시작할 수 없습니다.');
        return prev;
      }
      addLogEntry('system', `${prev.currentScene.title}의 적들과 다시 전투를 시작합니다.`);
      return { 
        ...prev, 
        isLoading: true, 
        awaitingPostDelegatedNormalCombatChoice: false,
        pendingSafeSceneTransition: null, 
      }; 
    });
    
    setTimeout(() => { 
      setGameState(currentPrev => {
        const sceneToRestart = currentPrev.currentScene; 
        if (sceneToRestart && (sceneToRestart.type === SceneType.COMBAT_NORMAL || sceneToRestart.type === SceneType.COMBAT_BOSS)) {
          return {...currentPrev, isLoading: false, isCombatActive: false}; 
        }
        return {...currentPrev, isLoading: false};
      });
    }, 0);

  }, [addLogEntry]);

  const loadScript = useCallback((jsonString: string) => {
    let tempLog: GameLogEntry[] = [];
    const internalLog = (type: GameLogEntry['type'], message: string, speaker?: string) => {
        tempLog.push({ id: crypto.randomUUID(), type, message, speaker, timestamp: Date.now() });
        tempLog = tempLog.slice(-100);
    };

    setGameState(prev => {
        tempLog = [...prev.gameLog]; 
        return { 
            ...initialLogicState, 
            gameLog: tempLog, 
            isLoading: true, 
            error: null, 
        };
    });

    try {
      const parsedScript = JSON.parse(jsonString) as GameScript;
      if (!parsedScript.stages || parsedScript.stages.length === 0) {
        throw new Error("잘못된 스크립트: 스테이지를 찾을 수 없습니다.");
      }
      if (!parsedScript.stages[0].scenes || parsedScript.stages[0].scenes.length === 0) {
        throw new Error("잘못된 스크립트: 첫 번째 스테이지에 장면이 없습니다.");
      }

      const firstStage = parsedScript.stages[0];
      const firstScene = firstStage.scenes[0];
      const player = initializePlayer(parsedScript, firstStage); 
      
      internalLog('event', `${player.name}님, 환영합니다! ${parsedScript.worldSettings.title}에서의 모험이 시작됩니다.`);
      
      const initialLocation = firstScene.newLocationName || player.currentLocation;
      player.currentLocation = initialLocation;
      
      let newLastVisitedTownId = null;
      if (firstScene.type === SceneType.TOWN) {
        newLastVisitedTownId = firstScene.id;
      }
      
      internalLog('system', `게임 스크립트 "${parsedScript.worldSettings.title}"을(를) 성공적으로 불러왔습니다.`);
      internalLog('location', `현재 위치: ${initialLocation}.`);
      
      if (firstScene.type !== SceneType.COMBAT_NORMAL && firstScene.type !== SceneType.COMBAT_BOSS && firstScene.content) {
         if (firstScene.type === SceneType.DIALOGUE) {
         } else if (firstScene.type !== SceneType.CHOICE){
            internalLog('narration', firstScene.content);
         }
      }
      
      saveToLocalStorage(LOCAL_STORAGE_SCRIPT_KEY, parsedScript);

      setGameState(prev => ({ 
        ...prev, 
        script: parsedScript,
        currentStage: firstStage,
        currentScene: firstScene,
        player,
        isLoading: false, 
        isGameOver: false,
        lastVisitedTownSceneId: newLastVisitedTownId,
        gameLog: tempLog, 
      }));
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "스크립트 분석에 실패했습니다.";
      console.error(errorMessage, e);
      internalLog('error', errorMessage); 
      setGameState(prev => ({ 
          ...initialLogicState, 
          isLoading: false, 
          error: errorMessage, 
          gameLog: tempLog, 
      }));
      removeFromLocalStorage(LOCAL_STORAGE_SCRIPT_KEY);
      removeFromLocalStorage(LOCAL_STORAGE_GAME_STATE_KEY); 
    }
  }, [initializePlayer]);

  useEffect(() => {
    if (!gameState.isCombatActive && gameState.currentScene?.type === SceneType.DIALOGUE && 
        gameState.currentStage && gameState.player && !gameState.isGameOver && !gameState.pendingSafeSceneTransition) {
      const scene = gameState.currentScene;
      const stage = gameState.currentStage;
      
      if (scene.characterIds.length > 0) {
        const npc = stage.characters.find(c => c.id === scene.characterIds[0]); 
        if (npc) {
          const dialogue = npc.dialogueSeed || `${npc.name}은(는) 할 말이 없습니다.`;
          const lastLog = gameState.gameLog.length > 0 ? gameState.gameLog[gameState.gameLog.length -1] : null;
          if (!lastLog || !(lastLog.type === 'dialogue' && lastLog.speaker === npc.name && lastLog.message === dialogue)) {
             addLogEntry('dialogue', dialogue, npc.name);
          }
        } else {
           addLogEntry('error', `ID ${scene.characterIds[0]}를 가진 NPC를 대화에서 찾을 수 없습니다.`, '시스템');
        }
      } else if (scene.content && scene.characterIds.length === 0) { 
         const lastLog = gameState.gameLog.length > 0 ? gameState.gameLog[gameState.gameLog.length -1] : null;
         if (!lastLog || !(lastLog.type === 'narration' && lastLog.message === scene.content)) {
            addLogEntry('narration', scene.content);
         }
      }
    }
  }, [gameState.currentScene, gameState.currentStage, gameState.player, addLogEntry, gameState.isGameOver, gameState.isCombatActive, gameState.gameLog, gameState.pendingSafeSceneTransition]);

  const makeChoice = useCallback((choice: SceneChoice) => {
    if (gameState.isGameOver || gameState.isCombatActive) return;
    addLogEntry('event', `선택: "${choice.text}"`);
    advanceToScene(choice.nextSceneId);
  }, [advanceToScene, addLogEntry, gameState.isGameOver, gameState.isCombatActive]);

  const resetGame = useCallback(() => {
    removeFromLocalStorage(LOCAL_STORAGE_SCRIPT_KEY);
    removeFromLocalStorage(LOCAL_STORAGE_GAME_STATE_KEY); 
    
    setGameState(prev => { 
        const currentLog = prev.gameLog; 
        const resetMessageEntry: GameLogEntry = { 
            id: crypto.randomUUID(), 
            type: 'system', 
            message: '게임이 초기화되었습니다. 새 스크립트를 불러오거나 저장된 게임을 로드하세요.', 
            timestamp: Date.now() 
        };
        return {
            ...initialLogicState,
            gameLog: [...currentLog, resetMessageEntry].slice(-100)
        };
    });
  }, []);
  
  const clearActiveGameSessionInMemory = useCallback(() => {
    setGameState(prev => { 
      const newLogEntry: GameLogEntry = {
        id: crypto.randomUUID(),
        type: 'system',
        message: '활성 게임 세션이 메모리에서 초기화되었습니다. 메인 메뉴로 이동합니다.',
        timestamp: Date.now()
      };
      return {
        ...initialLogicState, 
        gameLog: [...prev.gameLog, newLogEntry].slice(-100),
      };
    });
  }, []);

  const useItem = useCallback((itemId: string) => { 
    if (gameState.isCombatActive) {
      addLogEntry('system', "전투 중에는 이 방법으로 아이템을 사용할 수 없습니다. 전투 메뉴를 이용하세요.");
      return;
    }
    setGameState(prev => {
      if (!prev.player || prev.isGameOver) return prev;
      let player = { ...prev.player };
      const itemIndex = player.inventory.findIndex(i => i.id === itemId);

      if (itemIndex === -1) {
        addLogEntry('error', "가방에 해당 아이템이 없습니다."); 
        return prev;
      }

      const itemToUse = player.inventory[itemIndex];
      let logMessage = `${itemToUse.name}을(를) 사용했습니다.`;
      let effectApplied = false;
      if (itemToUse.type === 'consumable' && itemToUse.effects) {
          if (itemToUse.effects.hp) {
            const oldHp = player.hp;
            player.hp = Math.min(player.maxHp, player.hp + itemToUse.effects.hp);
            logMessage += ` HP ${player.hp - oldHp} 회복.`;
            effectApplied = true;
          }
          if (itemToUse.effects.mp) {
            const oldMp = player.mp;
            player.mp = Math.min(player.maxMp, player.mp + itemToUse.effects.mp);
            logMessage += ` MP ${player.mp - oldMp} 회복.`;
            effectApplied = true;
          }
          if (itemToUse.effects.curesEffect) {
            itemToUse.effects.curesEffect.forEach(effectIdToCure => {
                player = removeStatusEffect(player, effectIdToCure);
            });
             logMessage += ` 상태 이상을 치료했습니다.`;
             effectApplied = true;
          }
      }

      if (!effectApplied) {
        addLogEntry('system', `${itemToUse.name}을(를) 사용했지만 아무 효과가 없었습니다.`);
        return prev;
      }
      
      addLogEntry('event', logMessage);

      let newInventory = [...player.inventory];
      if (itemToUse.quantity > 1) {
        newInventory[itemIndex] = { ...itemToUse, quantity: itemToUse.quantity - 1 };
      } else {
        newInventory.splice(itemIndex, 1);
      }
      player.inventory = newInventory;
      return { ...prev, player: calculateDerivedStats(player) as PlayerState };
    });
  }, [addLogEntry, gameState.isCombatActive, removeStatusEffect]);

  const toggleEquipment = useCallback((itemToToggle: GameItem) => {
    if (gameState.isCombatActive) {
        addLogEntry('system', "전투 중에는 장비를 변경할 수 없습니다.");
        return;
    }
    setGameState(prev => {
      if (!prev.player || !itemToToggle.equipSlot || prev.isGameOver) return prev;
      let playerState = { ...prev.player };
      const slot = itemToToggle.equipSlot;
      const currentItemInSlot = playerState.equipment[slot];
      let newInventory = [...playerState.inventory];
      const itemIndexInInventory = newInventory.findIndex(i => i.id === itemToToggle.id);

      if (currentItemInSlot && currentItemInSlot.id === itemToToggle.id) { // Unequip
        playerState.equipment[slot] = null;
        if (itemIndexInInventory > -1) { // Should exist
          newInventory[itemIndexInInventory] = { ...newInventory[itemIndexInInventory], quantity: newInventory[itemIndexInInventory].quantity + 1};
        } else { // Safety, add back if not found (though it should be)
          newInventory.push({...itemToToggle, quantity: 1});
        }
        addLogEntry('event', `${itemToToggle.name} 장착 해제.`);
      } else { // Equip
        if (itemIndexInInventory === -1 || newInventory[itemIndexInInventory].quantity === 0) {
          addLogEntry('error', "인벤토리에 해당 아이템이 없습니다.");
          return prev;
        }

        if (currentItemInSlot) { // If slot had an item, return it to inventory
          const currentItemInSlotIndexInv = newInventory.findIndex(i => i.id === currentItemInSlot.id);
          if (currentItemInSlotIndexInv > -1) {
            newInventory[currentItemInSlotIndexInv] = {...newInventory[currentItemInSlotIndexInv], quantity: newInventory[currentItemInSlotIndexInv].quantity + 1};
          } else {
            newInventory.push({...currentItemInSlot, quantity: 1});
          }
        }
        
        playerState.equipment[slot] = {...itemToToggle, quantity: 1}; // Equip one
        if (newInventory[itemIndexInInventory].quantity > 1) {
           newInventory[itemIndexInInventory] = {...newInventory[itemIndexInInventory], quantity: newInventory[itemIndexInInventory].quantity - 1};
        } else {
           newInventory.splice(itemIndexInInventory, 1);
        }
        addLogEntry('event', `${itemToToggle.name} 장착.`);
      }
      playerState.inventory = newInventory;
      return { ...prev, player: calculateDerivedStats(playerState) as PlayerState };
    });
  }, [addLogEntry, gameState.isCombatActive]);

  const restPlayer = useCallback(() => {
    if (gameState.isCombatActive) {
        addLogEntry('system', "전투 중에는 휴식할 수 없습니다.");
        return;
    }
    setGameState(prev => {
      if (!prev.player || prev.isGameOver) return prev;
      
      const restedPlayerEffects = prev.player.activeStatusEffects.filter(effect => effect.isBuff); // Keep buffs, remove ailments/debuffs
      const restedPlayer = {
        ...prev.player,
        hp: prev.player.maxHp,
        mp: prev.player.maxMp,
        activeStatusEffects: restedPlayerEffects,
      };
      addLogEntry('event', `${prev.player.name}님은 편안한 휴식을 취해 HP와 MP를 모두 회복했습니다. 일부 상태 이상이 해제되었습니다.`);
      return { ...prev, player: calculateDerivedStats(restedPlayer) as PlayerState };
    });
  }, [addLogEntry, gameState.isCombatActive]);

  const openShop = useCallback((sceneId: string) => {
    if (gameState.isGameOver || !gameState.player || gameState.isCombatActive) return;
    const shopId = gameState.currentScene?.id || 'default'; // Fallback or use scene.shopId if available
    const inventoryItems = SHOP_INVENTORIES[shopId] || DEFAULT_SHOP_ITEM_IDS;
    const itemsForSale = inventoryItems.map(id => getItemDefinition(id)).filter(item => item !== undefined) as GameItem[];
    
    addLogEntry('system', `상점을 엽니다.`); 
    setGameState(prev => ({ 
      ...prev, 
      isShopOpen: true, 
      currentShopId: shopId,
      currentShopItems: itemsForSale,
      shopError: null,
    }));
  }, [addLogEntry, gameState.isGameOver, gameState.player, gameState.isCombatActive, gameState.currentScene]);

  const closeShop = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isShopOpen: false,
      currentShopId: null,
      currentShopItems: [],
      shopError: null,
    }));
  }, []);

  const buyItem = useCallback((itemId: string, quantity: number) => {
    setGameState(prev => {
      if (!prev.player || prev.isGameOver || quantity <= 0 || !prev.isShopOpen) return { ...prev, shopError: "구매 중 오류 발생." };
      const itemDef = getItemDefinition(itemId);
      if (!itemDef) return { ...prev, shopError: "알 수 없는 아이템입니다." };
      
      const buyPrice = itemDef.sellPrice ? itemDef.sellPrice * DEFAULT_BUY_PRICE_MULTIPLIER : undefined;
      if (buyPrice === undefined) return { ...prev, shopError: `${itemDef.name}은(는) 구매할 수 없는 아이템입니다.` };
      
      const totalCost = buyPrice * quantity;
      if (prev.player.gold < totalCost) {
        return { ...prev, shopError: "골드가 부족합니다." };
      }

      let updatedPlayer = { ...prev.player, gold: prev.player.gold - totalCost };
      updatedPlayer = addItemToInventory(updatedPlayer, itemDef, quantity);
      addLogEntry('reward', `${itemDef.name} ${quantity}개를 ${totalCost}G에 구매했습니다.`);
      return { ...prev, player: calculateDerivedStats(updatedPlayer) as PlayerState, shopError: null };
    });
  }, [addLogEntry]);

  const sellItem = useCallback((itemId: string, quantity: number) => {
    setGameState(prev => {
      if (!prev.player || prev.isGameOver || quantity <= 0 || !prev.isShopOpen) return { ...prev, shopError: "판매 중 오류 발생." };
      
      const itemIndexInInventory = prev.player.inventory.findIndex(i => i.id === itemId);
      if (itemIndexInInventory === -1) return { ...prev, shopError: "판매할 아이템이 없습니다." };
      
      const itemToSell = prev.player.inventory[itemIndexInInventory];
      if (itemToSell.quantity < quantity) return { ...prev, shopError: "판매할 수량이 부족합니다." };
      if (itemToSell.sellPrice === undefined || itemToSell.sellPrice <= 0) {
        return { ...prev, shopError: `${itemToSell.name}은(는) 판매할 수 없는 아이템입니다.`};
      }

      const totalGain = itemToSell.sellPrice * quantity;
      let updatedPlayer = { ...prev.player, gold: prev.player.gold + totalGain };
      let newInventory = [...updatedPlayer.inventory];
      if (itemToSell.quantity === quantity) {
        newInventory.splice(itemIndexInInventory, 1);
      } else {
        newInventory[itemIndexInInventory] = { ...itemToSell, quantity: itemToSell.quantity - quantity };
      }
      updatedPlayer.inventory = newInventory;

      addLogEntry('reward', `${itemToSell.name} ${quantity}개를 ${totalGain}G에 판매했습니다.`);
      return { ...prev, player: calculateDerivedStats(updatedPlayer) as PlayerState, shopError: null };
    });
  }, [addLogEntry]);

  const saveFullGameState = useCallback(() => {
    if (gameState.player && gameState.script) {
      try {
        const stateToSave = { ...gameState };
        saveToLocalStorage(LOCAL_STORAGE_GAME_STATE_KEY, stateToSave);
        addLogEntry('system', '게임 상태가 성공적으로 저장되었습니다.');
      } catch (e) {
        console.error("게임 상태 저장 실패:", e);
        addLogEntry('error', '게임 상태 저장에 실패했습니다.');
      }
    } else {
      addLogEntry('error', '저장할 게임 데이터가 없습니다.');
    }
  }, [gameState, addLogEntry]);

  const loadFullGameState = useCallback((): boolean => {
    const loadedState = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
    if (loadedState && loadedState.script && loadedState.player) {
      const playerWithRecalculatedStats = calculateDerivedStats({
        ...loadedState.player,
        visitedSceneIds: loadedState.player.visitedSceneIds || [], 
        activeStatusEffects: loadedState.player.activeStatusEffects || [],
      }) as PlayerState;
      
      let enemiesWithRecalculatedStats = loadedState.currentEnemies || [];
      if (loadedState.isCombatActive) {
         enemiesWithRecalculatedStats = enemiesWithRecalculatedStats.map(enemy => 
            // The object passed as baseEnemy needs to be a valid CombatEnemyInstance
            calculateDerivedStats(playerWithRecalculatedStats, {
              ...enemy, 
              activeStatusEffects: enemy.activeStatusEffects || [],
              // Ensure all required fields for CombatEnemyInstance are present if `enemy` might be partial
            }) as CombatEnemyInstance
         );
      }

      setGameState({
        ...initialLogicState, 
        ...loadedState, 
        player: playerWithRecalculatedStats, 
        currentEnemies: enemiesWithRecalculatedStats,
        isLoading: false, 
        error: null,
        gameLog: Array.isArray(loadedState.gameLog) ? loadedState.gameLog : [], 
        minimapLayout: null, 
      });
      addLogEntry('system', '저장된 게임 상태를 성공적으로 불러왔습니다.');
      return true;
    } else {
      addLogEntry('error', '저장된 게임 상태를 불러오는 데 실패했거나, 저장된 데이터가 없습니다.');
      removeFromLocalStorage(LOCAL_STORAGE_GAME_STATE_KEY); 
      return false;
    }
  }, [addLogEntry]);

  useEffect(() => {
    if (gameState.gameLog.length === 0 && !gameState.isLoading && !gameState.error) {
       const savedGame = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
       if (!savedGame) { 
            const savedScript = loadFromLocalStorage<GameScript>(LOCAL_STORAGE_SCRIPT_KEY);
            if (!savedScript) {
                addLogEntry('system', '저장된 스크립트나 게임 상태가 없습니다. 새 스크립트를 불러오거나 기본 게임을 시작하세요.');
            }
       }
    }
  }, [gameState.gameLog.length, gameState.isLoading, gameState.error, addLogEntry]); 

  const setPlayerTarget = useCallback((enemyCombatId: string | null) => {
    setGameState(prev => ({...prev, playerTargetId: enemyCombatId}));
  }, []);

  const setActiveSkillForTargeting = useCallback((skill: Skill | null) => {
    setGameState(prev => ({...prev, activeSkill: skill, playerTargetId: null })); 
  }, []);

  const performDelegatedAction = useCallback(() => {
    const { isLoading, isGameOver, combatTurn, player, currentEnemies, isDelegationModeActive, isCombatActive, pendingSafeSceneTransition } = gameState;

    if (isLoading || isGameOver || !player || player.hp <= 0 || !isDelegationModeActive || !isCombatActive || pendingSafeSceneTransition) {
        return;
    }

    if (combatTurn === 'player') { 
        const livingEnemies = currentEnemies.filter(e => e.currentHp > 0);
        if (livingEnemies.length > 0) {
            const targetEnemy = livingEnemies[0]; 
            addLogEntry('system', `[전투 위임] ${targetEnemy.name}을(를) 자동으로 공격합니다.`);
            handlePlayerAttack(targetEnemy.combatId);
        }
        return; 
    }
  }, [gameState, handlePlayerAttack, addLogEntry]);

  const calculateMinimapLayout = useCallback((stage: Stage | null, currentSceneId: string | null, visitedIds: string[]): { nodes: MinimapLayoutNode[], edges: MinimapLayoutEdge[] } | null => {
    if (!stage || !currentSceneId) return null;
    const nodes: MinimapLayoutNode[] = [];
    const edges: MinimapLayoutEdge[] = [];
    const sceneMap = new Map(stage.scenes.map(s => [s.id, s]));
    
    const nodePositions = new Map<string, { x: number, y: number }>();
    const layers = new Map<number, string[]>(); 
    const sceneDepth = new Map<string, number>(); 

    const queue: { sceneId: string; depth: number }[] = [];
    const entrySceneId = stage.scenes[0]?.id;

    if (entrySceneId) {
        queue.push({ sceneId: entrySceneId, depth: 0 });
        sceneDepth.set(entrySceneId, 0);
        if (!layers.has(0)) layers.set(0, []);
        layers.get(0)!.push(entrySceneId);
    }
    
    let head = 0;
    while(head < queue.length) {
        const { sceneId, depth } = queue[head++];
        const currentSceneObj = sceneMap.get(sceneId);
        if (!currentSceneObj) continue;

        const children: string[] = [];
        if (currentSceneObj.nextSceneId) children.push(currentSceneObj.nextSceneId);
        currentSceneObj.choices?.forEach(choice => children.push(choice.nextSceneId));

        children.forEach(childId => {
            if (sceneMap.has(childId) && !sceneDepth.has(childId)) {
                sceneDepth.set(childId, depth + 1);
                if (!layers.has(depth + 1)) layers.set(depth + 1, []);
                layers.get(depth + 1)!.push(childId);
                queue.push({ sceneId: childId, depth: depth + 1 });
            }
             if (sceneMap.has(childId)) { 
                edges.push({ sourceId: sceneId, targetId: childId });
            }
        });
    }

    let maxDepth = 0;
    layers.forEach((_, depth) => {
        if (depth > maxDepth) maxDepth = depth;
    });

    layers.forEach((sceneIdsInLayer, depth) => {
        sceneIdsInLayer.forEach((sceneId, indexInLayer) => {
            const x = depth * (MINIMAP_NODE_WIDTH + MINIMAP_GAP_X) + MINIMAP_GAP_X / 2;
            const y = indexInLayer * (MINIMAP_NODE_HEIGHT + MINIMAP_GAP_Y) + MINIMAP_GAP_Y / 2;
            nodePositions.set(sceneId, { x, y });
        });
    });
    
    let unpositionedYOffset = (layers.get(0)?.length || 0) * (MINIMAP_NODE_HEIGHT + MINIMAP_GAP_Y);
    stage.scenes.forEach(scene => {
        if (!nodePositions.has(scene.id)) {
            const x = (maxDepth + 1) * (MINIMAP_NODE_WIDTH + MINIMAP_GAP_X) + MINIMAP_GAP_X / 2; 
            const y = unpositionedYOffset + MINIMAP_GAP_Y/2;
            nodePositions.set(scene.id, { x, y });
            unpositionedYOffset += (MINIMAP_NODE_HEIGHT + MINIMAP_GAP_Y);
             if (scene.nextSceneId && sceneMap.has(scene.nextSceneId)) edges.push({ sourceId: scene.id, targetId: scene.nextSceneId });
             scene.choices?.forEach(choice => {
                if(sceneMap.has(choice.nextSceneId)) edges.push({ sourceId: scene.id, targetId: choice.nextSceneId});
             });
        }
    });

    stage.scenes.forEach(scene => {
        const pos = nodePositions.get(scene.id);
        if (pos) {
            nodes.push({
                data: { id: scene.id, title: scene.title, type: scene.type },
                x: pos.x,
                y: pos.y,
                isCurrent: scene.id === currentSceneId,
                isVisited: visitedIds.includes(scene.id),
            });
        }
    });
    
    const uniqueEdges = edges.filter((edge, index, self) =>
      index === self.findIndex((e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId)
    );

    return { nodes, edges: uniqueEdges };
  }, []);

  useEffect(() => {
    if (gameState.currentStage && gameState.currentScene && gameState.player) {
        const layout = calculateMinimapLayout(gameState.currentStage, gameState.currentScene.id, gameState.player.visitedSceneIds);
        setGameState(prev => ({ ...prev, minimapLayout: layout }));
    } else {
        setGameState(prev => ({ ...prev, minimapLayout: null }));
    }
  }, [gameState.currentStage, gameState.currentScene?.id, gameState.player?.visitedSceneIds, calculateMinimapLayout]);


  return { 
    ...gameState, 
    loadScript, 
    advanceToScene, 
    makeChoice, 
    resetGame,
    clearActiveGameSessionInMemory,
    addLogEntry, 
    useItem, 
    toggleEquipment, 
    restPlayer, 
    openShop, 
    closeShop, 
    buyItem, 
    sellItem,
    handlePlayerAttack,
    handlePlayerSkill,
    handlePlayerUseItemInCombat,
    handleFleeAttempt,
    setPlayerTarget,
    setActiveSkillForTargeting,
    restartCurrentCombat,
    toggleDelegationMode, 
    performDelegatedAction,
    saveFullGameState,
    loadFullGameState,
  };
};
