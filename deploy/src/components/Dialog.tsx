import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";
import "./Dialog.css";

/**
 * 모든 대화상자(물품 목록, 삭제 확인, 사진 보기)의 공용 틀.
 *
 * - Esc는 가장 위에 열린 대화상자만 닫는다 (`stack`).
 * - Tab은 대화상자 안에서만 돈다. 닫히면 열기 전의 초점으로 돌아간다.
 * - 대화상자 안에 다른 대화상자를 겹쳐 쓸 때는 부모의 자식으로 넣지 말고
 *   형제로 렌더한다. 그래야 키·초점 처리가 서로 섞이지 않는다.
 */

/** 열려 있는 대화상자들. 마지막이 맨 위. */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  title: string;
  /** 제목 아래 한 줄(개수 등). */
  note?: string;
  /** 대화상자 폭(px). 화면이 좁으면 화면 폭에 맞춘다. */
  width?: number;
  /** × 버튼, 배경 클릭, Esc로 닫을 때. */
  onClose: () => void;
  /** Esc만 다르게 처리해야 할 때(예: 폼이 열려 있으면 폼만 닫기). */
  onEscape?: () => void;
  /** false이면 배경을 눌러도 닫히지 않는다. 입력 중인 폼을 지키기 위해 쓴다. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
  /** 오른쪽 아래 버튼들. 취소 → 주 동작 순서. */
  footer?: ReactNode;
}

export function Dialog({
  title,
  note,
  width = 600,
  onClose,
  onEscape,
  closeOnBackdrop = true,
  children,
  footer,
}: DialogProps) {
  const titleId = useId();
  const dlgRef = useRef<HTMLDivElement>(null);

  // 이벤트 리스너는 한 번만 달고, 최신 콜백은 ref로 읽는다.
  const closeRef = useRef(onClose);
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    closeRef.current = onClose;
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    const token = Symbol("dialog");
    const opener = document.activeElement as HTMLElement | null;
    stack.push(token);

    const dlg = dlgRef.current;
    // 안에 autoFocus 입력칸이 이미 있으면 그대로 둔다.
    if (dlg && !dlg.contains(document.activeElement)) dlg.focus();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;

      if (e.key === "Escape") {
        e.preventDefault();
        (escapeRef.current ?? closeRef.current)();
        return;
      }
      if (e.key !== "Tab" || !dlg) return;

      const items = Array.from(
        dlg.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        dlg.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!active || !dlg.contains(active)) {
        // 초점이 대화상자 밖으로 빠진 경우(안의 폼이 닫혀 사라지는 등): 안으로 되돌린다.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === dlg)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="dlg-root">
      <div
        className="dlg-bg"
        aria-hidden="true"
        onClick={closeOnBackdrop ? () => closeRef.current() : undefined}
      />
      <div
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dlgRef}
        style={{ "--dlg-w": `${width}px` } as CSSProperties}
      >
        <div className="dlg-h">
          <div className="dlg-t">
            <h2 id={titleId}>{title}</h2>
            {note ? <p className="dlg-note">{note}</p> : null}
          </div>
          <button
            type="button"
            className="ibtn"
            aria-label="닫기"
            onClick={() => closeRef.current()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="dlg-b">{children}</div>
        {footer ? <div className="dlg-f">{footer}</div> : null}
      </div>
    </div>
  );
}
