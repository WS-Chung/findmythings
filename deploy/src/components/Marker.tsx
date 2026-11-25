import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { CANVAS_W } from "../lib/constants";
import {
  grabOffset,
  labelWidth,
  markerBox,
  nudgePoint,
  pointerToCanvas,
  type LabelSide,
  type MarkerPoint,
} from "../lib/markerPosition";
import type { Location, UUID } from "../types/db";
import "./Marker.css";

export interface MarkerProps {
  location: Location;
  /** 지금 그릴 위치. 수정 중에는 아직 저장하지 않은 초안 위치다. */
  position: MarkerPoint;
  /** FloorPlan의 ResizeObserver가 측정한 캔버스 폭(px). 0이면 렌더 생략. */
  wrapperWidth: number;
  /** 검색 결과로 강조된 마커: 고정 링 + 이름표 + 짧은 확산 효과. */
  highlighted?: boolean;
  /** 마커 수정 모드: 끌거나 방향키로 옮긴다. 이때는 누르기(열기)가 동작하지 않는다. */
  editing?: boolean;
  /** 마커 수정 모드에서 선택된 마커(삭제 대상). 네이비 테두리와 이름표로 표시한다. */
  selected?: boolean;
  /** 다른 수납장의 물품 표가 열려 있는 동안 이 마커를 50% 투명도로 흐리게 한다. */
  faded?: boolean;
  /** 이름표를 보일지. 강조 중이거나 수정 모드에서 부모가 정한다. */
  showLabel?: boolean;
  /** 이름표를 위/아래 중 어디에 둘지. 없으면 도면 위쪽 가장자리일 때만 아래로 내린다. */
  labelSide?: LabelSide;
  /** 보통 모드에서 마커를 눌렀을 때. */
  onClick?: (locationId: UUID) => void;
  /** 마커 수정 모드에서 새 좌표가 정해질 때. */
  onMove?: (locationId: UUID, point: MarkerPoint) => void;
  /** 마커 수정 모드에서 마커를 잡거나 초점을 받았을 때(선택하고 이름표를 보이기 위해). */
  onActivate?: (locationId: UUID) => void;
}

/**
 * 평면도 위의 단일 마커.
 *
 * 좌표 + 크기 변환은 lib/markerPosition의 markerBox가 한다. 누르는 영역은
 * CSS(::before)로 40px 이상 넓혀 휴대폰에서도 누를 수 있다.
 *
 * 강조(검색 결과): 무한 반복 펄스는 쓰지 않는다. 고정 링과 이름표로 위치를 보이고,
 * 확산 효과는 3번만 재생한다. (`prefers-reduced-motion`에서는 효과 없음)
 *
 * 수정 모드: 포인터를 잡고 끄는 동안 onMove로 좌표를 올린다. 마커를 잡은 지점과
 * 마커 중심의 차이(grab)를 유지해 마커가 포인터 쪽으로 튀지 않는다.
 * 잡거나 초점을 받으면 onActivate로 "선택"되어 삭제 대상이 된다.
 * 키보드: 방향키 1칸, Shift+방향키 10칸.
 */
export function Marker({
  location,
  position,
  wrapperWidth,
  highlighted = false,
  editing = false,
  selected = false,
  faded = false,
  showLabel = false,
  labelSide,
  onClick,
  onMove,
  onActivate,
}: MarkerProps) {
  const drag = useRef<{ grab: MarkerPoint } | null>(null);
  const [dragging, setDragging] = useState(false);

  if (wrapperWidth <= 0) return null;

  const box = markerBox(position, wrapperWidth / CANVAS_W);

  // 이름표 위치: 지정이 없으면 위쪽 가장자리 근처일 때만 아래. 좌우 가장자리 근처면 안쪽으로 민다.
  const side: LabelSide =
    labelSide ?? (box.top < box.height / 2 + 36 ? "below" : "above");
  const half = labelWidth(location.name) / 2;
  const shift =
    Math.max(0, half + 4 - box.left) -
    Math.max(0, box.left + half + 4 - wrapperWidth);

  const layerRect = (el: HTMLElement) =>
    (el.parentElement as HTMLElement).getBoundingClientRect();

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!editing || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      grab: grabOffset(
        { x: e.clientX, y: e.clientY },
        layerRect(e.currentTarget),
        position,
      ),
    };
    setDragging(true);
    onActivate?.(location.id);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!editing || !drag.current) return;
    onMove?.(
      location.id,
      pointerToCanvas(
        { x: e.clientX, y: e.clientY },
        layerRect(e.currentTarget),
        drag.current.grab,
      ),
    );
  };

  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
    setDragging(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!editing) return;
    const next = nudgePoint(position, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    onMove?.(location.id, next);
  };

  const handleClick = () => {
    if (editing) return;
    onClick?.(location.id);
  };

  const className = [
    "marker",
    highlighted ? "marker--highlight" : "",
    editing ? "marker--editing" : "",
    editing && selected ? "marker--selected" : "",
    faded ? "marker--faded" : "",
    editing && dragging ? "marker--dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = {
    left: box.left,
    top: box.top,
    "--pin-w": `${box.width}px`,
    "--pin-h": `${box.height}px`,
    "--label-shift": `${shift}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onFocus={editing ? () => onActivate?.(location.id) : undefined}
      aria-label={
        editing ? `${location.name} 마커 선택·위치 옮기기` : location.name
      }
      aria-pressed={editing ? selected : undefined}
    >
      {highlighted ? (
        <>
          <span className="marker__ring" aria-hidden="true" />
          <span className="marker__ping" aria-hidden="true" />
        </>
      ) : null}
      <img
        className="marker__img"
        src="/marker.png"
        alt=""
        draggable={false}
      />
      {showLabel ? (
        <span
          className={
            side === "below" ? "marker__label marker__label--below" : "marker__label"
          }
        >
          {location.name}
        </span>
      ) : null}
    </button>
  );
}
