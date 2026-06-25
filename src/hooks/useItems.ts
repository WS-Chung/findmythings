import { useCallback, useEffect, useState } from "react";
import { TABLES } from "../lib/constants";
import { supabase } from "../lib/supabase";
import type { Item, UUID } from "../types/db";

export interface UseItemsResult {
  data: Item[];
  loading: boolean;
  error: Error | null;
  /** trigger 토글로 useEffect를 다시 실행시킨다. */
  refetch: () => void;
}

/**
 * 선택된 Location의 모든 Item을 조회한다 (요구 2.1, 2.2).
 *
 * - locationId가 null이면 fetch를 수행하지 않고 빈 배열을 반환한다.
 *   ItemPopup이 마운트되지 않은 상태(=어떤 마커도 선택되지 않음)에 해당.
 * - locationId가 바뀌거나 refetch()가 호출되면 자동으로 재조회한다.
 * - 정렬은 parent_id NULLS FIRST → created_at ASC.
 *   파셰스/자식 트리화는 client-side helper(buildItemTree)에서 수행한다.
 * - unmount 또는 locationId 변경 시 cancelled 플래그로 stale setState 방지.
 */
export function useItems(locationId: UUID | null): UseItemsResult {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (locationId === null) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: rows, error: queryError } = await supabase
          .from(TABLES.items)
          .select("*")
          .eq("location_id", locationId)
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
  }, [locationId, refetchTrigger]);

  return { data, loading, error, refetch };
}
