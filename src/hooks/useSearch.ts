import { useMemo } from "react";
import { DEBOUNCE_MS } from "../lib/constants";
import { filterItems } from "../lib/searchFilter";
import type { Item } from "../types/db";
import { useDebounce } from "./useDebounce";

export interface UseSearchResult {
  data: Item[];
  /** 0자이면 false. UI는 이것으로 결과 리스트 숨김 여부를 결정. */
  active: boolean;
}

/**
 * 메모리 캐시된 items 위에서 디바운스된 검색을 수행한다.
 *   - query는 controlled input의 현재 값
 *   - DEBOUNCE_MS(200ms) 후 filterItems(items, debouncedQuery)
 *   - q가 0자이면 빈 결과 + active=false
 *   - RPC 호출 없음. error 상태 없음 (메모리 작업은 실패하지 않음).
 */
export function useSearch(query: string, items: Item[]): UseSearchResult {
  const debounced = useDebounce(query, DEBOUNCE_MS);
  const data = useMemo(() => filterItems(items, debounced), [items, debounced]);
  return { data, active: debounced.trim().length > 0 };
}
