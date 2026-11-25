/**
 * Application-wide constants.
 * Source of truth for canvas geometry, validation bounds, and DB identifiers.
 */

/** Virtual canvas width (px). 평면도 이미지 기준 좌표계. */
export const CANVAS_W = 1060;
/** Virtual canvas height (px). 평면도 이미지 기준 좌표계. */
export const CANVAS_H = 740;

/** Debounce delay for the search input (ms). */
export const DEBOUNCE_MS = 200;

/**
 * Marker rendered size on screen (px), at full canvas scale (wrapperWidth === CANVAS_W).
 * Tall map-pin proportion. `<Marker>`는 이 값에 현재 캔버스 스케일을 곱해 실제 픽셀 크기로
 * 렌더링하므로, 도면이 줄어들면 마커도 비례해서 같이 줄어든다.
 * 마커는 `transform: translate(-50%, -50%)`로 (x_pos, y_pos)에 중심 정렬.
 */
export const MARKER_WIDTH = 24;
export const MARKER_HEIGHT = 36;

/**
 * 도면이 작아져도(휴대폰) 마커가 이보다 작아지지는 않는다 (px).
 * 눈에 띄는 최소 크기이며, 누르는 영역은 CSS에서 40px 이상으로 따로 넓힌다.
 */
export const MARKER_MIN_WIDTH = 18;
export const MARKER_MIN_HEIGHT = 27;

/**
 * 위치 수정 모드에서 모든 마커의 이름표를 한꺼번에 보이는 최소 평면도 폭(px).
 * 이보다 좁으면(휴대폰) 선택한 마커의 이름표만 보인다. 이름표가 서로 겹쳐 읽을 수 없기 때문이다.
 */
export const ALL_LABELS_MIN_WIDTH = 640;

/** 방향키로 마커를 옮길 때의 간격 (가상 캔버스 px). Shift를 누르면 큰 간격. */
export const MARKER_NUDGE = 1;
export const MARKER_NUDGE_LARGE = 10;

/** 수납장(마커) 이름 최대 길이. 이름표와 표 칸에 들어가므로 물품 이름과 같게 둔다. */
export const MAX_LOCATION_NAME_LEN = 20;

/** Hashtag count cap on an Item. */
export const MAX_HASHTAGS = 4;
/** Item name max length. */
export const MAX_NAME_LEN = 20;
/** Hashtag element max length. */
export const MAX_HASHTAG_LEN = 20;

/** Output dimensions for the client-side image resizer (px). */
export const IMAGE_OUTPUT_SIZE = 300;

/** Storage bucket id (note: Storage ids disallow `_`, use `-`). */
export const STORAGE_BUCKET = "fmt-item-images" as const;

/** Postgres table names (prefixed `fmt_` for shared-project safety). */
export const TABLES = {
  locations: "fmt_locations",
  items: "fmt_items",
} as const;
