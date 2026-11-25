import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheetGrid, type SheetColumn } from "../SheetGrid";

interface Row {
  id: string;
  name: string;
  place: string;
}

const rows: Row[] = [
  { id: "r1", name: "드라이버", place: "공구함" },
  { id: "r2", name: "구급상자", place: "거실" },
  { id: "r3", name: "텐트", place: "베란다" },
];

const columns: SheetColumn<Row>[] = [
  { id: "name", header: "물건", width: 120, render: (r) => r.name, text: (r) => r.name },
  {
    id: "place",
    header: "보관위치",
    width: 120,
    render: (r) => (
      <>
        {r.place}
        <button type="button">보기</button>
      </>
    ),
    text: (r) => r.place,
  },
];

function setup(over: Partial<React.ComponentProps<typeof SheetGrid<Row>>> = {}) {
  const props = {
    rows,
    columns,
    getRowId: (r: Row) => r.id,
    tabName: "물품",
    ariaLabel: "테스트 표",
    status: <span>상태</span>,
    emptyText: "비어 있습니다",
    onSelectRow: vi.fn(),
    onOpenRow: vi.fn(),
    onDeleteRow: vi.fn(),
    ...over,
  };
  const utils = render(<SheetGrid<Row> {...props} />);
  const scroller = utils.container.querySelector(".xg-scroll") as HTMLElement;
  const address = () => utils.container.querySelector(".xg-name")!.textContent;
  return { ...utils, props, scroller, address };
}

describe("SheetGrid", () => {
  it("열 문자, 1행 머리글, 2행부터 데이터 행 번호를 그린다", () => {
    const { container } = setup();
    const letters = Array.from(container.querySelectorAll("thead th:not(.corner)")).map(
      (th) => th.textContent,
    );
    expect(letters).toEqual(["A", "B"]);
    expect(screen.getByText("보관위치")).toBeTruthy();
    const rowNumbers = Array.from(container.querySelectorAll("tbody tr[data-row-id] th.rn")).map(
      (th) => th.textContent,
    );
    expect(rowNumbers).toEqual(["2", "3", "4"]);
  });

  it("칸을 누르면 그 행을 선택한다", () => {
    const { container, props } = setup();
    fireEvent.click(container.querySelector('td[data-r="1"][data-c="0"]')!);
    expect(props.onSelectRow).toHaveBeenCalledWith(rows[1]);
  });

  it("칸 안의 버튼을 누르면 행 선택은 일어나지 않는다", () => {
    const { props } = setup();
    fireEvent.click(screen.getAllByText("보기")[0]);
    expect(props.onSelectRow).not.toHaveBeenCalled();
  });

  it("방향키로 칸을 옮기고 수식 줄에 주소가 보인다", () => {
    const { scroller, address } = setup();
    expect(address()).toBe("A2");
    fireEvent.keyDown(scroller, { key: "ArrowRight" });
    expect(address()).toBe("B2");
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    expect(address()).toBe("B3");
    // 가장자리를 넘지 않는다.
    fireEvent.keyDown(scroller, { key: "ArrowRight" });
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    expect(address()).toBe("B4");
  });

  it("방향키는 선택을 바꾸지 않고, Enter가 선택과 열기를 일으킨다", () => {
    const { scroller, props } = setup();
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    expect(props.onSelectRow).not.toHaveBeenCalled();
    fireEvent.keyDown(scroller, { key: "Enter" });
    expect(props.onSelectRow).toHaveBeenCalledWith(rows[1]);
    expect(props.onOpenRow).toHaveBeenCalledWith(rows[1]);
  });

  it("Delete 키는 onDeleteRow를 부른다", () => {
    const { scroller, props } = setup();
    fireEvent.keyDown(scroller, { key: "Delete" });
    expect(props.onDeleteRow).toHaveBeenCalledWith(rows[0]);
  });

  it("버튼에서 올라온 키 입력은 표가 가로채지 않는다", () => {
    const { props } = setup();
    fireEvent.keyDown(screen.getAllByText("보기")[0], { key: "Enter" });
    expect(props.onSelectRow).not.toHaveBeenCalled();
  });

  it("선택한 행은 aria-selected=true", () => {
    const { container } = setup({ selectedRowId: "r2" });
    expect(container.querySelector('tr[data-row-id="r2"]')!.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('tr[data-row-id="r1"]')!.getAttribute("aria-selected")).toBe("false");
  });

  it("행이 없으면 빈 상태 문장을 보여 준다", () => {
    setup({ rows: [] });
    expect(screen.getByText("비어 있습니다")).toBeTruthy();
  });

  it("오류 상태에서는 문장과 다시 시도 버튼을 보여 준다", () => {
    const onRetry = vi.fn();
    setup({ state: "error", errorText: "불러오지 못했습니다", onRetry });
    expect(screen.getByText("불러오지 못했습니다")).toBeTruthy();
    fireEvent.click(screen.getByText("다시 시도"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
