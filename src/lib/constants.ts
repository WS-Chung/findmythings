/**
 * Application-wide constants.
 * Source of truth for canvas geometry, validation bounds, and DB identifiers.
 */

/** Virtual canvas width (px) — see design.md "Coordinate Transformation". */
export const CANVAS_W = 1060;
/** Virtual canvas height (px) — see design.md "Coordinate Transformation". */
export const CANVAS_H = 740;

/** Debounce delay for the search input (ms). Requirement 7.2: 200ms ±50ms. */
export const DEBOUNCE_MS = 200;

/**
 * Marker rendered size on screen (px), at full canvas scale (wrapperWidth === CANVAS_W).
 * Tall map-pin proportion. `<Marker>`는 이 값에 현재 캔버스 스케일을 곱해 실제 픽셀 크기로
 * 렌더링하므로, 도면이 줄어들면 마커도 비례해서 같이 줄어든다.
 * 마커는 `transform: translate(-50%, -50%)`로 (x_pos, y_pos)에 중심 정렬.
 */
export const MARKER_WIDTH = 32;
export const MARKER_HEIGHT = 48;

/** Hashtag count cap on an Item. Requirement 4.4. */
export const MAX_HASHTAGS = 4;
/** Item name max length. Requirement 4.3. */
export const MAX_NAME_LEN = 20;
/** Hashtag element max length. Requirement 4.5. */
export const MAX_HASHTAG_LEN = 20;

/** Output dimensions for the client-side image resizer (px). Requirement 11.1. */
export const IMAGE_OUTPUT_SIZE = 300;

/** Storage bucket id (note: Storage ids disallow `_`, use `-`). */
export const STORAGE_BUCKET = "fmt-item-images" as const;

/** Postgres table names (prefixed `fmt_` for shared-project safety). */
export const TABLES = {
  locations: "fmt_locations",
  items: "fmt_items",
} as const;

/** RPC names. */
export const RPC = {
  searchItems: "fmt_search_items",
} as const;
