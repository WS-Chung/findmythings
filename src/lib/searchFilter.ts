import type { Item } from "../types/db";

/**
 * 클라이언트 측 검색 필터 (요구 7.3 / Property 13).
 *
 * 조건: item.name ILIKE %q% OR EXISTS tag in item.hashtags: tag ILIKE %q%
 * 즉 대소문자 무시 부분일치를 name 또는 hashtags 어느 한 쪽에서라도 만족.
 *
 * q가 빈 문자열이면 빈 배열 반환 (요구 7.6).
 */
export function filterItems(items: Item[], q: string): Item[] {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) return [];
  return items.filter((i) => {
    if (i.name.toLowerCase().includes(needle)) return true;
    for (const t of i.hashtags) {
      if (t.toLowerCase().includes(needle)) return true;
    }
    return false;
  });
}
