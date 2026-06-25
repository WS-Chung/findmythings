import { useEffect, useMemo, useState } from "react";
import { FloorPlan } from "./components/FloorPlan";
import { FloorPlanPanel } from "./components/FloorPlanPanel";
import { ItemPopup } from "./components/ItemPopup";
import { Layout } from "./components/Layout";
import { Marker } from "./components/Marker";
import { SearchPanel } from "./components/SearchPanel";
import type { SearchResultRow } from "./components/SearchResultList";
import { useAllItems } from "./hooks/useAllItems";
import { useLocations } from "./hooks/useLocations";
import { useSearch } from "./hooks/useSearch";
import type { Item, Location, UUID } from "./types/db";

export function App() {
  const { data: locations, error: locationsError } = useLocations();
  const {
    data: allItems,
    error: itemsError,
    refetch: refetchItems,
  } = useAllItems();

  const [selectedLocationId, setSelectedLocationId] = useState<UUID | null>(
    null,
  );

  // ---- 검색 상태 (Task 9.6) ----
  const [query, setQuery] = useState("");
  const { data: searchResults, active: searchActive } = useSearch(
    query,
    allItems,
  );

  /**
   * 검색 결과에서 클릭된 행의 item.id.
   * 결과 리스트의 선택 강조와 평면도 마커 highlight를 모두 이 값으로 동기화한다.
   */
  const [selectedSearchItemId, setSelectedSearchItemId] = useState<UUID | null>(
    null,
  );
  /**
   * 현재 펄스 애니메이션이 적용된 location.id. App state가 단일 값이므로
   * Property 15(단일성)와 Requirement 8.4/8.5(다른 행 클릭 시 이전 해제)가
   * 자동으로 만족된다.
   */
  const [highlightedLocationId, setHighlightedLocationId] =
    useState<UUID | null>(null);

  // locations를 id로 빠르게 lookup해 결과 행에 location.name을 붙인다 (요구 7.5).
  const locationById = useMemo(() => {
    const m = new Map<UUID, Location>();
    for (const l of locations) m.set(l.id, l);
    return m;
  }, [locations]);

  const enrichedResults: SearchResultRow[] = useMemo(
    () =>
      searchResults.map((item) => ({
        item,
        location: locationById.get(item.location_id),
      })),
    [searchResults, locationById],
  );

  // 검색바가 0자가 되면 highlight와 선택 상태를 모두 해제한다 (요구 8.6).
  // debounced가 아니라 raw query를 사용해, 사용자가 입력을 비우는 순간 즉시 해제된다.
  useEffect(() => {
    if (query.trim().length === 0) {
      setHighlightedLocationId(null);
      setSelectedSearchItemId(null);
    }
  }, [query]);

  const handleMarkerClick = (id: UUID) => {
    setSelectedLocationId(id);
  };

  /**
   * 검색 결과 행 클릭 (요구 8.1, 8.2, 8.5).
   * 단일 state 갱신으로 이전 highlight는 자동 해제되고 새 마커에만 펄스가 부여된다.
   * ItemPopup은 명세에 따라 자동으로 열지 않는다 — 사용자가 강조된 마커를 직접
   * 클릭해 상세를 연다.
   */
  const handleSearchSelect = (item: Item) => {
    setSelectedSearchItemId(item.id);
    setHighlightedLocationId(item.location_id);
  };

  const selectedLocation =
    selectedLocationId !== null
      ? locations.find((l) => l.id === selectedLocationId) ?? null
      : null;

  // 선택된 location의 items만 ItemPopup에 전달 (전체 prefetch + 클라이언트 필터).
  const itemsForSelected = useMemo(
    () =>
      selectedLocationId !== null
        ? allItems.filter((i) => i.location_id === selectedLocationId)
        : [],
    [allItems, selectedLocationId],
  );

  return (
    <Layout>
      <SearchPanel
        query={query}
        onQueryChange={setQuery}
        results={enrichedResults}
        active={searchActive}
        selectedItemId={selectedSearchItemId}
        onSelect={handleSearchSelect}
      />
      <FloorPlanPanel error={locationsError}>
        <FloorPlan dimmed={highlightedLocationId !== null}>
          {(wrapperWidth) =>
            locations.map((loc) => (
              <Marker
                key={loc.id}
                location={loc}
                wrapperWidth={wrapperWidth}
                highlighted={loc.id === highlightedLocationId}
                onClick={handleMarkerClick}
              />
            ))
          }
        </FloorPlan>
      </FloorPlanPanel>

      {selectedLocation ? (
        <ItemPopup
          location={selectedLocation}
          items={itemsForSelected}
          allItems={allItems}
          locations={locations}
          itemsError={itemsError}
          onItemsChanged={refetchItems}
          onClose={() => setSelectedLocationId(null)}
        />
      ) : null}
    </Layout>
  );
}
