import { useEffect, useState } from "react";
import { TABLES } from "../lib/constants";
import { supabase } from "../lib/supabase";
import type { Location } from "../types/db";

export interface UseLocationsResult {
  data: Location[];
  loading: boolean;
  error: Error | null;
}

/**
 * Application 마운트 시 `fmt_locations`를 1회 조회한다 (요구 1.3).
 *
 * - 성공 시: data에 모든 Location 채움, error null
 * - 실패 시: data 빈 배열, error 설정 (호출부가 "위치 정보를 불러오지 못했습니다" 표시)
 * - Strict Mode에서 effect가 두 번 실행돼도 cleanup의 cancelled 플래그로 stale setState 누수 방지
 */
export function useLocations(): UseLocationsResult {
  const [data, setData] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: rows, error: queryError } = await supabase
          .from(TABLES.locations)
          .select("id, name, x_pos, y_pos");

        if (cancelled) return;

        if (queryError) {
          setError(new Error(queryError.message));
          setData([]);
        } else {
          setData((rows ?? []) as Location[]);
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
  }, []);

  return { data, loading, error };
}
