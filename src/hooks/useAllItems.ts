import { useCallback, useEffect, useState } from "react";
import { TABLES } from "../lib/constants";
import { supabase } from "../lib/supabase";
import type { Item } from "../types/db";

export interface UseAllItemsResult {
  data: Item[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 앱 시작 시 fmt_items 전체를 1회 fetch한다.
 *   - 모든 위치의 모든 items를 메모리에 보관
 *   - 마커 클릭 / 검색 모두 in-memory filter로 즉시 반응 (네트워크 RTT 제거)
 *   - 등록/수정/삭제 성공 시 refetch()로 일괄 새로고침
 *   - 정렬: parent_id NULLS FIRST → created_at ASC
 *     (이렇게 두면 ItemPopup의 buildItemTree가 안정 순서를 유지)
 */
export function useAllItems(): UseAllItemsResult {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: rows, error: queryError } = await supabase
          .from(TABLES.items)
          .select("*")
          .order("parent_id", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true });

        if (cancelled) return;
        if (queryError) {
          setError(new Error(queryError.message));
          setData([]);
        } else {
          setData((rows ?? []) as Item[]);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refetchTrigger]);

  return { data, loading, error, refetch };
}
