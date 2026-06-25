import type { Item, UUID } from "../types/db";
import { SearchInput } from "./SearchInput";
import {
  SearchResultList,
  type SearchResultRow,
} from "./SearchResultList";
import "./SearchPanel.css";

export interface SearchPanelProps {
  /** Controlled 검색바 값 (App.tsx에서 state로 보유). */
  query: string;
  onQueryChange: (next: string) => void;
  /** useSearch 결과를 location 메타와 join한 행들. */
  results: SearchResultRow[];
  /**
   * 검색이 활성화된 상태인지 여부. false이면 결과 리스트가 렌더되지 않는다.
   */
  active: boolean;
  /** 현재 강조된 결과 행의 item.id. */
  selectedItemId: UUID | null;
  /** 결과 행 클릭 시 부모로 위임. App이 highlightedLocationId state를 갱신한다. */
  onSelect: (item: Item) => void;
}

/**
 * 좌측 15fr 컬럼. 검색바 + 결과 리스트를 세로로 배치한다.
 *
 * 디자인:
 *   - 패널 컨테이너 자체는 기존 그대로 (parchment bg + hairline + radius-lg).
 *   - SearchInput은 컨테이너 padding 안에서 가로 100%로 확장.
 *   - SearchResultList는 SearchInput 바로 아래에 위치. active=false면 자기 자신을 렌더하지 않는다.
 */
export function SearchPanel({
  query,
  onQueryChange,
  results,
  active,
  selectedItemId,
  onSelect,
}: SearchPanelProps) {
  return (
    <aside className="search-panel" aria-label="검색 패널">
      <SearchInput value={query} onChange={onQueryChange} />
      <SearchResultList
        results={results}
        active={active}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
      />
    </aside>
  );
}
