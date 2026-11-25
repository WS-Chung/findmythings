import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  title: string;
  /** 본문. 무엇이 사라지는지, 대상 이름과 함께 문장으로 쓴다. */
  message: string;
  /** 확인 버튼 이름. "확인"이 아니라 동작 이름("삭제")을 쓴다. */
  confirmLabel: string;
  /**
   * 확인 버튼을 눌렀을 때 호출.
   * Promise를 반환하면 처리 동안 두 버튼이 비활성되고,
   * 호출자가 onCancel을 부르거나 unmount할 때까지 대화상자를 유지한다.
   */
  onConfirm: () => void | Promise<void>;
  /** 배경 클릭, 취소 버튼, Esc 키 시 호출. 변경은 일어나지 않는다. */
  onCancel: () => void;
  /** 부모가 전달하는 실패 문장. */
  errorMessage?: string | null;
}

/**
 * 되돌릴 수 없는 동작 앞의 확인 대화상자.
 * 위험한 동작도 색으로 구분하지 않는다. 대상 이름이 든 문장과 동작 이름 버튼으로 알린다.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  errorMessage,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleCancel = () => {
    // 처리 중에는 닫지 않는다 (진행 중인 삭제와 경합 방지).
    if (!pending) onCancel();
  };

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      // onConfirm이 unmount를 트리거했다면 이 setState는 무시된다.
      setPending(false);
    }
  };

  return (
    <Dialog
      title={title}
      width={440}
      onClose={handleCancel}
      footer={
        <>
          <button
            type="button"
            className="btn btn-2"
            onClick={handleCancel}
            disabled={pending}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-1"
            onClick={() => void handleConfirm()}
            disabled={pending}
          >
            {pending ? "처리 중" : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {errorMessage ? (
        <p className="confirm__error err" role="alert">
          <Icon name="alert" />
          {errorMessage}
        </p>
      ) : null}
    </Dialog>
  );
}
