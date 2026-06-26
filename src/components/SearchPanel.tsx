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
  /** 사용자가 검색어를 입력한 상태 여부 (0건 메시지 분기에 사용). */
  hasQuery: boolean;
  /** 현재 강조된 결과 행의 item.id. */
  selectedItemId: UUID | null;
  /** 결과 행 클릭 시 부모로 위임. App이 highlightedLocationId state를 갱신한다. */
  onSelect: (item: Item) => void;
}

/**
 * 좌측 패널. SearchInput + SearchResultList를 세로로 배치한다.
 *
 * 검색어가 없어도 결과 리스트(전체 가나다 정렬)를 표시하므로 SearchResultList는
 * 항상 마운트된다. 패널 자체에 overflow: auto가 있어 항목이 많으면 스크롤된다.
 */
export function SearchPanel({
  query,
  onQueryChange,
  results,
  hasQuery,
  selectedItemId,
  onSelect,
}: SearchPanelProps) {
  return (
    <aside className="search-panel" aria-label="검색 패널">
      <SearchInput value={query} onChange={onQueryChange} />
      <SearchResultList
        results={results}
        hasQuery={hasQuery}
        selectedItemId={selectedItemId}
        onSelect={onSelect}
      />
    </aside>
  );
}
