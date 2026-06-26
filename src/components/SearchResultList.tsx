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
   * 사용자가 검색어를 입력한 상태인지 여부.
   *   - true  → 검색 모드. 결과 0건이면 "검색 결과가 없습니다"
   *   - false → 전체 보기 모드. 결과 0건이면 "등록된 물품이 없습니다"
   *
   * 헤더(물건/보관위치)는 hasQuery와 무관하게 항상 노출된다.
   */
  hasQuery: boolean;
  /** 사용자가 선택한 결과 행의 item.id. 선택 시각 강조에 사용. */
  selectedItemId: UUID | null;
  /** 행 클릭 시 부모(App)의 highlight 핸들러로 위임한다 (요구 8.1/8.2). */
  onSelect: (item: Item) => void;
}

/**
 * 검색 결과 리스트 — 2열 테이블 (헤더 + 결과 행).
 *
 * 검색어가 없을 때도 전체 items가 가나다 순으로 나열되며 (스크롤 가능),
 * 검색어가 있을 때는 일치 결과만 보인다. 헤더는 항상 노출.
 */
export function SearchResultList({
  results,
  hasQuery,
  selectedItemId,
  onSelect,
}: SearchResultListProps) {
  return (
    <div className="search-result-list">
      <div
        className="search-result-list__header"
        role="row"
        aria-label="검색 결과 컬럼 헤더"
      >
        <span className="search-result-list__header-cell">물건</span>
        <span className="search-result-list__header-cell">보관위치</span>
      </div>

      {results.length === 0 ? (
        <p className="search-result-list__hint">
          {hasQuery ? "검색 결과가 없습니다" : "등록된 물품이 없습니다"}
        </p>
      ) : (
        <ul className="search-result-list__items" aria-label="검색 결과">
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
      )}
    </div>
  );
}
