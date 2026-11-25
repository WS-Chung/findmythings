import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cellAddress, columnLetter } from "../lib/sheet";
import { Icon } from "./Icon";
import "./SheetGrid.css";

/**
 * 엑셀형 표. 목록을 엑셀 시트처럼 보여 주고 키보드로 다룬다.
 *
 * 구성: 수식 줄(칸 주소 + 값) / 열 문자 행(A, B, C) / 1행 머리글 / 데이터 행 /
 *       빈 행 채움 / 시트 탭 / 상태 막대.
 * 높이는 부모가 정한다(부모 높이를 100% 채운다). 데이터가 적으면 보이는 높이만큼
 * 빈 행을 채워 시트처럼 보이게 한다.
 *
 * 조작
 *   - 칸을 누름: 그 칸을 고르고 행을 선택(onSelectRow)
 *   - 두 번 누름: onOpenRow
 *   - 방향키, Home/End, PageUp/PageDown: 칸 이동 (선택은 바뀌지 않음)
 *   - Enter: 행 선택 + onOpenRow, Space: 행 선택, Delete: onDeleteRow
 *   - 칸 안의 버튼(📷, 접기)을 누르면 행 선택은 일어나지 않는다.
 */

export interface SheetColumn<T> {
  id: string;
  /** 1행에 표시되는 머리글 이름. */
  header: string;
  /** 열 폭(px). 표가 컨테이너보다 좁으면 비율대로 늘어난다. */
  width: number;
  /** 휴대폰(640px 이하)에서의 열 폭(px). 없으면 width. */
  phoneWidth?: number;
  align?: "left" | "center" | "right";
  /** 칸에 그릴 내용. */
  render: (row: T) => ReactNode;
  /** 수식 줄과 툴팁에 쓰는 텍스트. */
  text: (row: T) => string;
}

export interface SheetGridProps<T> {
  rows: T[];
  columns: SheetColumn<T>[];
  getRowId: (row: T) => string;
  /** 선택된 행(연한 파랑 바탕). */
  selectedRowId?: string | null;
  onSelectRow?: (row: T) => void;
  onOpenRow?: (row: T) => void;
  onDeleteRow?: (row: T) => void;
  /** 아래쪽 시트 탭에 쓰는 이름. */
  tabName: string;
  ariaLabel: string;
  /** 상태 막대(개수 등). */
  status: ReactNode;
  state?: "ready" | "loading" | "error";
  emptyText: string;
  errorText?: string;
  onRetry?: () => void;
}

const LOADING_ROWS = 3;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function SheetGrid<T>({
  rows,
  columns,
  getRowId,
  selectedRowId = null,
  onSelectRow,
  onOpenRow,
  onDeleteRow,
  tabName,
  ariaLabel,
  status,
  state = "ready",
  emptyText,
  errorText = "불러오지 못했습니다",
  onRetry,
}: SheetGridProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollToCell = useRef(false);
  const [cell, setCell] = useState({ r: 0, c: 0 });
  const [fill, setFill] = useState(0);

  const lastRow = rows.length - 1;
  const lastCol = columns.length - 1;
  const r = clamp(cell.r, 0, Math.max(0, lastRow));
  const c = clamp(cell.c, 0, lastCol);
  const activeRow: T | undefined = rows[r];

  // 데이터가 차지하는 행 수. 비어 있거나 불러오는 중이어도 안내 행이 자리를 쓴다.
  const bodyRows =
    state === "loading" ? LOADING_ROWS : state === "ready" ? Math.max(rows.length, 1) : 1;

  // ---- 보이는 높이만큼 빈 행 채우기 ----
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const css = getComputedStyle(el);
      const rowH = parseFloat(css.getPropertyValue("--xg-row-h")) || 24;
      const headH = parseFloat(css.getPropertyValue("--xg-head-h")) || 24;
      // 열 문자 행(headH) + 1행 머리글(rowH)을 뺀 나머지가 데이터 영역.
      const room = el.clientHeight - headH - rowH;
      const rowsFit = Math.floor(room / rowH);
      setFill(Math.max(0, rowsFit - bodyRows));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bodyRows]);

  // ---- 키보드로 옮긴 칸이 보이게 스크롤 ----
  useEffect(() => {
    if (!scrollToCell.current) return;
    scrollToCell.current = false;
    scrollerRef.current
      ?.querySelector(`td[data-r="${r}"][data-c="${c}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [r, c]);

  const move = (dr: number, dc: number) => {
    if (rows.length === 0) return;
    scrollToCell.current = true;
    setCell({
      r: clamp(r + dr, 0, lastRow),
      c: clamp(c + dc, 0, lastCol),
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // 칸 안의 버튼에서 온 키는 버튼이 처리한다.
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case "ArrowDown":
        move(1, 0);
        break;
      case "ArrowUp":
        move(-1, 0);
        break;
      case "ArrowRight":
        move(0, 1);
        break;
      case "ArrowLeft":
        move(0, -1);
        break;
      case "PageDown":
        move(10, 0);
        break;
      case "PageUp":
        move(-10, 0);
        break;
      case "Home":
        move(0, -lastCol);
        break;
      case "End":
        move(0, lastCol);
        break;
      case "Enter":
        if (activeRow !== undefined) {
          onSelectRow?.(activeRow);
          onOpenRow?.(activeRow);
        }
        break;
      case " ":
        if (activeRow !== undefined) onSelectRow?.(activeRow);
        break;
      case "Delete":
        if (activeRow !== undefined) onDeleteRow?.(activeRow);
        break;
      default:
        return; // 처리하지 않는 키는 브라우저 기본 동작에 맡긴다.
    }
    e.preventDefault();
  };

  const fromButton = (e: MouseEvent) =>
    (e.target as HTMLElement).closest("button") !== null;

  const handleCellClick = (e: MouseEvent, ri: number, ci: number) => {
    setCell({ r: ri, c: ci });
    if (fromButton(e)) return;
    scrollerRef.current?.focus({ preventScroll: true });
    onSelectRow?.(rows[ri]);
  };

  const handleCellDoubleClick = (e: MouseEvent, ri: number) => {
    if (fromButton(e)) return;
    onOpenRow?.(rows[ri]);
  };

  const fillStart = bodyRows + 2;
  // 열 폭의 합. 표 폭을 내용 길이가 아니라 열 폭으로 정하려고 CSS 변수로 넘긴다.
  const widthSum = columns.reduce((sum, col) => sum + col.width, 0);
  const phoneWidthSum = columns.reduce(
    (sum, col) => sum + (col.phoneWidth ?? col.width),
    0,
  );

  return (
    <div className="xg" data-sheet>
      <div className="xg-fbar">
        <span className="xg-name" aria-live="polite">
          {activeRow !== undefined ? cellAddress(r, c) : "–"}
        </span>
        <span className="xg-fx" aria-hidden="true">
          fx
        </span>
        <span className="xg-val">
          {activeRow !== undefined ? columns[c].text(activeRow) : ""}
        </span>
      </div>

      <div
        className="xg-scroll"
        ref={scrollerRef}
        tabIndex={0}
        aria-label={`${ariaLabel}. 방향키로 칸을 옮기고 Enter로 엽니다.`}
        onKeyDown={handleKeyDown}
      >
        <table
          role="grid"
          style={
            {
              "--sum": `${widthSum}px`,
              "--sum-p": `${phoneWidthSum}px`,
            } as CSSProperties
          }
          aria-label={ariaLabel}
          aria-rowcount={rows.length + 1}
          aria-colcount={columns.length}
        >
          <colgroup>
            <col className="rn" />
            {columns.map((col) => (
              <col
                key={col.id}
                style={
                  {
                    "--w": `${col.width}px`,
                    "--wp": `${col.phoneWidth ?? col.width}px`,
                  } as CSSProperties
                }
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="corner" aria-hidden="true" />
              {columns.map((col, ci) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-hidden="true"
                  className={ci === c && activeRow !== undefined ? "on" : undefined}
                >
                  {columnLetter(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="hd">
              <th className="rn" scope="row">
                1
              </th>
              {columns.map((col) => (
                <td
                  key={col.id}
                  role="columnheader"
                  className={col.align ? `a-${col.align}` : undefined}
                >
                  {col.header}
                </td>
              ))}
            </tr>

            {state === "ready" &&
              rows.map((row, ri) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    data-row-id={id}
                    aria-selected={id === selectedRowId}
                    aria-rowindex={ri + 2}
                  >
                    <th className={ri === r ? "rn on" : "rn"} scope="row">
                      {ri + 2}
                    </th>
                    {columns.map((col, ci) => {
                      const cls = [
                        col.align ? `a-${col.align}` : "",
                        ri === r && ci === c ? "sel" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <td
                          key={col.id}
                          data-r={ri}
                          data-c={ci}
                          role="gridcell"
                          className={cls || undefined}
                          title={col.text(row)}
                          onClick={(e) => handleCellClick(e, ri, ci)}
                          onDoubleClick={(e) => handleCellDoubleClick(e, ri)}
                        >
                          {col.render(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {state === "loading" &&
              Array.from({ length: LOADING_ROWS }, (_, i) => (
                <tr key={`load-${i}`} aria-hidden="true">
                  <th className="rn" scope="row">
                    {i + 2}
                  </th>
                  {columns.map((col, ci) => (
                    <td key={col.id}>
                      <span className={ci === 0 ? "skel w80" : "skel w60"} />
                    </td>
                  ))}
                </tr>
              ))}

            {state === "error" && (
              <tr>
                <th className="rn" scope="row">
                  2
                </th>
                <td colSpan={columns.length} className="xg-note">
                  <span className="err" role="alert">
                    <Icon name="alert" />
                    {errorText}
                    {onRetry ? (
                      <button
                        type="button"
                        className="btn btn-t sm"
                        onClick={onRetry}
                      >
                        다시 시도
                      </button>
                    ) : null}
                  </span>
                </td>
              </tr>
            )}

            {state === "ready" && rows.length === 0 && (
              <tr>
                <th className="rn" scope="row">
                  2
                </th>
                <td colSpan={columns.length} className="xg-note">
                  {emptyText}
                </td>
              </tr>
            )}

            {Array.from({ length: fill }, (_, i) => (
              <tr key={`fill-${i}`} aria-hidden="true">
                <th className="rn">{fillStart + i}</th>
                {columns.map((col) => (
                  <td key={col.id} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="xg-tabs" role="list">
        <span className="xg-tab" role="listitem" aria-current="true">
          {tabName}
        </span>
      </div>
      <div className="xg-status">{status}</div>
    </div>
  );
}
