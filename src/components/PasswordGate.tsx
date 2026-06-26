import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import "./PasswordGate.css";

/**
 * 페이지 전체 진입 게이트.
 *
 * 정책:
 *   - 1인용 취미 앱이므로 인증 시스템 없이 4자리 숫자 비밀번호 하나로 잠금.
 *   - 비밀번호는 클라이언트에 하드코딩되어 있으며 진짜 보안 장치가 아니라 단순 진입 차단용.
 *   - 일치 전에는 자식(App 전체)을 마운트하지 않으므로 supabase 호출 / 마커 클릭 등
 *     어떤 페이지 조작도 수행되지 않는다.
 *   - 일치 후에는 sessionStorage에 표식을 남겨 같은 탭에서 새로고침해도 다시 묻지 않는다
 *     (탭을 닫으면 다시 입력).
 *   - 재시도 제한은 없다 (사용자 요청).
 */

const STORAGE_KEY = "fmt-auth";
const CORRECT_PASSWORD = "0329";

export interface PasswordGateProps {
  children: ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [authorized, setAuthorized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // 시크릿 모드 등에서 storage 접근 실패해도 메모리 상으로는 통과시킨다.
      }
      setAuthorized(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  if (authorized) return <>{children}</>;

  return (
    <div
      className="password-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-gate-title"
    >
      <form className="password-gate__form" onSubmit={handleSubmit}>
        <h2 id="password-gate-title" className="password-gate__title">
          비밀번호 입력
        </h2>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          autoComplete="off"
          value={input}
          onChange={(e) => {
            // 숫자만 허용. 그 외 입력은 무시.
            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
            setInput(digits);
            if (error) setError(false);
          }}
          className="password-gate__input"
          aria-label="비밀번호"
          aria-invalid={error || undefined}
        />
        {error ? (
          <p className="password-gate__error" role="alert">
            비밀번호가 일치하지 않습니다
          </p>
        ) : null}
        <button
          type="submit"
          className="password-gate__submit"
          disabled={input.length !== 4}
        >
          확인
        </button>
      </form>
    </div>
  );
}
