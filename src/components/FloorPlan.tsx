import { useEffect, useRef, useState, type ReactNode } from "react";
import "./FloorPlan.css";

export interface FloorPlanProps {
  /**
   * Render prop. wrapperWidth(px)는 ResizeObserver로 측정된 캔버스 폭.
   * 초기 렌더 시 0이 전달되며, 측정이 끝나면 양수로 갱신된다.
   * 0일 때 마커는 자체적으로 렌더를 생략한다.
   */
  children: (wrapperWidth: number) => ReactNode;
  /**
   * true이면 배경 도면(background.png)을 어둡고 흐리게(`opacity: 0.25 + blur(2px)`)
   * 처리하여 강조 중인 마커의 펄스 애니메이션이 더 두드러져 보이게 한다.
   * 마커 자체에는 영향을 주지 않는다.
   */
  dimmed?: boolean;
}

/**
 * 1060:740 종횡비를 유지하는 평면도 캔버스 래퍼.
 *
 * 동작:
 *   - `aspect-ratio: 1060 / 740`로 폭에 비례하는 높이 자동 계산
 *   - 마운트 시 ResizeObserver로 wrapper 폭을 측정 → state로 노출
 *   - 부모 폭이 변하면 ResizeObserver 콜백이 fire되어 마커 좌표가 실시간 재계산
 *   - unmount 시 observer.disconnect()로 정리
 *   - `dimmed`이 truthy면 `.floorplan--dimmed` 클래스 부착 → 배경만 어두워진다
 */
export function FloorPlan({ children, dimmed = false }: FloorPlanProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperWidth, setWrapperWidth] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // 초기 측정 (ResizeObserver는 다음 tick에 fire되므로 안전망)
    setWrapperWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWrapperWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const className = dimmed ? "floorplan floorplan--dimmed" : "floorplan";

  return (
    <div className={className} ref={wrapperRef}>
      <div className="floorplan__bg" aria-hidden="true" />
      <div className="floorplan__layer">{children(wrapperWidth)}</div>
    </div>
  );
}
