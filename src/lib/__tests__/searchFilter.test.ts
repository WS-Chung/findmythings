import { describe, expect, it } from "vitest";
import { filterItems } from "../searchFilter";
import type { Item } from "../../types/db";

/**
 * 단위 테스트 — filterItems의 핵심 분기.
 *
 * Property 13(name OR hashtag 부분일치, case-insensitive)과 요구 7.6(0자 → 빈 결과)을
 * 최소 회귀 방지 수준으로 커버한다. 상세 PBT는 tasks 9.4(*) 옵셔널 슬롯에 위임.
 */

const mk = (overrides: Partial<Item>): Item => ({
  id: overrides.id ?? "i",
  location_id: overrides.location_id ?? "loc",
  name: overrides.name ?? "이름",
  hashtags: overrides.hashtags ?? [],
  image_url: overrides.image_url ?? null,
  parent_id: overrides.parent_id ?? null,
  created_at: overrides.created_at ?? "2024-01-01T00:00:00Z",
});

describe("filterItems", () => {
  it("q가 0자(공백 포함)면 빈 배열을 반환한다 (요구 7.6)", () => {
    const items = [mk({ id: "a", name: "드라이버" })];
    expect(filterItems(items, "")).toEqual([]);
    expect(filterItems(items, "   ")).toEqual([]);
  });

  it("name의 부분일치 + 대소문자 무시", () => {
    const items = [
      mk({ id: "a", name: "Drill Bit" }),
      mk({ id: "b", name: "스크류" }),
    ];
    const res = filterItems(items, "drill");
    expect(res.map((i) => i.id)).toEqual(["a"]);
  });

  it("hashtags 중 한 원소만 부분일치해도 통과한다", () => {
    const items = [
      mk({ id: "a", name: "공구함", hashtags: ["DIY", "tool"] }),
      mk({ id: "b", name: "양말", hashtags: ["의류"] }),
    ];
    const res = filterItems(items, "Too");
    expect(res.map((i) => i.id)).toEqual(["a"]);
  });

  it("어디에도 매칭되지 않으면 빈 배열", () => {
    const items = [
      mk({ id: "a", name: "드라이버", hashtags: ["공구"] }),
      mk({ id: "b", name: "양말", hashtags: ["의류"] }),
    ];
    expect(filterItems(items, "노트북")).toEqual([]);
  });
});
