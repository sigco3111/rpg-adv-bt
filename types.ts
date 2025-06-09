export interface WorldSettings {
  title: string;
  description: string;
  mainConflict?: string;
  keyLocations?: string;
}

export enum CharacterType {
  PLAYER = "플레이어 캐릭터",
  NPC = "NPC",
  MONSTER_NORMAL = "일반 몬스터",
  MONSTER_BOSS = "보스 몬스터",
}

export interface Character {
  id: string;
  name: string;
  type: CharacterType;
  description: string;
  dialogueSeed: string | null;
  hp?: number;
  maxHp?: number;
  attack?: number;
  defense?: number; // Added for enemies
  skills?: string[]; // IDs of skills the character knows (for enemies)
  currentHp?: number; // For managing enemy HP in combat
  baseAttack?: number; // For enemies, to distinguish from modified attack
  baseDefense?: number; // For enemies
}

export interface CombatEnemyInstance extends Character {
  combatId: string; // Unique ID for this combat instance
  currentHp: number; 
  maxHp: number; 
  attack: number; // Now used for final attack after buffs/debuffs
  defense: number; // Now used for final defense
  activeStatusEffects: StatusEffect[];
}


export interface CombatDetails {
  enemyCharacterIds: string[];
  reward: string; 
}

export interface SceneChoice {
  id: string;
  text: string;
  nextSceneId: string;
}

export enum SceneType {
  NARRATION = "나레이션",
  LOCATION_CHANGE = "장소 변경",
  TOWN = "마을",
  DIALOGUE = "대화",
  COMBAT_NORMAL = "일반 전투",
  ITEM_GET = "아이템 획득",
  CHOICE = "선택",
  COMBAT_BOSS = "보스 전투",
}

export interface Scene {
  id: string;
  stageId: string;
  title: string;
  type: SceneType;
  content: string;
  characterIds: string[]; 
  nextSceneId: string | null;
  newLocationName?: string;
  combatDetails?: CombatDetails;
  item?: string; // Name of the item received
  choices?: SceneChoice[];
}

export interface Stage {
  id: string;
  title: string;
  settingDescription: string;
  characters: Character[];
  scenes: Scene[];
}

export interface GameScript {
  worldSettings: WorldSettings;
  stages: Stage[];
}

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface GameItemEffect {
  hp?: number; // Direct HP heal/damage
  mp?: number; // Direct MP heal/damage
  attack?: number; // Stat boost from equip
  defense?: number; // Stat boost from equip
  speed?: number; // Stat boost from equip
  luck?: number; // Stat boost from equip
  critChance?: number; // Stat boost from equip
  
  // Status effect related
  appliesEffect?: { effectId: StatusEffectId; duration: number; potency?: number };
  curesEffect?: StatusEffectId[]; // Array of effect IDs to cure
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'weapon' | 'armor' | 'accessory' | 'keyItem';
  quantity: number;
  effects?: GameItemEffect;
  equipSlot?: EquipmentSlot;
  sellPrice?: number;
  icon?: string; 
}

export interface PlayerEquipment {
  weapon: GameItem | null;
  armor: GameItem | null;
  accessory: GameItem | null;
}

export interface PlayerState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  // Core stats
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseLuck: number;
  // Derived stats (base + equipment + status effects)
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  critChance: number; // Percentage
  
  inventory: GameItem[];
  equipment: PlayerEquipment;
  currentLocation: string;
  learnedSkillIds: string[]; 
  visitedSceneIds: string[]; 
  activeStatusEffects: StatusEffect[];
}

export interface GameLogEntry {
  id: string;
  type: 'narration' | 'dialogue' | 'event' | 'reward' | 'error' | 'location' | 'system' | 'combat' | 'combat_action' | 'combat_result' | 'status_effect';
  speaker?: string; 
  message: string;
  timestamp: number;
}

// For Radar Chart
export interface StatChartData {
  subject: string;
  value: number;
  fullMark: number;
}

// Skill System Types
export type SkillTargetType = 'enemy_single' | 'enemy_all' | 'self' | 'ally_single' | 'none';

// Direct effects of skills
export type SkillDirectEffectType = 
  | 'damage_hp' 
  | 'heal_hp' 
  | 'damage_mp' 
  | 'heal_mp'
  | 'etc'; // For skills that primarily apply status effects or have unique logic


export interface Skill {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  effectValue?: number; // Base value for direct damage/heal
  effectType: SkillDirectEffectType; // Direct effect
  targetType: SkillTargetType;
  icon?: string;
  appliesStatusEffect?: { // Status effect to apply
    effectId: StatusEffectId; 
    duration: number; 
    potency?: number; // Potency of the applied status effect (e.g., poison damage)
    chance?: number; // Chance to apply (0-1, defaults to 1 if undefined)
  };
}

// Status Effect System
export type StatusEffectId = 
  | 'poison' 
  | 'attack_buff' 
  | 'defense_buff'
  | 'defense_debuff'
  | 'stun' // Example, not fully implemented in this pass
  | 'regen_hp'; // Example

export interface StatusEffectDefinition {
  id: StatusEffectId;
  name: string; // Display name (e.g., "독", "공격력 증가")
  icon: string;
  description: string; // Brief description of the effect
  
  isBuff: boolean; // True for beneficial, false for detrimental
  
  // How the effect impacts stats or applies damage/healing over time
  statModifiers?: { // For buffs/debuffs directly altering stats
    stat: 'attack' | 'defense' | 'speed' | 'luck' | 'maxHp' | 'maxMp' | 'critChance';
    value: number; // Can be positive (buff) or negative (debuff)
    isPercentage?: boolean; // If true, value is a percentage (e.g., 0.1 for +10%)
  }[];
  
  tickEffect?: { // For effects that trigger each turn (DoT, HoT)
    statToAffect: 'hp' | 'mp';
    basePotency: number; // Amount of damage/healing per tick
    canBeNegative?: boolean; // True if it can damage (like poison)
  };

  preventsAction?: boolean; // For effects like stun, paralysis
  
  defaultDuration: number; // Default turns the effect lasts
  
  onApplyLog?: string; // Message when applied (e.g., "{target}은(는) {effectName} 상태가 되었다!")
  onTickLog?: string;  // Message on tick (e.g., "{target}은(는) {effectName}으로 {value}의 피해를 입었다!")
  onExpireLog?: string; // Message when expired (e.g., "{target}의 {effectName} 효과가 사라졌다.")
}

// Instance of an active status effect on a character
export interface StatusEffect extends StatusEffectDefinition {
  remainingDuration: number;
  appliedPotency: number; // Actual potency for this instance (e.g., poison damage per turn)
  sourceCharacterId?: string; // Who applied this effect (optional)
}


// Minimap Types
export interface MinimapNodeData {
  id: string;
  title: string;
  type: SceneType;
}

export interface MinimapLayoutNode {
  data: MinimapNodeData;
  x: number;
  y: number;
  isCurrent: boolean;
  isVisited: boolean;
}

export interface MinimapLayoutEdge {
  sourceId: string;
  targetId: string;
}

// GameLogicState in useGameLogic.ts
export interface GameLogicHookState { 
  script: GameScript | null;
  currentStage: Stage | null;
  currentScene: Scene | null;
  player: PlayerState | null;
  gameLog: GameLogEntry[];
  isLoading: boolean; 
  error: string | null;
  isGameOver: boolean;
  
  isShopOpen: boolean;
  currentShopId: string | null;
  currentShopItems: GameItem[];
  shopError: string | null;

  isCombatActive: boolean;
  currentEnemies: CombatEnemyInstance[];
  combatTurn: 'player' | 'enemy' | 'enemy_acting' | null; 
  playerTargetId: string | null; 
  activeSkill: Skill | null; 
  combatMessage: string | null;

  isDelegationModeActive: boolean; 
  awaitingPostDelegatedNormalCombatChoice: boolean;
  lastVisitedTownSceneId: string | null;
  pendingSafeSceneTransition: string | null;
  minimapLayout: { nodes: MinimapLayoutNode[], edges: MinimapLayoutEdge[] } | null;
}