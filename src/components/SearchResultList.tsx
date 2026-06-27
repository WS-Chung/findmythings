import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
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
 * 검색 결과 리스트 — 3열 테이블 (이름 / 보관위치 / 사진) + 페이지네이션.
 *
 * 행을 button 대신 li(role="button")로 구성한 이유:
 *   사진 셀이 자체 button을 가져야 하므로 button-in-button HTML 무효를 피하기 위함.
 *   행 전체 클릭과 사진 버튼 클릭을 분리하기 위해 photo button에서 stopPropagation 사용.
 *
 * 페이지네이션:
 *   - items 영역의 가용 높이와 측정된 행 높이로 pageSize를 동적 계산
 *   - 화면 폭/패널 크기 변화에 ResizeObserver로 즉시 반응 (해상도에 따라 페이지당 행 수 가변)
 *   - 결과/검색어가 바뀌면 현재 페이지를 0으로 리셋
 *   - 한 페이지에 모두 들어가면(totalPages === 1) 페이저는 숨김
 *   - 모바일에서는 items가 height: auto이므로 자연스럽게 한 페이지 = 전체가 되어 페이저 미노출
 */
export function SearchResultList({
  results,
  hasQuery,
  selectedItemId,
  onSelect,
  onPhotoClick,
}: SearchResultListProps) {
  const itemsRef = useRef<HTMLUListElement | null>(null);
  const probeRef = useRef<HTMLLIElement | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  // results 또는 검색어 상태가 바뀌면 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(0);
  }, [hasQuery, results.length]);

  // items 컨테이너 / 행 측정 → pageSize 갱신
  useLayoutEffect(() => {
    const container = itemsRef.current;
    const probe = probeRef.current;
    if (!container || !probe) return;

    const recompute = () => {
      const containerH = container.clientHeight;
      const rowH = probe.getBoundingClientRect().height;
      if (rowH <= 0 || containerH <= 0) return;
      const style = window.getComputedStyle(container);
      const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
      // floor((containerH + gap) / (rowH + gap)) — 마지막 행 뒤에는 gap이 없으므로 +gap 보정
      const fit = Math.max(1, Math.floor((containerH + gap) / (rowH + gap)));
      setPageSize((prev) => (prev === fit ? prev : fit));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    ro.observe(probe);
    return () => ro.disconnect();
  }, [results.length]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const start = safePage * pageSize;
  const visible = results.slice(start, start + pageSize);
  const showPager = results.length > 0 && totalPages > 1;

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

  const handlePrev = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCurrentPage((p) => Math.max(0, p - 1));
  };
  const handleNext = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
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
        <ul
          className="search-result-list__items"
          aria-label="검색 결과"
          ref={itemsRef}
        >
          {visible.map(({ item, location }, idx) => {
            const isSelected = item.id === selectedItemId;
            const className = isSelected
              ? "search-result-list__row search-result-list__row--selected"
              : "search-result-list__row";
            // 첫 번째 가시 행을 측정 probe로도 사용한다 (행 높이는 패딩/폰트가 일정해 동일)
            const ref = idx === 0 ? probeRef : undefined;
            return (
              <li
                key={item.id}
                className={className}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelect(item)}
                onKeyDown={(e) => handleRowKeyDown(e, item)}
                ref={ref}
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

      {showPager ? (
        <nav
          className="search-result-list__pager"
          aria-label="검색 결과 페이지 이동"
        >
          <button
            type="button"
            className="search-result-list__pager-btn"
            onClick={handlePrev}
            disabled={safePage === 0}
            aria-label="이전 페이지"
          >
            ‹
          </button>
          <span
            className="search-result-list__pager-info"
            aria-live="polite"
          >
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="search-result-list__pager-btn"
            onClick={handleNext}
            disabled={safePage >= totalPages - 1}
            aria-label="다음 페이지"
          >
            ›
          </button>
        </nav>
      ) : null}
    </div>
  );
}
