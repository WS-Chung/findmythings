import { useMemo } from "react";
import { DEBOUNCE_MS } from "../lib/constants";
import { filterItems } from "../lib/searchFilter";
import type { Item } from "../types/db";
import { useDebounce } from "./useDebounce";

export interface UseSearchResult {
  /**
   * 검색어가 있으면 일치 결과, 없으면 전체 items(가나다 정렬).
   * 항상 비-undefined.
   */
  data: Item[];
  /** 사용자가 실제로 검색어를 입력한 상태 (debounced.trim().length > 0). */
  hasQuery: boolean;
}

/**
 * 메모리 캐시된 items 위에서 디바운스된 검색을 수행한다.
 *   - query는 controlled input의 현재 값
 *   - DEBOUNCE_MS(200ms) 후
 *       · 입력값이 있으면 filterItems(items, debouncedQuery)
 *       · 입력값이 0자이면 모든 items를 name 기준 가나다(`localeCompare ko`) 정렬해 반환
 *   - RPC 호출 없음. error 상태 없음 (메모리 작업은 실패하지 않음).
 */
export function useSearch(query: string, items: Item[]): UseSearchResult {
  const debounced = useDebounce(query, DEBOUNCE_MS);
  const trimmed = debounced.trim();
  const hasQuery = trimmed.length > 0;

  const data = useMemo(() => {
    if (!hasQuery) {
      // 검색어가 없을 때: 전체 items를 가나다 순으로 노출 (스크롤 가능).
      return [...items].sort((a, b) =>
        a.name.localeCompare(b.name, "ko"),
      );
    }
    return filterItems(items, trimmed);
  }, [items, trimmed, hasQuery]);

  return { data, hasQuery };
}
