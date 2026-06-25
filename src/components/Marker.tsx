import type { CSSProperties } from "react";
import { CANVAS_W, MARKER_HEIGHT, MARKER_WIDTH } from "../lib/constants";
import type { Location, UUID } from "../types/db";
import "./Marker.css";

export interface MarkerProps {
  location: Location;
  /** FloorPlan의 ResizeObserver가 측정한 캔버스 폭(px). 0이면 렌더 생략. */
  wrapperWidth: number;
  /** true이면 `marker--highlight` 클래스 부여 (펄스 애니메이션). Task 9.6에서 wire됨. */
  highlighted?: boolean;
  /** 클릭 핸들러. 전달되면 cursor: pointer + role=button. */
  onClick?: (locationId: UUID) => void;
}

/**
 * 평면도 위의 단일 마커.
 *
 * 좌표 + 크기 변환 (요구 13.3):
 *   scale     = wrapperWidth / 1060
 *   left(px)  = round(x_pos * scale)   // 중심 좌표
 *   top(px)   = round(y_pos * scale)
 *   width     = round(MARKER_WIDTH  * scale)
 *   height    = round(MARKER_HEIGHT * scale)
 *
 * 마커는 풀 스케일에서 32×48 픽셀(세로로 긴 핀)이고, 도면이 줄면 같은 비율로 줄어든다.
 * `translate(-50%, -50%)`로 중심이 (x_pos, y_pos)에 오도록 배치한다.
 *
 * wrapperWidth가 0 이하이면 초기 mount 직후 ResizeObserver 측정 전이므로
 * 렌더를 생략해 잘못된 위치에 잠깐 튀는 것을 방지한다.
 */
export function Marker({
  location,
  wrapperWidth,
  highlighted = false,
  onClick,
}: MarkerProps) {
  if (wrapperWidth <= 0) return null;

  const scale = wrapperWidth / CANVAS_W;
  const left = Math.round(location.x_pos * scale);
  const top = Math.round(location.y_pos * scale);
  // 마커 자체도 도면과 같은 비율로 축소된다 (최소 1px 보장).
  const width = Math.max(1, Math.round(MARKER_WIDTH * scale));
  const height = Math.max(1, Math.round(MARKER_HEIGHT * scale));

  const className = highlighted ? "marker marker--highlight" : "marker";

  const style: CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    transform: "translate(-50%, -50%)",
    cursor: onClick ? "pointer" : "default",
    userSelect: "none",
  };

  const handleClick = onClick ? () => onClick(location.id) : undefined;

  return (
    <div
      className={className}
      style={style}
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      aria-label={location.name}
    >
      <img
        className="marker__img"
        src="/marker.png"
        alt={location.name}
        draggable={false}
      />
    </div>
  );
}
