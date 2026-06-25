import type { ReactNode } from "react";
import "./Layout.css";

export interface LayoutProps {
  children: ReactNode;
}

/**
 * 컨텐츠 영역(80vw)을 가로 중앙 정렬하고
 * 좌측 검색 패널(15fr) + 가운데 시각 gap(5fr) + 우측 평면도 패널(80fr)로 분할한다.
 * 자식 컴포넌트는 자신의 CSS에서 `grid-column`을 지정해 컬럼을 점유한다.
 */
export function Layout({ children }: LayoutProps) {
  return <div className="layout">{children}</div>;
}
