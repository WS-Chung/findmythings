import type { ReactNode } from "react";
import "./Layout.css";

export interface LayoutProps {
  children: ReactNode;
}

/**
 * 회색 틀 + 흰 시트 셸.
 *   - 상단 막대(48px, 회색 틀): 제품 표시와 이름. 스크롤해도 위에 붙어 있다.
 *   - 흰 시트(모서리 16px, 1px 테두리): 화면 내용.
 * 화면이 하나뿐이라 사이드바는 두지 않는다.
 * 휴대폰(640px 이하)에서는 틀이 사라지고 시트가 화면 전체가 된다.
 */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path
                d="M8 14.2s4.6-4.3 4.6-7.6a4.6 4.6 0 0 0-9.2 0c0 3.3 4.6 7.6 4.6 7.6z"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinejoin="round"
                fill="none"
              />
              <circle cx="8" cy="6.6" r="1.5" fill="#fff" />
            </svg>
          </span>
          <span>
            <span className="nm">Find My Things</span>
            <span className="sb">집 안 물건 위치 찾기</span>
          </span>
        </div>
      </header>
      <main className="main">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}
