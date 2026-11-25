import { useCallback, useEffect, useState } from "react";
import { TABLES } from "../lib/constants";
import { supabase } from "../lib/supabase";
import type { Location, LocationPosition } from "../types/db";

export interface UseLocationsResult {
  data: Location[];
  loading: boolean;
  error: Error | null;
  /** 실패 후 "다시 시도"에서 쓴다. */
  refetch: () => void;
  /** 마커 위치를 저장한 뒤, 다시 조회하지 않고 화면 상태에 바로 반영한다. */
  applyPositions: (rows: LocationPosition[]) => void;
  /** 새로 추가한 수납장을 다시 조회하지 않고 화면 상태에 바로 넣는다. */
  addLocation: (row: Location) => void;
  /** 삭제한 수납장을 다시 조회하지 않고 화면 상태에서 바로 뺀다. */
  removeLocation: (id: string) => void;
}

/**
 * Application 마운트 시 `fmt_locations`를 1회 조회한다.
 *
 * - 성공 시: data에 모든 Location 채움, error null
 * - 실패 시: data 빈 배열, error 설정 (호출부가 "위치 정보를 불러오지 못했습니다" 표시)
 * - Strict Mode에서 effect가 두 번 실행돼도 cleanup의 cancelled 플래그로 stale setState 누수 방지
 */
export function useLocations(): UseLocationsResult {
  const [data, setData] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => {
    setLoading(true);
    setTrigger((n) => n + 1);
  }, []);

  const applyPositions = useCallback((rows: LocationPosition[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    setData((prev) =>
      prev.map((loc) => {
        const next = byId.get(loc.id);
        return next ? { ...loc, x_pos: next.x_pos, y_pos: next.y_pos } : loc;
      }),
    );
  }, []);

  const addLocation = useCallback((row: Location) => {
    setData((prev) => (prev.some((l) => l.id === row.id) ? prev : [...prev, row]));
  }, []);

  const removeLocation = useCallback((id: string) => {
    setData((prev) => prev.filter((l) => l.id !== id));
  }, []);

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
  }, [trigger]);

  return {
    data,
    loading,
    error,
    refetch,
    applyPositions,
    addLocation,
    removeLocation,
  };
}
