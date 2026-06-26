import type { KeyboardEvent, MouseEvent } from "react";
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
   *   - true  → 결과 0건이면 "검색 결과가 없습니다"
   *   - false → 결과 0건이면 "등록된 물품이 없습니다"
   * 헤더는 hasQuery와 무관하게 항상 노출.
   */
  hasQuery: boolean;
  /** 사용자가 선택한 결과 행의 item.id. 선택 시각 강조에 사용. */
  selectedItemId: UUID | null;
  /** 행 클릭 시 부모(App)의 highlight 핸들러로 위임한다. */
  onSelect: (item: Item) => void;
  /**
   * 사진 아이콘(📷) 클릭. image_url이 있는 행에서만 호출되며 부모(App)가
   * ImagePreview 모달을 띄운다. 사진 버튼 클릭은 행 onSelect와 분리된다.
   */
  onPhotoClick: (item: Item) => void;
}

/**
 * 검색 결과 리스트 — 3열 테이블 (이름 / 보관위치 / 사진).
 *
 * 행을 button 대신 li(role="button")로 구성한 이유:
 *   사진 셀이 자체 button을 가져야 하므로 button-in-button HTML 무효를 피하기 위함.
 *   행 전체 클릭과 사진 버튼 클릭을 분리하기 위해 photo button에서 stopPropagation 사용.
 *
 * 검색어가 없을 때도 전체 items(가나다 순)가 노출되며, 항목이 많으면 SearchPanel의
 * overflow: auto로 세로 스크롤된다.
 */
export function SearchResultList({
  results,
  hasQuery,
  selectedItemId,
  onSelect,
  onPhotoClick,
}: SearchResultListProps) {
  const handleRowKeyDown = (
    e: KeyboardEvent<HTMLLIElement>,
    item: Item,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(item);
    }
  };

  const handlePhotoClick = (
    e: MouseEvent<HTMLButtonElement>,
    item: Item,
  ) => {
    // 사진 버튼 클릭은 행 클릭(onSelect)과 분리한다.
    e.stopPropagation();
    onPhotoClick(item);
  };

  return (
    <div className="search-result-list">
      <div
        className="search-result-list__header"
        role="row"
        aria-label="검색 결과 컬럼 헤더"
      >
        <span className="search-result-list__header-cell">물건</span>
        <span className="search-result-list__header-cell">보관위치</span>
        <span className="search-result-list__header-cell search-result-list__header-cell--photo">
          사진
        </span>
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
              <li
                key={item.id}
                className={className}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => handleRowKeyDown(e, item)}
              >
                <span className="search-result-list__name">{item.name}</span>
                <span className="search-result-list__location">
                  {location?.name ?? "위치 미상"}
                </span>
                <span className="search-result-list__photo-cell">
                  {item.image_url ? (
                    <button
                      type="button"
                      className="search-result-list__photo-btn"
                      onClick={(e) => handlePhotoClick(e, item)}
                      aria-label={`${item.name} 사진 보기`}
                    >
                      📷
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
