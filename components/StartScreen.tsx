import React from 'react';

interface StartScreenProps {
  onStartNewGame: () => void;
  onShowScriptImporter: () => void;
  onLoadSavedGame: () => void;
  hasSavedGame: boolean;
  defaultGameTitle: string;
  fetchError: string | null;
  showNewGameConfirm: boolean;
  onConfirmNewGameStart: () => void;
  onCancelNewGameStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ 
  onStartNewGame, 
  onShowScriptImporter, 
  onLoadSavedGame,
  hasSavedGame,
  defaultGameTitle,
  fetchError,
  showNewGameConfirm,
  onConfirmNewGameStart,
  onCancelNewGameStart
}) => {
  const handleExportOriginalScript = async () => {
    try {
      // 여러 가능한 경로를 시도
      let response: Response | null = null;
      let scriptJsonString: string | null = null;
      
      // 가능한 경로 목록
      const possiblePaths = ['./script.json', '/script.json', '/public/script.json', 'script.json', '../script.json'];
      
      // 각 경로 시도
      for (const path of possiblePaths) {
        try {
          console.log(`시나리오 내보내기 경로 시도: ${path}`);
          const tempResponse = await fetch(path);
          if (tempResponse.ok) {
            response = tempResponse;
            scriptJsonString = await response.text();
            console.log(`시나리오를 성공적으로 로드했습니다: ${path}`);
            break;
          }
        } catch (pathError) {
          console.warn(`경로 ${path}에서 시나리오 로드 실패:`, pathError);
        }
      }
      
      // 모든 경로 시도 후에도 실패한 경우
      if (!response || !scriptJsonString) {
        throw new Error(`모든 경로에서 기본 시나리오를 가져오는 데 실패했습니다.`);
      }
      
      const blob = new Blob([scriptJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'script.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("오리지널 시나리오 내보내기 오류:", error);
      alert(error instanceof Error ? error.message : "시나리오 파일 내보내기 중 오류 발생.");
    }
  };

  if (showNewGameConfirm) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="pixel-panel p-5 max-w-md">
          <h2 className="pixel-header text-lg mb-3">새 게임 확인</h2>
          <p className="text-sm text-[var(--pixel-text-dim)] mb-5 leading-relaxed">
            저장된 데이터가 초기화 됩니다. 계속하시겠습니까?
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onConfirmNewGameStart}
              className="pixel-button pixel-button-danger text-sm px-6"
              aria-label="확인하고 새 게임 시작"
            >
              확인
            </button>
            <button
              onClick={onCancelNewGameStart}
              className="pixel-button text-sm px-6"
              aria-label="새 게임 시작 취소"
            >
              취소
            </button>
          </div>
        </div>
        <footer className="absolute bottom-3 text-xs text-[var(--pixel-border)]">
          <p>&copy; {new Date().getFullYear()} JRPG ENGINE</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <h1 className="font-pixel-header text-2xl sm:text-3xl text-[var(--pixel-highlight)] mb-4" style={{ textShadow: '3px 3px var(--pixel-bg-dark)'}}>
        {defaultGameTitle}
      </h1>
      <p className="text-base text-[var(--pixel-text-dim)] mb-8 leading-relaxed">
        모험을 시작하시겠습니까?
      </p>
      {fetchError && (
        <div className="pixel-panel mb-4 p-2.5 border-2 border-[var(--pixel-error)] bg-[var(--pixel-bg-dark)]" role="alert">
          <p className="text-[var(--pixel-error)] text-sm">오류: {fetchError}</p>
        </div>
      )}
      <div className="space-y-2.5 w-full max-w-xs">
        <button
          onClick={onStartNewGame}
          className="pixel-button pixel-button-primary w-full text-sm"
          aria-label="새 게임 시작 (기본 시나리오)"
        >
          새 게임 (기본)
        </button>
        {hasSavedGame && (
          <button
            onClick={onLoadSavedGame}
            className="pixel-button pixel-button-success w-full text-sm"
            aria-label="이어하기"
          >
            이어하기
          </button>
        )}
        <button
          onClick={onShowScriptImporter}
          className="pixel-button w-full text-sm"
          aria-label="커스텀 시나리오 파일 불러오기"
        >
          커스텀 시나리오
        </button>
        <button
          onClick={handleExportOriginalScript}
          className="pixel-button w-full text-sm !bg-[var(--pixel-accent)] !text-[var(--pixel-bg-dark)]"
          aria-label="오리지널 시나리오 파일 내보내기"
        >
          원본 시나리오 저장
        </button>
      </div>
       <footer className="absolute bottom-3 text-xs text-[var(--pixel-border)]">
        <p>&copy; {new Date().getFullYear()} JRPG ENGINE</p>
      </footer>
    </div>
  );
};
