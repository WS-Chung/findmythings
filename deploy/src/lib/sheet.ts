/**
 * 엑셀형 표(SheetGrid)에서 쓰는 순수 함수.
 */

/** 0 → A, 25 → Z, 26 → AA. 엑셀의 열 머리 문자. */
export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * 데이터 행 번호(0부터)와 열 번호(0부터)를 엑셀 주소로 바꾼다.
 * 1행은 머리글 행이라 첫 데이터 행은 2행이다. (0, 0) → "A2"
 */
export function cellAddress(dataRow: number, column: number): string {
  return `${columnLetter(column)}${dataRow + 2}`;
}

/** ISO 시각을 사용자 시간대 기준 `YYYY-MM-DD`로. 잘못된 값은 빈 문자열. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
