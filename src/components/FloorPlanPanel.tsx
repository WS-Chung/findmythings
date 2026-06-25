import type { ReactNode } from "react";
import "./FloorPlanPanel.css";

export interface FloorPlanPanelProps {
  /** locations fetch가 실패하면 마커 대신 안내 텍스트를 표시한다 (요구 1.7). */
  error?: Error | null;
  /** error가 없을 때 렌더할 자식(보통 `<FloorPlan>`). */
  children?: ReactNode;
}

/**
 * 우측 80% 컬럼. error가 있으면 안내 텍스트만 표시하고 children을 렌더하지 않는다.
 * 이렇게 함으로써 App.tsx에서 `!error && <FloorPlan>` 분기를 따로 쓰지 않아도 된다.
 */
export function FloorPlanPanel({ error, children }: FloorPlanPanelProps) {
  return (
    <section className="floorplan-panel" aria-label="평면도">
      {error ? (
        <div className="floorplan-panel__error" role="alert">
          위치 정보를 불러오지 못했습니다
        </div>
      ) : (
        children
      )}
    </section>
  );
}
