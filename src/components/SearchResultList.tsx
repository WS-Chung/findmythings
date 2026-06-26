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
   * 헤더(물건/보관위치)는 active와 무관하게 항상 노출되며, 결과 영역만
   * active에 따라 분기된다.
   */
  active: boolean;
  /** 사용자가 선택한 결과 행의 item.id. 선택 시각 강조에 사용. */
  selectedItemId: UUID | null;
  /** 행 클릭 시 부모(App)의 highlight 핸들러로 위임한다 (요구 8.1/8.2). */
  onSelect: (item: Item) => void;
}

/**
 * 검색 결과 리스트 — 2열 테이블 형태 (헤더 + 결과 행).
 *
 * 레이아웃: 각 행이 2열 grid (물건 / 보관위치).
 *   헤더와 결과 행이 같은 grid template를 공유하므로 컬럼 시작 위치가 정확히 정렬된다.
 *
 * 표시 규칙:
 *   - 헤더 행 "물건 | 보관위치"는 항상 노출 (검색 안 한 상태에서도 보임).
 *   - 결과 영역:
 *       active === false               → 안내 텍스트 표시
 *       active === true, length === 0  → "검색 결과가 없습니다"
 *       active === true, length > 0    → 각 행에 item.name | location.name (요구 7.5)
 *
 * 선택 강조:
 *   - selectedItemId === row.item.id인 행에 `--selected` modifier 부착.
 *
 * 메모리 필터(useSearch) 기반으로 동작하므로 error 분기는 없다.
 */
export function SearchResultList({
  results,
  active,
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

      {!active ? (
        <p className="search-result-list__hint">
          검색어를 입력하세요
        </p>
      ) : results.length === 0 ? (
        <p className="search-result-list__hint">검색 결과가 없습니다</p>
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
