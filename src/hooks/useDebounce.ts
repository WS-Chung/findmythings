import { useEffect, useState } from "react";

/**
 * 임의 값 `value`를 마지막 변경 이후 `ms` 밀리초가 지나면 지연 반환한다 (요구 7.2).
 *
 * - value가 ms 안에 다시 바뀌면 이전 timer는 cleanup으로 clear되고 새 timer가 설정된다.
 * - 마지막 변경 후 정확히 ms 시점에 1회 setDebounced가 호출된다 → 호출자 입장에선
 *   debounced 값 변경 = 검색 트리거.
 * - unmount 시에도 cleanup이 실행되어 stale timer가 setState를 호출하지 않는다.
 *
 * 이 훅은 순수하게 값 변환만 담당한다. 실제 검색 로직(in-memory filter)은 useSearch가 수행한다.
 */
export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}
