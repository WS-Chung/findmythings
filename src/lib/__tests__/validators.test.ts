import { describe, expect, it } from "vitest";
import type { Item } from "../../types/db";
import {
  validateHashtags,
  validateName,
  validateParent,
} from "../validators";

/**
 * 단위 테스트 — validators 경계값.
 *
 * Property 6/16의 핵심 분기 1~2개씩만 커버한다 (등록 시퀀스에서 어떤 입력이
 * 차단되는지 명세하기 위한 최소 회귀 방지 목적).
 */

const baseParent: Item = {
  id: "p1",
  location_id: "loc-A",
  name: "부모1",
  hashtags: [],
  image_url: null,
  parent_id: null,
  created_at: "2024-01-01T00:00:00Z",
};

describe("validateName", () => {
  it("0자 입력은 실패", () => {
    const r = validateName("   ");
    expect(r.ok).toBe(false);
  });

  it("1~20자는 통과", () => {
    expect(validateName("a").ok).toBe(true);
    expect(validateName("가".repeat(20)).ok).toBe(true);
  });

  it("21자 이상은 실패", () => {
    expect(validateName("a".repeat(21)).ok).toBe(false);
  });
});

describe("validateHashtags", () => {
  it("4개까지 통과, 5개부터 실패", () => {
    expect(validateHashtags(["a", "b", "c", "d"]).ok).toBe(true);
    expect(validateHashtags(["a", "b", "c", "d", "e"]).ok).toBe(false);
  });

  it("각 원소 21자 이상은 실패", () => {
    expect(validateHashtags(["x".repeat(21)]).ok).toBe(false);
  });

  it("빈 원소는 실패", () => {
    expect(validateHashtags(["valid", "   "]).ok).toBe(false);
  });
});

describe("validateParent", () => {
  it("null은 항상 통과 (Parent_Item으로 등록)", () => {
    expect(validateParent(null, [], "loc-A").ok).toBe(true);
  });

  it("같은 location의 Parent_Item이면 통과", () => {
    expect(validateParent("p1", [baseParent], "loc-A").ok).toBe(true);
  });

  it("다른 location의 부모는 실패", () => {
    expect(validateParent("p1", [baseParent], "loc-B").ok).toBe(false);
  });

  it("Child_Item(parent_id != null)을 부모로 지정하면 실패", () => {
    const child: Item = { ...baseParent, id: "c1", parent_id: "p1" };
    expect(
      validateParent("c1", [baseParent, child], "loc-A").ok,
    ).toBe(false);
  });

  it("존재하지 않는 부모 id는 실패", () => {
    expect(validateParent("ghost", [baseParent], "loc-A").ok).toBe(false);
  });
});
