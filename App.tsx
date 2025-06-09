import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameLogic } from './hooks/useGameLogic'; 
import { ScriptImporter } from './components/ScriptImporter';
import { PlayerStatsPanel } from './components/PlayerStatsPanel';
import { GameLogPanel } from './components/GameLogPanel';
import { GameScreen } from './components/GameScreen';
import { BottomBar } from './components/BottomBar';
import { InventoryModal } from './components/InventoryModal';
import { StatsChartModal } from './components/StatsChartModal';
import { ShopModal } from './components/ShopModal';
import { SkillModal } from './components/SkillModal';
import { MinimapPanel } from './components/MinimapPanel';
import { GameItem, GameScript, GameLogicHookState } from './types'; 
import { LoadingSpinner } from './components/LoadingSpinner';
import { StartScreen } from './components/StartScreen';
import { LOCAL_STORAGE_GAME_STATE_KEY } from './constants';
import { loadFromLocalStorage } from './utils/localStorage';

const App: React.FC = () => {
  const gameLogicHookResult = useGameLogic();

  if (!gameLogicHookResult) {
    console.error("Critical Error: useGameLogic() returned undefined.");
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4 bg-red-900 text-white font-pixel-header">
        <h1 className="text-2xl font-bold mb-4">CRITICAL ERROR</h1>
        <p className="font-sans">Game logic failed to initialize. Check console.</p> 
      </div>
    );
  }

  const {
    script, currentScene, player, gameLog, isLoading, error, isGameOver,
    loadScript, advanceToScene, makeChoice, resetGame, useItem, toggleEquipment,
    addLogEntry, restPlayer, openShop, isShopOpen, currentShopItems, shopError,
    closeShop, buyItem, sellItem,
    isCombatActive, currentEnemies, combatTurn, playerTargetId, activeSkill, combatMessage,
    handlePlayerAttack, handlePlayerSkill, handlePlayerUseItemInCombat, handleFleeAttempt,
    setPlayerTarget, setActiveSkillForTargeting, restartCurrentCombat,
    isDelegationModeActive, toggleDelegationMode, performDelegatedAction,
    saveFullGameState, loadFullGameState, clearActiveGameSessionInMemory,
    minimapLayout
  } = gameLogicHookResult;

  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [isStatsChartOpen, setStatsChartOpen] = useState(false);
  const [isSkillModalOpen, setSkillModalOpen] = useState(false);

  type UiMode = 'start' | 'importer' | 'game' | 'error_importer' | 'loading_init';
  const [uiMode, setUiMode] = useState<UiMode>('loading_init');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasSavedGame, setHasSavedGame] = useState<boolean>(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState<boolean>(false);


  const autoActionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const savedGameState = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
    setHasSavedGame(!!savedGameState);
    setUiMode('start'); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memoizedSetHasSavedGame = useCallback(setHasSavedGame, []);

  useEffect(() => {
    if (uiMode === 'loading_init') {
      if (isLoading) {
        return; 
      } else {
        if (script && player && !error && !fetchError) {
          setUiMode('game');
        } else {
          const persistentSave = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
          memoizedSetHasSavedGame(!!persistentSave);
          setUiMode('start'); 
        }
        return; 
      }
    }

    if (fetchError) { 
      if (uiMode !== 'error_importer') setUiMode('error_importer');
      return;
    }
    if (error && uiMode !== 'importer' && uiMode !== 'error_importer') { 
      setUiMode('error_importer');
      return;
    }
    
    if (script && player && !isGameOver && !fetchError && !error) {
      if (uiMode === 'start' || (uiMode !== 'game' && uiMode !== 'importer' && uiMode !== 'error_importer' && uiMode !== 'loading_init')) { 
        setUiMode('game');
      }
      return;
    }

    if (!isLoading && !script && !player && !fetchError && !error) {
      if (uiMode === 'game') { 
         setUiMode('start');
         const savedGameState = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
         memoizedSetHasSavedGame(!!savedGameState);
      }
      return;
    }
  }, [script, player, error, isLoading, fetchError, uiMode, isGameOver, memoizedSetHasSavedGame]);

  useEffect(() => {
    const clearAutoActionTimeout = () => {
      if (autoActionTimeoutRef.current) {
        clearTimeout(autoActionTimeoutRef.current);
        autoActionTimeoutRef.current = null;
      }
    };

    if (
      isDelegationModeActive &&
      isCombatActive &&
      !isInventoryOpen && !isSkillModalOpen && !isShopOpen && !isStatsChartOpen &&
      !isLoading && !isGameOver && player && player.hp > 0
    ) {
      clearAutoActionTimeout();
      autoActionTimeoutRef.current = setTimeout(() => {
        performDelegatedAction();
      }, 1500);
    } else {
      clearAutoActionTimeout();
    }
    return clearAutoActionTimeout;
  }, [
    isDelegationModeActive, isCombatActive, combatTurn,
    isInventoryOpen, isSkillModalOpen, isShopOpen, isStatsChartOpen,
    isLoading, isGameOver, player, performDelegatedAction, currentScene?.id,
  ]);

  const requestStartNewGameConfirmation = () => {
    setShowNewGameConfirm(true);
  };

  const executeNewGameStart = async () => {
    resetGame(); 
    setHasSavedGame(false); 
    setFetchError(null);
    setUiMode('loading_init'); 

    try {
      addLogEntry('system', '새 게임 시작: 기본 시나리오 불러옵니다...');
      
      // 여러 가능한 경로를 시도
      let response: Response | null = null;
      let scriptJsonString: string | null = null;
      
      // Vercel 배포 환경에서 작동하는 경로 목록
      const possiblePaths = ['./script.json', '/script.json', '/public/script.json', 'script.json', '../script.json'];
      
      // 각 경로 시도
      for (const path of possiblePaths) {
        try {
          console.log(`경로 시도: ${path}`);
          const tempResponse = await fetch(path);
          if (tempResponse.ok) {
            response = tempResponse;
            scriptJsonString = await response.text();
            console.log(`스크립트를 성공적으로 로드했습니다: ${path}`);
            break;
          }
        } catch (pathError) {
          console.warn(`경로 ${path}에서 스크립트 로드 실패:`, pathError);
        }
      }
      
      // 모든 경로 시도 후에도 실패한 경우
      if (!response || !scriptJsonString) {
        throw new Error(`모든 경로에서 기본 스크립트를 가져오는 데 실패했습니다.`);
      }
      
      loadScript(scriptJsonString);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "기본 스크립트 로드 오류";
      console.error("기본 스크립트 로딩 중 오류:", errorMessage);
      setFetchError(errorMessage);
      addLogEntry('error', `오류: ${errorMessage}`);
    }
  };
  
  const handleConfirmNewGameStart = () => {
    setShowNewGameConfirm(false);
    executeNewGameStart();
  };

  const handleCancelNewGameStart = () => {
    setShowNewGameConfirm(false);
  };


  const handleShowScriptImporter = () => {
    const savedGameExists = !!loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
    if (savedGameExists) {
      if (!window.confirm("기존 저장된 게임 데이터가 있습니다. 새 시나리오 로드 시 삭제됩니다. 계속하시겠습니까?")) return;
    }
    resetGame();
    setHasSavedGame(false);
    setFetchError(null); 
    setUiMode('importer');
  };

  const handleScriptLoadedByImporter = (scriptJson: string) => {
    setFetchError(null);
    setUiMode('loading_init'); 
    loadScript(scriptJson);
  };

  const handleLoadSavedGame = () => {
    setFetchError(null); 
    setUiMode('loading_init');
    if (loadFullGameState()) { 
      setHasSavedGame(true);
    } else {
      addLogEntry('error', '저장된 게임 로드 실패. 새 게임을 시작하세요.');
      setFetchError('저장된 게임 로드 실패.');
      setUiMode('start'); 
      setHasSavedGame(false);
    }
  };

  const handleSaveCurrentGame = () => {
    if (player && script) {
      saveFullGameState();
      setHasSavedGame(true);
    } else {
      addLogEntry('error', '저장할 활성 게임이 없습니다.');
    }
  };

  const handleGoToMainMenu = () => {
    setInventoryOpen(false);
    setStatsChartOpen(false);
    setSkillModalOpen(false);
    if (isShopOpen) closeShop();
    clearActiveGameSessionInMemory();
    const savedGameState = loadFromLocalStorage<GameLogicHookState>(LOCAL_STORAGE_GAME_STATE_KEY);
    setHasSavedGame(!!savedGameState);
    setFetchError(null);
    setShowNewGameConfirm(false); // Ensure confirmation is reset
    setUiMode('start');
  };

  const handleOpenInventory = () => setInventoryOpen(true);
  const handleCloseInventory = () => setInventoryOpen(false);
  const handleOpenStatsChart = () => setStatsChartOpen(true);
  const handleCloseStatsChart = () => setStatsChartOpen(false);
  const handleOpenSkillModal = () => setSkillModalOpen(true);
  const handleCloseSkillModal = () => {
    setSkillModalOpen(false);
    if (isCombatActive && activeSkill && activeSkill.targetType === 'enemy_single') {
        setActiveSkillForTargeting(null);
    }
  };

  const handleUseItemFromInventory = (item: GameItem) => {
    if (isCombatActive) {
      if (item.type === 'consumable' && item.effects) {
        if (item.effects.attack && item.effects.attack > 0) {
            addLogEntry('system', `${item.name} 사용: 전투 화면에서 대상을 선택하세요.`);
            setActiveSkillForTargeting({id: item.id, name: item.name, description: '아이템 대상 선택', mpCost: 0, effectType:'etc', targetType:'enemy_single', icon: item.icon});
        } else {
            handlePlayerUseItemInCombat(item.id);
        }
      } else {
        addLogEntry('system', `${item.name}은(는) 전투 중에 이런 방식으로 사용할 수 없습니다.`);
      }
      handleCloseInventory();
    } else {
      if (item.type === 'consumable') {
        useItem(item.id);
      }
    }
  };

  const handleToggleEquipmentFromInventory = (item: GameItem) => {
    if (item.equipSlot) {
        toggleEquipment(item);
    }
  };

  let content;

  switch (uiMode) {
    case 'loading_init':
      content = (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-base">게임 데이터 초기화 및 로딩 중...</p>
        </div>
      );
      break;
    case 'start':
      content = (
        <div className="container mx-auto p-2 flex justify-center items-center h-screen">
          <StartScreen
            onStartNewGame={requestStartNewGameConfirmation}
            onShowScriptImporter={handleShowScriptImporter}
            onLoadSavedGame={handleLoadSavedGame} 
            hasSavedGame={hasSavedGame}
            defaultGameTitle={"RPG어드벤처 B"}
            fetchError={fetchError}
            showNewGameConfirm={showNewGameConfirm}
            onConfirmNewGameStart={handleConfirmNewGameStart}
            onCancelNewGameStart={handleCancelNewGameStart}
          />
        </div>
      );
      break;
    case 'importer':
      content = (
        <div className="container mx-auto p-2 flex flex-col justify-center items-center h-screen">
          <ScriptImporter onScriptLoad={handleScriptLoadedByImporter} error={error} />
           <button
            onClick={handleGoToMainMenu}
            className="pixel-button pixel-button-primary mt-8 text-sm" 
            aria-label="초기 화면으로 돌아가기"
          >
            초기 화면
          </button>
        </div>
      );
      break;
    case 'error_importer':
      const currentErrorToDisplay = fetchError || error;
      content = (
        <div className="container mx-auto p-2 flex flex-col justify-center items-center h-screen text-center">
          <div className="pixel-panel mb-4">
            <h2 className="pixel-header text-xl text-[var(--pixel-error)]">오류 발생</h2>
            <p className="text-sm mt-2">
              {currentErrorToDisplay || "알 수 없는 오류."}
            </p>
            {uiMode === 'error_importer' && error && !fetchError && ( 
                 <ScriptImporter onScriptLoad={handleScriptLoadedByImporter} error={error} />
            )}
          </div>
          <button
            onClick={handleGoToMainMenu}
            className="pixel-button pixel-button-danger mt-8 text-sm"
            aria-label="초기 화면으로 돌아가기"
          >
            초기 화면
          </button>
        </div>
      );
      break;
    case 'game':
      if (!player || !script || (isLoading && !currentScene && !isCombatActive)) { 
         content = (
            <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
                <LoadingSpinner />
                <p className="mt-4 text-base">게임 화면 준비 중...</p>
            </div>
        );
      } else {
        content = (
          <div className="flex flex-col h-screen p-1.5 sm:p-2.5"> 
            <header className="mb-1.5 sm:mb-2.5 py-1.5 text-center">
              <h1 className="font-pixel-header text-xl sm:text-2xl text-[var(--pixel-highlight)]" style={{ textShadow: '2px 2px var(--pixel-bg-dark)'}}>
                {script.worldSettings.title || '텍스트 JRPG'}
              </h1>
            </header>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-1.5 sm:gap-2.5 overflow-hidden min-h-0">
              <aside className="lg:col-span-1 flex flex-col gap-1.5 sm:gap-2.5 overflow-hidden min-h-0">
                <div className="pixel-panel overflow-hidden p-1.5 sm:p-2 flex-grow" style={{ minHeight: 'calc(50% - 0.5rem)'}}>
                  <PlayerStatsPanel player={player} />
                </div>
                {minimapLayout && (
                  <div className="pixel-panel overflow-hidden p-1.5 sm:p-2" style={{height: '40%', minHeight: '200px'}}>
                    <MinimapPanel 
                      nodes={minimapLayout.nodes} 
                      edges={minimapLayout.edges}
                      currentSceneId={currentScene?.id || null}
                    />
                  </div>
                )}
              </aside>

              <div className="lg:col-span-2 flex flex-col gap-1.5 sm:gap-2.5 overflow-hidden min-h-0"> 
                <section className="flex-1 pixel-panel overflow-hidden min-h-0 p-1.5 sm:p-2"> 
                  <GameLogPanel logEntries={gameLog} />
                </section>
                <main className="flex-1 pixel-panel overflow-hidden min-h-0 p-1.5 sm:p-2"> 
                  <GameScreen
                    scene={currentScene}
                    player={player}
                    isLoading={isLoading} 
                    isGameOver={isGameOver}
                    onAdvance={advanceToScene}
                    onChoice={makeChoice}
                    onResetGame={handleGoToMainMenu} 
                    onRestPlayer={restPlayer}
                    onOpenShop={openShop}
                    isCombatActive={isCombatActive}
                    currentEnemies={currentEnemies}
                    combatTurn={combatTurn}
                    playerTargetId={playerTargetId}
                    activeSkill={activeSkill}
                    combatMessage={combatMessage}
                    onPlayerAttack={handlePlayerAttack}
                    onPlayerSkillAction={handlePlayerSkill}
                    onPlayerUseItemInCombat={handlePlayerUseItemInCombat}
                    onFleeAttempt={handleFleeAttempt}
                    onSetPlayerTarget={setPlayerTarget}
                    onSetActiveSkillForTargeting={setActiveSkillForTargeting}
                    onOpenSkillModal={handleOpenSkillModal}
                    onOpenInventoryModal={handleOpenInventory}
                    onRestartCurrentCombat={restartCurrentCombat}
                  />
                </main>
              </div>
            </div>

            <BottomBar
                playerGold={player?.gold ?? 0}
                onOpenInventory={handleOpenInventory}
                onOpenStatsChart={handleOpenStatsChart}
                onOpenSkills={handleOpenSkillModal}
                onGoToMainMenu={handleGoToMainMenu}
                onSaveGame={handleSaveCurrentGame}
                isGameActive={!!player && !!script && !isGameOver}
                isDelegationModeActive={isDelegationModeActive}
                onToggleDelegationMode={toggleDelegationMode}
            />

            {isInventoryOpen && player && (
              <InventoryModal
                player={player}
                onClose={handleCloseInventory}
                onUseItem={handleUseItemFromInventory}
                onToggleEquipment={handleToggleEquipmentFromInventory}
                isCombatActive={isCombatActive}
              />
            )}
            {isStatsChartOpen && player && (
              <StatsChartModal player={player} onClose={handleCloseStatsChart} />
            )}
            {isShopOpen && player && (
              <ShopModal
                player={player}
                shopItems={currentShopItems}
                isOpen={isShopOpen}
                onClose={closeShop}
                onBuyItem={buyItem}
                onSellItem={sellItem}
                shopError={shopError}
              />
            )}
            {isSkillModalOpen && player && (
              <SkillModal
                player={player}
                isOpen={isSkillModalOpen}
                onClose={handleCloseSkillModal}
                onUseSkill={handlePlayerSkill}
                isCombatMode={isCombatActive}
                onSetActiveSkillForTargeting={setActiveSkillForTargeting}
              />
            )}
            <footer className="mt-1.5 text-center text-xs text-[var(--pixel-text-dim)] py-1"> 
              <p>&copy; {new Date().getFullYear()} JRPG ENGINE</p>
            </footer>
          </div>
        );
      }
      break;
    default:
      content = (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
          <p className="text-[var(--pixel-error)] text-lg">알 수 없는 애플리케이션 상태: {uiMode}</p>
           <button
            onClick={handleGoToMainMenu}
            className="pixel-button pixel-button-primary mt-8 text-sm"
            aria-label="초기 화면으로 돌아가기"
          >
            초기 화면
          </button>
        </div>
      );
  }

  return content;
};

export default App;
