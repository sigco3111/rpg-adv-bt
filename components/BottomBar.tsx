import React from 'react';

interface BottomBarProps {
  playerGold: number;
  onOpenInventory: () => void;
  onOpenStatsChart: () => void;
  onOpenSkills: () => void; 
  onGoToMainMenu: () => void;
  onSaveGame: () => void;
  isGameActive: boolean;
  isDelegationModeActive: boolean; 
  onToggleDelegationMode: () => void; 
}

const ActionButton: React.FC<{ onClick: () => void; label: string, className?: string, 'aria-label'?: string, disabled?: boolean }> = 
  ({ onClick, label, className, disabled, ...props }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`pixel-button text-xs flex-1 ${className}`} /* text-xs for Press Start 2P on buttons */
    aria-label={props['aria-label'] || label}
  >
    {label}
  </button>
);

export const BottomBar: React.FC<BottomBarProps> = ({ 
    playerGold,
    onOpenInventory, 
    onOpenStatsChart,
    onOpenSkills,
    onGoToMainMenu,
    onSaveGame,
    isGameActive,
    isDelegationModeActive,
    onToggleDelegationMode,
}) => {
  return (
    <div className="pixel-panel mt-1.5 sm:mt-2.5 p-1.5"> {/* Increased padding and margin */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5"> {/* Increased gap */}
        <ActionButton 
          onClick={onOpenInventory} 
          label={`가방(${playerGold}G)`} 
          aria-label={`가방 열기, 소지금 ${playerGold}G`} 
          className="sm:col-span-2 !bg-[var(--pixel-accent)] !text-[var(--pixel-bg-dark)]"
        />
        <ActionButton onClick={onOpenSkills} label="스킬" aria-label="스킬 목록" className="!bg-[var(--pixel-mp)]" />
        <ActionButton onClick={onOpenStatsChart} label="능력치" aria-label="능력치 차트" />
        <ActionButton 
          onClick={onSaveGame} 
          label="저장" 
          aria-label="게임 저장" 
          disabled={!isGameActive}
          className="!bg-[var(--pixel-success)] !text-[var(--pixel-bg-dark)]"
        />
        <ActionButton 
          onClick={onToggleDelegationMode} 
          label={isDelegationModeActive ? "위임ON" : "위임OFF"} 
          className={`${isDelegationModeActive ? '!bg-teal-500 !text-black' : '!bg-[var(--pixel-button-default-bg)]'} sm:col-span-1`}
          aria-label={isDelegationModeActive ? "전투 위임 모드 끄기" : "전투 위임 모드 켜기"}
        />
      </div>
      <ActionButton 
        onClick={onGoToMainMenu} 
        label="메인 메뉴" 
        className="w-full mt-1.5 !bg-[var(--pixel-error)]"  /* Increased margin */
        aria-label="메인 메뉴로 돌아가기" 
      /> 
    </div>
  );
};