import React, { useState, useCallback } from 'react';

interface ScriptImporterProps {
  onScriptLoad: (scriptJson: string) => void;
  error?: string | null;
}

export const ScriptImporter: React.FC<ScriptImporterProps> = ({ onScriptLoad, error }) => {
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/json") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
            onScriptLoad(text);
          } else {
            setFileError("파일 내용 읽기 실패.");
          }
        };
        reader.onerror = () => {
          setFileError("파일 읽기 오류.");
        };
        reader.readAsText(file);
      } else {
        setFileError("JSON 파일만 업로드 가능합니다.");
      }
    }
  }, [onScriptLoad]);

  return (
    <div className="pixel-panel flex flex-col items-center p-5 max-w-md mx-auto my-5"> {/* Increased padding and max-width */}
      <h2 className="pixel-header text-xl mb-4">JRPG 스크립트 가져오기</h2> {/* Increased size and margin */}
      <p className="text-[var(--pixel-text-dim)] mb-4 text-sm text-center leading-relaxed"> {/* Increased size, margin and leading */}
        모험을 시작할 JSON 파일을 업로드하세요.
      </p>
      <div className="w-full mb-3 p-1.5 border-2 border-dashed border-[var(--pixel-border)] bg-[var(--pixel-bg-dark)]"> {/* Increased padding and margin */}
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="block w-full text-sm text-[var(--pixel-text-dim)] /* Increased size */
                     file:mr-2.5 file:py-1.5 file:px-2.5 /* Increased file button padding/margin */
                     file:border-0 file:text-xs file:font-semibold /* file: is Press Start 2P */
                     file:pixel-button file:!bg-[var(--pixel-highlight)] file:!text-[var(--pixel-bg-dark)]
                     cursor-pointer" /* hover:file:!bg-[var(--pixel-accent)] removed */
        />
      </div>
      {fileError && <p className="text-[var(--pixel-error)] text-xs mt-1.5">{fileError}</p>} {/* Increased size and margin */}
      {error && <p className="text-[var(--pixel-error)] text-xs mt-1.5">스크립트 오류: {error}</p>} {/* Increased size and margin */}
      <div className="mt-4 text-xs text-[var(--pixel-border)] text-center"> {/* Increased size and margin */}
        <p>JSON 스크립트 형식을 확인하세요.</p>
        <p>샘플 스크립트는 프로젝트 문서 참조.</p>
      </div>
    </div>
  );
};