import { describe, expect, it } from "vitest";
import {
  changedMarkers,
  clampPoint,
  grabOffset,
  labelWidth,
  markerBox,
  nudgePoint,
  planLabelSides,
  pointerToCanvas,
} from "../markerPosition";
import type { Location } from "../../types/db";

/**
 * 마커 위치 편집 순수 함수. 1060×740 캔버스를 폭 530px(비율 0.5)로 그린 경우를
 * 기준으로 화면 좌표 ↔ 캔버스 좌표 변환을 확인한다.
 */

const rect = { left: 100, top: 50, width: 530 };

describe("clampPoint", () => {
  it("정수로 반올림한다", () => {
    expect(clampPoint({ x: 10.4, y: 20.6 })).toEqual({ x: 10, y: 21 });
  });

  it("캔버스(0..1060, 0..740) 밖으로 나가지 않게 가둔다", () => {
    expect(clampPoint({ x: -5, y: 900 })).toEqual({ x: 0, y: 740 });
    expect(clampPoint({ x: 2000, y: -1 })).toEqual({ x: 1060, y: 0 });
  });
});

describe("pointerToCanvas", () => {
  it("화면 좌표를 캔버스 좌표로 바꾼다 (폭 530 = 비율 0.5)", () => {
    // 레이어 왼쪽 위에서 오른쪽으로 100px, 아래로 50px → 캔버스 (200, 100)
    expect(pointerToCanvas({ x: 200, y: 100 }, rect)).toEqual({ x: 200, y: 100 });
  });

  it("레이어 밖으로 끌어도 가장자리에 멈춘다", () => {
    expect(pointerToCanvas({ x: 0, y: 0 }, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToCanvas({ x: 5000, y: 5000 }, rect)).toEqual({
      x: 1060,
      y: 740,
    });
  });

  it("잡은 지점의 차이(grab)를 유지해 마커가 포인터로 튀지 않는다", () => {
    // 화면 (220, 105)는 캔버스 (240, 110)이다. 마커 중심 (200, 100)에서 (+40, +10) 떨어진 지점을 잡았다.
    const grab = grabOffset({ x: 220, y: 105 }, rect, { x: 200, y: 100 });
    expect(grab).toEqual({ x: 40, y: 10 });
    // 포인터가 같은 자리(220, 105)에 있으면 마커는 그대로여야 한다.
    expect(pointerToCanvas({ x: 220, y: 105 }, rect, grab)).toEqual({
      x: 200,
      y: 100,
    });
    // 포인터가 오른쪽으로 10px(캔버스 20) 가면 마커도 캔버스 20 간다.
    expect(pointerToCanvas({ x: 230, y: 105 }, rect, grab)).toEqual({
      x: 220,
      y: 100,
    });
  });

  it("폭이 0이어도 NaN을 만들지 않는다", () => {
    const p = pointerToCanvas({ x: 10, y: 10 }, { left: 0, top: 0, width: 0 });
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe("nudgePoint", () => {
  it("방향키는 1칸, Shift는 10칸 옮긴다", () => {
    expect(nudgePoint({ x: 100, y: 100 }, "ArrowRight", false)).toEqual({ x: 101, y: 100 });
    expect(nudgePoint({ x: 100, y: 100 }, "ArrowUp", true)).toEqual({ x: 100, y: 90 });
  });

  it("가장자리를 넘지 않는다", () => {
    expect(nudgePoint({ x: 0, y: 0 }, "ArrowLeft", true)).toEqual({ x: 0, y: 0 });
    expect(nudgePoint({ x: 1060, y: 740 }, "ArrowDown", true)).toEqual({ x: 1060, y: 740 });
  });

  it("방향키가 아니면 null", () => {
    expect(nudgePoint({ x: 1, y: 1 }, "a", false)).toBeNull();
  });
});

describe("changedMarkers", () => {
  const locs: Location[] = [
    { id: "a", name: "A", x_pos: 10, y_pos: 20 },
    { id: "b", name: "B", x_pos: 30, y_pos: 40 },
    { id: "c", name: "C", x_pos: 50, y_pos: 60 },
  ];

  it("초안이 DB 값과 다른 마커만 돌려준다", () => {
    const out = changedMarkers(locs, {
      a: { x: 10, y: 20 }, // 같음: 제외
      b: { x: 31, y: 40 }, // 다름
    });
    expect(out).toEqual([{ id: "b", x: 31, y: 40 }]);
  });

  it("초안이 없으면 빈 배열", () => {
    expect(changedMarkers(locs, {})).toEqual([]);
  });

  it("끌었다가 원래 자리로 돌려놓으면 변경으로 세지 않는다", () => {
    expect(changedMarkers(locs, { c: { x: 50, y: 60 } })).toEqual([]);
  });
});

describe("markerBox", () => {
  it("도면 비율대로 위치와 크기를 정한다 (원본 크기 24×36)", () => {
    expect(markerBox({ x: 530, y: 370 }, 1)).toEqual({ left: 530, top: 370, width: 24, height: 36 });
    expect(markerBox({ x: 530, y: 370 }, 0.5)).toEqual({ left: 265, top: 185, width: 18, height: 27 });
  });

  it("작은 화면에서도 최소 크기(18×27) 아래로 줄지 않는다", () => {
    const b = markerBox({ x: 100, y: 100 }, 0.3);
    expect(b.width).toBe(18);
    expect(b.height).toBe(27);
  });
});

describe("planLabelSides", () => {
  const anchor = (id: string, left: number, top: number, name = "수납장 A") => ({
    id,
    left,
    top,
    pinHeight: 36,
    labelWidth: labelWidth(name),
  });

  it("떨어져 있으면 모두 위에 둔다", () => {
    const out = planLabelSides([anchor("a", 200, 200), anchor("b", 600, 200)]);
    expect(out).toEqual({ a: "above", b: "above" });
  });

  it("가까이 붙은 두 번째 이름표는 아래로 내려 겹치지 않게 한다", () => {
    // 같은 높이에서 30px 간격: 이름표 폭(약 100px)이 겹친다.
    const out = planLabelSides([anchor("a", 200, 200), anchor("b", 230, 200)]);
    expect(out.a).toBe("above");
    expect(out.b).toBe("below");
  });

  it("도면 위쪽 가장자리에서는 위에 둘 수 없어 아래에 둔다", () => {
    const out = planLabelSides([anchor("a", 200, 20)]);
    expect(out.a).toBe("below");
  });
});
