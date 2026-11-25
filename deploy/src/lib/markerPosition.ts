import type { Location, UUID } from "../types/db";
import {
  CANVAS_H,
  CANVAS_W,
  MARKER_HEIGHT,
  MARKER_MIN_HEIGHT,
  MARKER_MIN_WIDTH,
  MARKER_NUDGE,
  MARKER_NUDGE_LARGE,
  MARKER_WIDTH,
} from "./constants";

/**
 * 마커 위치 편집용 순수 함수.
 * 모든 좌표는 1060×740 가상 캔버스 기준의 정수 픽셀이다.
 */

export interface MarkerPoint {
  x: number;
  y: number;
}

export interface MarkerChange extends MarkerPoint {
  id: UUID;
}

/** 화면에 그려진 캔버스 영역(레이어)의 위치와 폭. DOMRect의 일부만 쓴다. */
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
}

/** 좌표를 정수로 반올림하고 캔버스 안(0..1060, 0..740)으로 가둔다. */
export function clampPoint(p: MarkerPoint): MarkerPoint {
  return {
    x: Math.min(CANVAS_W, Math.max(0, Math.round(p.x))),
    y: Math.min(CANVAS_H, Math.max(0, Math.round(p.y))),
  };
}

/** 화면 좌표(clientX/Y)를 가두지 않은 캔버스 좌표로 바꾼다. */
function toCanvas(client: MarkerPoint, rect: CanvasRect): MarkerPoint {
  // 폭이 0이면 나눗셈이 깨지므로 1px로 본다. 마커는 폭이 측정된 뒤에만 그려진다.
  const scale = Math.max(rect.width, 1) / CANVAS_W;
  return {
    x: (client.x - rect.left) / scale,
    y: (client.y - rect.top) / scale,
  };
}

/**
 * 끌기를 시작할 때 포인터가 마커 중심에서 얼마나 떨어져 있는지.
 * 마커 가장자리를 잡아도 마커가 포인터 쪽으로 튀지 않게 한다.
 */
export function grabOffset(
  client: MarkerPoint,
  rect: CanvasRect,
  marker: MarkerPoint,
): MarkerPoint {
  const p = toCanvas(client, rect);
  return { x: p.x - marker.x, y: p.y - marker.y };
}

/** 끄는 중인 포인터가 가리키는 마커의 새 좌표. */
export function pointerToCanvas(
  client: MarkerPoint,
  rect: CanvasRect,
  grab: MarkerPoint = { x: 0, y: 0 },
): MarkerPoint {
  const p = toCanvas(client, rect);
  return clampPoint({ x: p.x - grab.x, y: p.y - grab.y });
}

const ARROW_DIRECTIONS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * 방향키로 마커를 옮긴다. 방향키가 아니면 null.
 * large=true(Shift)이면 10칸, 아니면 1칸.
 */
export function nudgePoint(
  p: MarkerPoint,
  key: string,
  large: boolean,
): MarkerPoint | null {
  const dir = ARROW_DIRECTIONS[key];
  if (!dir) return null;
  const step = large ? MARKER_NUDGE_LARGE : MARKER_NUDGE;
  return clampPoint({ x: p.x + dir[0] * step, y: p.y + dir[1] * step });
}

/** 초안(draft) 중 실제 DB 값과 달라진 마커만 골라낸다. */
export function changedMarkers(
  locations: Location[],
  draft: Record<UUID, MarkerPoint>,
): MarkerChange[] {
  const out: MarkerChange[] = [];
  for (const loc of locations) {
    const d = draft[loc.id];
    if (d && (d.x !== loc.x_pos || d.y !== loc.y_pos)) {
      out.push({ id: loc.id, x: d.x, y: d.y });
    }
  }
  return out;
}

// ---------------------------------------------------------------- 화면 배치

/** 화면에 그려진 마커 상자(px). 중심이 (left, top)이다. */
export interface MarkerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 캔버스 좌표를 화면 상자로 바꾼다. scale = 캔버스 폭(px) / 1060.
 * 마커는 도면과 같은 비율로 줄지만 휴대폰에서 너무 작아지지 않게 최소 크기가 있다.
 */
export function markerBox(p: MarkerPoint, scale: number): MarkerBox {
  return {
    left: Math.round(p.x * scale),
    top: Math.round(p.y * scale),
    width: Math.max(MARKER_MIN_WIDTH, Math.round(MARKER_WIDTH * scale)),
    height: Math.max(MARKER_MIN_HEIGHT, Math.round(MARKER_HEIGHT * scale)),
  };
}

/** 이름표가 대략 차지하는 폭(px). 겹침 계산과 가장자리 보정에만 쓴다. */
export function labelWidth(name: string): number {
  return name.length * 13 + 18;
}

export type LabelSide = "above" | "below";

export interface LabelAnchor {
  id: UUID;
  /** 마커 상자(markerBox)의 중심 좌표와 높이. */
  left: number;
  top: number;
  pinHeight: number;
  labelWidth: number;
}

const LABEL_HEIGHT = 22;
const LABEL_GAP = 8;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function labelRect(a: LabelAnchor, side: LabelSide): Rect {
  const half = a.labelWidth / 2;
  const top =
    side === "above"
      ? a.top - a.pinHeight / 2 - LABEL_GAP - LABEL_HEIGHT
      : a.top + a.pinHeight / 2 + LABEL_GAP;
  return { left: a.left - half, right: a.left + half, top, bottom: top + LABEL_HEIGHT };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * 마커마다 이름표를 위/아래 어느 쪽에 둘지 정한다.
 * 위쪽부터 차례로 보면서, 위에 두면 이미 놓인 이름표와 겹치거나 도면 밖으로 나가면
 * 아래에 둔다. 둘 다 겹치면 위(도면 안이면)에 둔다. 겹침을 완전히 없애지는 못한다.
 */
export function planLabelSides(anchors: LabelAnchor[]): Record<UUID, LabelSide> {
  const placed: Rect[] = [];
  const out: Record<UUID, LabelSide> = {};
  const order = [...anchors].sort((a, b) => a.top - b.top || a.left - b.left);
  for (const a of order) {
    const above = labelRect(a, "above");
    const below = labelRect(a, "below");
    const aboveFree = above.top >= 0 && !placed.some((r) => overlaps(r, above));
    const belowFree = !placed.some((r) => overlaps(r, below));
    const side: LabelSide = aboveFree
      ? "above"
      : belowFree
        ? "below"
        : above.top >= 0
          ? "above"
          : "below";
    out[a.id] = side;
    placed.push(side === "above" ? above : below);
  }
  return out;
}
