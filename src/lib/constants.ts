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
 * Marker rendered size on screen (px).
 * Wide map-pin proportion, centered on (x_pos, y_pos) via
 * CSS `transform: translate(-50%, -50%)`.
 */
export const MARKER_WIDTH = 48;
export const MARKER_HEIGHT = 32;

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
