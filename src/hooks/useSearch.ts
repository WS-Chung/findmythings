import { useEffect, useState } from "react";
import { RPC } from "../lib/constants";
import { supabase } from "../lib/supabase";
import type { Item } from "../types/db";

export interface UseSearchResult {
  data: Item[];
  loading: boolean;
  error: Error | null;
}

/**
 * 디바운스된 query 문자열을 받아 `fmt_search_items` RPC를 호출한다
 * (요구 7.2/7.3/7.5/7.6).
 *
 * - 호출자는 useDebounce로 query 변동을 200ms ±50ms 안정화한 뒤 전달한다.
 *   useSearch는 query가 바뀔 때마다 즉시 RPC를 부른다 (한 번 더 디바운스하지 않는다).
 * - q.trim().length === 0이면 RPC를 호출하지 않고 빈 결과를 반환한다 (요구 7.6).
 *   "   " 같은 공백 입력도 0자와 동등하게 취급된다.
 * - unmount 또는 query 변경 시 cancelled 플래그로 stale setState 누수를 방지한다.
 * - RPC 실패 시 data는 빈 배열, error에 메시지 노출 → 호출자가 "검색 중 오류가
 *   발생했습니다" 텍스트를 보여준다.
 *
 * RPC 시그니처: `public.fmt_search_items(q text) → setof public.fmt_items`
 *   부분일치(case-insensitive): name ILIKE %q% ∨ ∃t ∈ hashtags: t ILIKE %q%.
 */
export function useSearch(query: string): UseSearchResult {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: rows, error: rpcErr } = await supabase.rpc(
          RPC.searchItems,
          { q },
        );
        if (cancelled) return;

        if (rpcErr) {
          setError(new Error(rpcErr.message));
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
  }, [query]);

  return { data, loading, error };
}
