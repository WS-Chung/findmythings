import { useEffect, useState, type MouseEvent } from "react";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  /** 본문 메시지(예: '"X"을(를) 삭제할까요?'). */
  message: string;
  /**
   * "확인" 클릭 시 호출.
   * Promise를 반환하면 처리 동안 두 버튼이 비활성되고,
   * 호출자가 명시적으로 onCancel 또는 unmount를 트리거할 때까지 다이얼로그를 유지한다.
   */
  onConfirm: () => void | Promise<void>;
  /** 백드롭 클릭, 취소 버튼, Esc 키 시 호출. */
  onCancel: () => void;
  /** true면 확인 버튼을 ink 배경 + on-primary 텍스트로 강조 표시. */
  danger?: boolean;
  /** 부모(예: ItemPopup)가 전달하는 에러 메시지. truthy면 본문 아래 표시. */
  errorMessage?: string | null;
}

/**
 * 삭제 확인 다이얼로그 (요구 6.1, 6.5).
 *
 * 디자인 토큰:
 *   - 컨테이너: 1px solid --color-hairline + --radius-lg + canvas 배경
 *   - 백드롭: rgba(0,0,0,0.3), 중앙 정렬
 *   - z-index 1100: ItemPopup(1000) 위에 떠야 한다
 *   - 취소: button-secondary-pill (transparent + primary border)
 *   - 확인(danger=true): --color-ink 배경 + --color-on-primary 텍스트, pill
 *   - 확인(danger=false): button-primary
 *
 * 닫기 트리거 (요구 6.5 = Property 9):
 *   - 백드롭 클릭, 취소 버튼, Esc 키 모두 onCancel만 호출하며 supabase에는 어떤 변경도 가하지 않는다.
 */
export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  danger = false,
  errorMessage,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  // Esc 키 → onCancel (처리 중에는 무시하여 race 방지).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  const handleBackdropClick = () => {
    if (!pending) onCancel();
  };

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleConfirmClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      // unmount 후 setState 경고를 피하기 위해, onConfirm이 unmount를 트리거할 수도 있으니
      // 단순히 항상 reset 시도. (cleanup이 먼저 실행되면 setState 무시됨.)
      setPending(false);
    }
  };

  return (
    <div
      className="confirm-dialog__backdrop"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog" onClick={stop}>
        <p className="confirm-dialog__message">{message}</p>

        {errorMessage ? (
          <p className="confirm-dialog__error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__cancel"
            onClick={onCancel}
            disabled={pending}
          >
            취소
          </button>
          <button
            type="button"
            className={
              danger
                ? "confirm-dialog__confirm confirm-dialog__confirm--danger"
                : "confirm-dialog__confirm"
            }
            onClick={handleConfirmClick}
            disabled={pending}
          >
            {pending ? "처리 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
