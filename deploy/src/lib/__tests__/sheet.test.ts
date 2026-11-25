import { describe, expect, it } from "vitest";
import { cellAddress, columnLetter, formatDate } from "../sheet";

describe("columnLetter", () => {
  it("엑셀 열 문자: A..Z, AA..", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(27)).toBe("AB");
    expect(columnLetter(51)).toBe("AZ");
    expect(columnLetter(52)).toBe("BA");
  });
});

describe("cellAddress", () => {
  it("1행은 머리글이라 첫 데이터 행이 2행", () => {
    expect(cellAddress(0, 0)).toBe("A2");
    expect(cellAddress(4, 2)).toBe("C6");
  });
});

describe("formatDate", () => {
  it("사용자 시간대 기준 YYYY-MM-DD", () => {
    // 현지 시각 정오로 만들면 어느 시간대에서도 같은 날짜가 나온다.
    const iso = new Date(2026, 10, 24, 12, 0, 0).toISOString();
    expect(formatDate(iso)).toBe("2026-11-24");
  });

  it("월·일은 두 자리로 맞춘다", () => {
    expect(formatDate(new Date(2026, 0, 5, 12).toISOString())).toBe("2026-01-05");
  });

  it("잘못된 값은 빈 문자열", () => {
    expect(formatDate("not-a-date")).toBe("");
  });
});
