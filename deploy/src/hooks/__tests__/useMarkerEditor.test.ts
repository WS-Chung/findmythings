import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Location } from "../../types/db";

/**
 * Supabase 호출을 가짜로 바꿔, 마커 추가·위치 저장·삭제의 분기를 확인한다.
 * 실제 DB에는 쓰지 않는다.
 */
const mocks = vi.hoisted(() => ({
  insertSelect: vi.fn(),
  updateSelect: vi.fn(),
  deleteSelect: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => ({ select: () => mocks.insertSelect(payload) }),
      update: (payload: unknown) => ({
        eq: (_col: string, id: string) => ({
          select: () => mocks.updateSelect(payload, id),
        }),
      }),
      delete: () => ({
        eq: (_col: string, id: string) => ({
          select: () => mocks.deleteSelect(id),
        }),
      }),
    }),
  },
}));

import { useMarkerEditor } from "../useMarkerEditor";

const locations: Location[] = [
  { id: "a", name: "거실 수납장", x_pos: 100, y_pos: 100 },
  { id: "b", name: "주방 상부장", x_pos: 300, y_pos: 200 },
];

function setup() {
  const applyPositions = vi.fn();
  const addLocation = vi.fn();
  const removeLocation = vi.fn();
  const hook = renderHook(() =>
    useMarkerEditor(locations, { applyPositions, addLocation, removeLocation }),
  );
  return { ...hook, applyPositions, addLocation, removeLocation };
}

beforeEach(() => {
  mocks.insertSelect.mockReset();
  mocks.updateSelect.mockReset();
  mocks.deleteSelect.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("마커 추가", () => {
  it("추가 모드는 평면도 한가운데(530, 370)에서 시작한다", () => {
    const { result } = setup();
    act(() => result.current.startAdd());
    expect(result.current.mode).toBe("add");
    expect(result.current.newPoint).toEqual({ x: 530, y: 370 });
    expect(result.current.newName).toBe("");
  });

  it("이름과 위치를 한 번의 INSERT로 저장하고, 화면 상태에 추가한 뒤 새 id를 돌려준다", async () => {
    const row = { id: "new-1", name: "안방 옷장", x_pos: 420, y_pos: 150 };
    mocks.insertSelect.mockResolvedValue({ data: [row], error: null });
    const { result, addLocation } = setup();

    act(() => result.current.startAdd());
    act(() => result.current.setNewName("  안방 옷장  "));
    act(() => result.current.moveNew({ x: 420, y: 150 }));

    let id: string | null = null;
    await act(async () => {
      id = await result.current.submitAdd();
    });

    expect(mocks.insertSelect).toHaveBeenCalledTimes(1);
    expect(mocks.insertSelect).toHaveBeenCalledWith({ name: "안방 옷장", x_pos: 420, y_pos: 150 });
    expect(id).toBe("new-1");
    expect(addLocation).toHaveBeenCalledWith(row);
    expect(result.current.adding).toBe(false);
    expect(result.current.mode).toBe("idle");
    expect(result.current.notice).toContain("안방 옷장");
  });

  it("이름이 비었거나 이미 있으면 DB를 부르지 않고 문장으로 알린다", async () => {
    const { result } = setup();
    act(() => result.current.startAdd());

    await act(async () => {
      await result.current.submitAdd();
    });
    expect(result.current.error).toBe("수납장 이름을 입력해 주세요");

    act(() => result.current.setNewName("거실 수납장"));
    expect(result.current.error).toBeNull(); // 고치기 시작하면 오류 문구가 사라진다
    await act(async () => {
      await result.current.submitAdd();
    });
    expect(result.current.error).toBe("같은 이름의 수납장이 이미 있습니다");

    expect(mocks.insertSelect).not.toHaveBeenCalled();
    expect(result.current.adding).toBe(true);
  });

  it("INSERT 정책이 없어 42501이 오면 schema.sql 적용을 안내하고 추가 모드를 유지한다", async () => {
    mocks.insertSelect.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    });
    const { result, addLocation } = setup();
    act(() => result.current.startAdd());
    act(() => result.current.setNewName("새 수납장"));

    let id: string | null = "x";
    await act(async () => {
      id = await result.current.submitAdd();
    });

    expect(id).toBeNull();
    expect(result.current.error).toContain("db/schema.sql");
    expect(result.current.adding).toBe(true);
    expect(addLocation).not.toHaveBeenCalled();
  });

  it("그 밖의 오류는 일반 문장으로 알린다", async () => {
    mocks.insertSelect.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const { result } = setup();
    act(() => result.current.startAdd());
    act(() => result.current.setNewName("새 수납장"));
    await act(async () => {
      await result.current.submitAdd();
    });
    expect(result.current.error).toBe("수납장을 추가하지 못했습니다");
  });

  it("취소하면 아무것도 저장하지 않고 평소 모드로 돌아간다", () => {
    const { result } = setup();
    act(() => result.current.startAdd());
    act(() => result.current.setNewName("버릴 이름"));
    act(() => result.current.cancel());
    expect(result.current.mode).toBe("idle");
    expect(mocks.insertSelect).not.toHaveBeenCalled();
  });

  it("추가와 마커 수정은 동시에 켜지지 않는다", () => {
    const { result } = setup();
    act(() => result.current.start());
    expect(result.current.mode).toBe("edit");
    act(() => result.current.startAdd());
    expect(result.current.mode).toBe("add");
    act(() => result.current.start());
    expect(result.current.mode).toBe("edit");
  });
});

describe("마커 위치 저장", () => {
  it("달라진 마커만 UPDATE하고 결과를 화면 상태에 반영한다", async () => {
    mocks.updateSelect.mockImplementation(async (payload: { x_pos: number; y_pos: number }, id: string) => ({
      data: [{ id, ...payload }],
      error: null,
    }));
    const { result, applyPositions } = setup();
    act(() => result.current.start());
    act(() => result.current.move("a", { x: 110, y: 100 })); // 변경
    act(() => result.current.move("b", { x: 300, y: 200 })); // 제자리: 변경 아님

    await act(async () => {
      await result.current.save();
    });

    expect(mocks.updateSelect).toHaveBeenCalledTimes(1);
    expect(mocks.updateSelect).toHaveBeenCalledWith({ x_pos: 110, y_pos: 100 }, "a");
    expect(applyPositions).toHaveBeenCalledWith([{ id: "a", x_pos: 110, y_pos: 100 }]);
    expect(result.current.editing).toBe(false);
  });

  it("UPDATE 정책이 없어 0행이 돌아오면 성공으로 세지 않고 안내한다", async () => {
    mocks.updateSelect.mockResolvedValue({ data: [], error: null });
    const { result, applyPositions } = setup();
    act(() => result.current.start());
    act(() => result.current.move("a", { x: 110, y: 100 }));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.error).toContain("db/schema.sql");
    expect(result.current.editing).toBe(true); // 초안을 남겨 다시 저장할 수 있다
    expect(result.current.changedCount).toBe(1);
    expect(applyPositions).not.toHaveBeenCalled();
  });
});

describe("마커 삭제", () => {
  it("DELETE 한 번으로 지우고, 화면 상태에서 빼고, 선택과 그 마커의 위치 초안을 비운 채 수정 모드를 유지한다", async () => {
    mocks.deleteSelect.mockResolvedValue({ data: [{ id: "a" }], error: null });
    const { result, removeLocation } = setup();
    act(() => result.current.start());
    act(() => result.current.activate("a"));
    act(() => result.current.move("a", { x: 150, y: 100 }));
    act(() => result.current.move("b", { x: 310, y: 200 }));
    expect(result.current.changedCount).toBe(2);

    let failure: string | null = "x";
    await act(async () => {
      failure = await result.current.deleteLocation("a");
    });

    expect(failure).toBeNull();
    expect(mocks.deleteSelect).toHaveBeenCalledTimes(1);
    expect(mocks.deleteSelect).toHaveBeenCalledWith("a");
    expect(removeLocation).toHaveBeenCalledWith("a");
    expect(result.current.activeId).toBeNull();
    // 지운 마커의 초안은 사라지고, 다른 마커의 초안은 그대로다.
    expect(result.current.changedCount).toBe(1);
    expect(result.current.editing).toBe(true);
    expect(result.current.notice).toContain("거실 수납장");
  });

  it("다른 마커를 선택한 상태에서 지우면 선택은 그대로 둔다", async () => {
    mocks.deleteSelect.mockResolvedValue({ data: [{ id: "a" }], error: null });
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.activate("b"));
    await act(async () => {
      await result.current.deleteLocation("a");
    });
    expect(result.current.activeId).toBe("b");
  });

  it("DELETE 정책이 없어 0행이 지워지면 성공으로 세지 않고 schema.sql 적용을 안내한다", async () => {
    mocks.deleteSelect.mockResolvedValue({ data: [], error: null });
    const { result, removeLocation } = setup();
    act(() => result.current.start());
    act(() => result.current.activate("a"));

    let failure: string | null = null;
    await act(async () => {
      failure = await result.current.deleteLocation("a");
    });

    expect(failure).toContain("db/schema.sql");
    expect(removeLocation).not.toHaveBeenCalled();
    expect(result.current.activeId).toBe("a");
  });

  it("권한 오류(42501)도 schema.sql 적용을 안내한다", async () => {
    mocks.deleteSelect.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied for table fmt_locations" },
    });
    const { result, removeLocation } = setup();
    act(() => result.current.start());

    let failure: string | null = null;
    await act(async () => {
      failure = await result.current.deleteLocation("a");
    });

    expect(failure).toContain("db/schema.sql");
    expect(removeLocation).not.toHaveBeenCalled();
  });

  it("그 밖의 오류는 일반 문장으로 알리고 아무것도 빼지 않는다", async () => {
    mocks.deleteSelect.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const { result, removeLocation } = setup();
    act(() => result.current.start());

    let failure: string | null = null;
    await act(async () => {
      failure = await result.current.deleteLocation("a");
    });

    expect(failure).toBe("수납장을 삭제하지 못했습니다");
    expect(removeLocation).not.toHaveBeenCalled();
  });
});
