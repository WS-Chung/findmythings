import type { Item, Location, UUID } from "../types/db";
import "./SearchResultList.css";

export interface SearchResultRow {
  item: Item;
  /** location_id에 매칭되는 Location. 시드 정합성이 깨지면 undefined일 수 있다. */
  location: Location | undefined;
}

export interface SearchResultListProps {
  results: SearchResultRow[];
  /** 현재 검색바 입력값. trim 후 0자이면 컨테이너 자체가 hidden 처리된다 (요구 7.6). */
  query: string;
  /** useSearch error 노출. null이 아니면 안내 텍스트를 표시한다. */
  error: Error | null;
  /** 사용자가 선택한 결과 행의 item.id. 선택 시각 강조에 사용. */
  selectedItemId: UUID | null;
  /** 행 클릭 시 부모(App)의 highlight 핸들러로 위임한다 (요구 8.1/8.2). */
  onSelect: (item: Item) => void;
}

/**
 * 검색 결과 리스트 (요구 7.4–7.7).
 *
 * 표시 규칙:
 *   - query.trim().length === 0           → 컨테이너 자체를 렌더하지 않는다 (요구 7.6).
 *   - error !== null                       → "검색 중 오류가 발생했습니다"
 *   - results.length === 0                 → "검색 결과가 없습니다" (요구 7.7)
 *   - results.length > 0                   → 각 행에 item.name + " · " + location.name (요구 7.5)
 *
 * 선택 강조:
 *   - selectedItemId === row.item.id인 행에 `search-result-list__row--selected` 부착.
 *   - 강조는 디자인 토큰만 사용 (primary border + parchment 배경).
 *
 * 사진 아이콘 등 다른 정보는 노출하지 않는다 — 명세 7.5는 name과 location.name만 요구한다.
 */
export function SearchResultList({
  results,
  query,
  error,
  selectedItemId,
  onSelect,
}: SearchResultListProps) {
  const q = query.trim();

  if (q.length === 0) {
    // 요구 7.6: 0자 입력이면 컨테이너 자체가 표시되지 않아야 한다.
    return null;
  }

  if (error) {
    return (
      <div className="search-result-list" role="alert">
        <p className="search-result-list__hint">검색 중 오류가 발생했습니다</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-result-list">
        <p className="search-result-list__hint">검색 결과가 없습니다</p>
      </div>
    );
  }

  return (
    <ul className="search-result-list" aria-label="검색 결과">
      {results.map(({ item, location }) => {
        const isSelected = item.id === selectedItemId;
        const className = isSelected
          ? "search-result-list__row search-result-list__row--selected"
          : "search-result-list__row";
        return (
          <li key={item.id}>
            <button
              type="button"
              className={className}
              onClick={() => onSelect(item)}
              aria-pressed={isSelected}
            >
              <span className="search-result-list__name">{item.name}</span>
              <span className="search-result-list__sep"> · </span>
              <span className="search-result-list__location">
                {location?.name ?? "위치 미상"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
