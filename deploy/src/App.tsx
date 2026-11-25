import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FloorPlan } from "./components/FloorPlan";
import { FloorPlanPanel } from "./components/FloorPlanPanel";
import { ImagePreview } from "./components/ImagePreview";
import { ItemPopup } from "./components/ItemPopup";
import { Layout } from "./components/Layout";
import { MarkerLayer } from "./components/MarkerLayer";
import { ResultSheet, type SearchResultRow } from "./components/ResultSheet";
import { SearchInput } from "./components/SearchInput";
import { useAllItems } from "./hooks/useAllItems";
import { useLocations } from "./hooks/useLocations";
import { useMarkerEditor } from "./hooks/useMarkerEditor";
import { useSearch } from "./hooks/useSearch";
import type { Item, Location, UUID } from "./types/db";
import "./App.css";

/** 이 폭 이하에서는 평면도와 표가 위아래로 쌓인다 (App.css의 미디어 쿼리와 같은 값). */
const STACKED_QUERY = "(max-width: 1100px)";

export function App() {
  const {
    data: locations,
    loading: locationsLoading,
    error: locationsError,
    refetch: refetchLocations,
    applyPositions,
    addLocation,
    removeLocation: dropLocation,
  } = useLocations();
  const {
    data: allItems,
    loading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
    removeByLocation,
  } = useAllItems();

  /** 수납장을 지우면 DB가 그 안의 물품도 함께 지우므로, 화면 상태에서도 둘 다 뺀다. */
  const removeLocation = useCallback(
    (id: UUID) => {
      dropLocation(id);
      removeByLocation(id);
    },
    [dropLocation, removeByLocation],
  );

  const editor = useMarkerEditor(locations, {
    applyPositions,
    addLocation,
    removeLocation,
  });

  const [selectedLocationId, setSelectedLocationId] = useState<UUID | null>(
    null,
  );

  /** 삭제 확인 대화상자의 대상 수납장. null이면 대화상자가 없다. */
  const [deleteTargetId, setDeleteTargetId] = useState<UUID | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---- 검색 상태 ----
  const [query, setQuery] = useState("");
  const {
    data: searchResults,
    hasQuery: searchHasQuery,
    query: searchedQuery,
  } = useSearch(query, allItems);

  /**
   * 검색 결과에서 클릭된 행의 item.id.
   * 결과 표의 선택 표시와 평면도 마커 강조를 모두 이 값으로 동기화한다.
   */
  const [selectedSearchItemId, setSelectedSearchItemId] = useState<UUID | null>(
    null,
  );
  /**
   * 현재 강조된 location.id. App state가 단일 값이므로
   * 강조 마커는 항상 0~1개이고, 다른 행을 클릭하면 이전 강조가 자동으로 해제된다.
   */
  const [highlightedLocationId, setHighlightedLocationId] =
    useState<UUID | null>(null);

  /** 검색 결과의 📷 클릭 시 띄울 ImagePreview 대상. */
  const [searchPreviewItem, setSearchPreviewItem] = useState<Item | null>(
    null,
  );

  const mapPanelRef = useRef<HTMLElement>(null);

  const locationById = useMemo(() => {
    const m = new Map<UUID, Location>();
    for (const l of locations) m.set(l.id, l);
    return m;
  }, [locations]);

  const itemById = useMemo(() => {
    const m = new Map<UUID, Item>();
    for (const i of allItems) m.set(i.id, i);
    return m;
  }, [allItems]);

  const enrichedResults: SearchResultRow[] = useMemo(
    () =>
      searchResults.map((item) => ({
        item,
        location: locationById.get(item.location_id),
        parent: item.parent_id ? itemById.get(item.parent_id) : undefined,
      })),
    [searchResults, locationById, itemById],
  );

  // 검색바가 0자가 되면 강조와 선택 상태를 모두 해제한다.
  // debounced가 아니라 raw query를 사용해, 입력을 비우는 순간 즉시 해제된다.
  useEffect(() => {
    if (query.trim().length === 0) {
      setHighlightedLocationId(null);
      setSelectedSearchItemId(null);
    }
  }, [query]);

  /**
   * 결과 표의 행 밖 어디를 눌러도 강조를 해제한다.
   * 결과 행 자체를 누르는 것은 새 강조를 설정하는 동작이므로 무시한다.
   * 강조가 켜져 있을 때만 리스너를 달아 불필요한 처리를 막는다.
   */
  useEffect(() => {
    if (highlightedLocationId === null) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-keep-highlight] tr[data-row-id]")) return;
      setHighlightedLocationId(null);
      setSelectedSearchItemId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [highlightedLocationId]);

  const handleMarkerClick = (id: UUID) => {
    // 마커 수정·마커 추가 중에는 마커를 눌러도 물품 표가 열리지 않는다.
    if (editor.mode !== "idle") return;
    setSelectedLocationId(id);
  };

  const closeDelete = () => {
    setDeleteTargetId(null);
    setDeleteError(null);
  };

  /** 확인 대화상자에서 "삭제"를 눌렀을 때. 실패하면 대화상자를 유지하고 문장을 보인다. */
  const handleDeleteConfirm = async () => {
    if (deleteTargetId === null) return;
    const failure = await editor.deleteLocation(deleteTargetId);
    if (failure) {
      setDeleteError(failure);
      return;
    }
    if (highlightedLocationId === deleteTargetId) {
      setHighlightedLocationId(null);
      setSelectedSearchItemId(null);
    }
    closeDelete();
  };

  /**
   * 검색 결과 행 클릭.
   * 단일 state 갱신으로 이전 강조는 자동 해제되고 새 마커에만 강조가 부여된다.
   * ItemPopup은 자동으로 열지 않는다. 사용자가 강조된 마커를 직접 눌러 연다.
   * 평면도가 표 위에 있는 좁은 화면에서는 평면도가 보이도록 스크롤한다.
   */
  const handleSearchSelect = (item: Item) => {
    setSelectedSearchItemId(item.id);
    setHighlightedLocationId(item.location_id);
    if (window.matchMedia(STACKED_QUERY).matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mapPanelRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
      });
    }
  };

  /** 마커 수정·마커 추가 모드에 들어가기 전에 검색 강조를 정리한다. */
  const handleModeStart = () => {
    setHighlightedLocationId(null);
    setSelectedSearchItemId(null);
  };

  /** 새 마커를 저장한다. 성공하면 새 마커를 강조해 어디에 생겼는지 보여 준다. */
  const handleAddSubmit = async () => {
    const id = await editor.submitAdd();
    if (id) {
      setSelectedSearchItemId(null);
      setHighlightedLocationId(id);
    }
  };

  const selectedLocation =
    selectedLocationId !== null
      ? locations.find((l) => l.id === selectedLocationId) ?? null
      : null;

  // 마커 수정 모드에서 선택한 마커(삭제 대상)와 삭제 확인 대화상자의 대상.
  const selectedMarker =
    editor.editing && editor.activeId !== null
      ? locationById.get(editor.activeId) ?? null
      : null;
  const deleteTarget =
    deleteTargetId !== null ? locationById.get(deleteTargetId) ?? null : null;
  const deleteItemCount = deleteTarget
    ? allItems.filter((i) => i.location_id === deleteTarget.id).length
    : 0;
  /** 물품을 아직 못 불러왔으면 몇 개가 함께 지워지는지 알릴 수 없으므로 삭제를 막는다. */
  const deleteBlocked = itemsLoading || Boolean(itemsError);

  // 선택된 location의 items만 ItemPopup에 전달 (전체 prefetch + 클라이언트 필터).
  const itemsForSelected = useMemo(
    () =>
      selectedLocationId !== null
        ? allItems.filter((i) => i.location_id === selectedLocationId)
        : [],
    [allItems, selectedLocationId],
  );

  // ---- 제목 아래 한 줄: 지금 화면이 알려 주는 사실 ----
  const resultLocationCount = useMemo(
    () => new Set(searchResults.map((i) => i.location_id)).size,
    [searchResults],
  );

  let summary: React.ReactNode;
  if (locationsLoading || itemsLoading) {
    summary = <span className="skel w40" />;
  } else if (locationsError || itemsError) {
    summary = "일부 정보를 불러오지 못했습니다.";
  } else if (searchHasQuery) {
    summary =
      searchResults.length === 0 ? (
        <>
          <b>&ldquo;{searchedQuery}&rdquo;</b>와(과) 일치하는 물품이 없습니다.
        </>
      ) : (
        <>
          <b>&ldquo;{searchedQuery}&rdquo;</b> 검색 결과는 <b>{searchResults.length}개</b>
          이고 수납장 {resultLocationCount}곳에 있습니다.
        </>
      );
  } else if (allItems.length === 0) {
    summary = "등록된 물품이 없습니다. 평면도의 마커를 눌러 첫 물건을 등록하세요.";
  } else {
    summary = (
      <>
        수납장 {locations.length}곳에 물품 <b>{allItems.length}개</b>가 있습니다.
      </>
    );
  }

  return (
    <Layout>
      <header className="pg-head">
        <h1 className="t">물건 찾기</h1>
        <p className="desc" aria-live="polite">
          {summary}
        </p>
      </header>

      <div className="work">
        <div className="work__search">
          <SearchInput value={query} onChange={setQuery} />
        </div>

        <div className="work__map">
          <FloorPlanPanel
            panelRef={mapPanelRef}
            markerCount={locations.length}
            loading={locationsLoading}
            error={locationsError}
            onRetry={refetchLocations}
            editor={editor}
            onModeStart={handleModeStart}
            selectedName={selectedMarker?.name ?? null}
            onDeleteRequest={() => {
              if (editor.activeId !== null) setDeleteTargetId(editor.activeId);
            }}
            deleteBlocked={deleteBlocked}
            onAddSubmit={() => void handleAddSubmit()}
          >
            <FloorPlan dimmed={highlightedLocationId !== null || editor.adding}>
              {(wrapperWidth) => (
                <MarkerLayer
                  locations={locations}
                  wrapperWidth={wrapperWidth}
                  highlightedLocationId={highlightedLocationId}
                  editor={editor}
                  onMarkerClick={handleMarkerClick}
                />
              )}
            </FloorPlan>
          </FloorPlanPanel>
        </div>

        <div className="work__sheet">
          <ResultSheet
            results={enrichedResults}
            total={allItems.length}
            hasQuery={searchHasQuery}
            state={itemsError ? "error" : itemsLoading ? "loading" : "ready"}
            onRetry={refetchItems}
            selectedItemId={selectedSearchItemId}
            onSelect={handleSearchSelect}
            onPhotoClick={setSearchPreviewItem}
          />
        </div>
      </div>

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

      {deleteTarget ? (
        <ConfirmDialog
          title="수납장 삭제"
          message={
            deleteItemCount > 0
              ? `수납장 "${deleteTarget.name}"을(를) 삭제합니다. 이 수납장에 든 물품 ${deleteItemCount}개(하위 물품 포함)도 함께 삭제되며 되돌릴 수 없습니다.`
              : `수납장 "${deleteTarget.name}"을(를) 삭제합니다. 이 수납장에 등록된 물품은 없습니다. 되돌릴 수 없습니다.`
          }
          confirmLabel="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={closeDelete}
          errorMessage={deleteError}
        />
      ) : null}

      {searchPreviewItem && searchPreviewItem.image_url ? (
        <ImagePreview
          imageUrl={searchPreviewItem.image_url}
          alt={searchPreviewItem.name}
          onClose={() => setSearchPreviewItem(null)}
        />
      ) : null}
    </Layout>
  );
}
