import type { Item, Location, UUID } from "../types/db";
import "./SearchResultList.css";

export interface SearchResultRow {
  item: Item;
  /** location_id에 매칭되는 Location. 시드 정합성이 깨지면 undefined일 수 있다. */
  location: Location | undefined;
}

export interface SearchResultListProps {
  results: SearchResultRow[];
  /**
   * 검색이 활성화된 상태인지 여부 (디바운스된 query.trim().length > 0).
   * false이면 컨테이너 자체가 렌더되지 않는다 (요구 7.6).
   */
  active: boolean;
  /** 사용자가 선택한 결과 행의 item.id. 선택 시각 강조에 사용. */
  selectedItemId: UUID | null;
  /** 행 클릭 시 부모(App)의 highlight 핸들러로 위임한다 (요구 8.1/8.2). */
  onSelect: (item: Item) => void;
}

/**
 * 검색 결과 리스트 (요구 7.4–7.7).
 *
 * 레이아웃: 각 행이 2열 grid (이름 / 수납장 이름).
 *   여러 결과가 떴을 때 물품 이름끼리, 수납장 이름끼리 텍스트 시작 위치가
 *   세로로 정렬된다. 두 컬럼이 모두 ellipsis 처리되어 넘치는 텍스트는 잘린다.
 *
 * 표시 규칙:
 *   - active === false                     → 컨테이너 자체를 렌더하지 않는다 (요구 7.6).
 *   - results.length === 0                 → "검색 결과가 없습니다" (요구 7.7)
 *   - results.length > 0                   → 각 행에 item.name | location.name (요구 7.5)
 *
 * 선택 강조:
 *   - selectedItemId === row.item.id인 행에 `search-result-list__row--selected` 부착.
 *   - 강조는 디자인 토큰만 사용 (primary border + canvas 배경).
 *
 * 사진 아이콘 등 다른 정보는 노출하지 않는다 — 명세 7.5는 name과 location.name만 요구한다.
 * 메모리 필터(useSearch) 기반으로 동작하므로 error 분기는 없다.
 */
export function SearchResultList({
  results,
  active,
  selectedItemId,
  onSelect,
}: SearchResultListProps) {
  if (!active) {
    return null;
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
