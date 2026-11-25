import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../Dialog";

describe("Dialog", () => {
  it("제목으로 이름 붙은 대화상자를 그린다", () => {
    render(
      <Dialog title="물건 삭제" onClose={() => {}}>
        본문
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "물건 삭제" })).toBeTruthy();
    expect(screen.getByText("본문")).toBeTruthy();
  });

  it("× 버튼과 배경 클릭으로 닫힌다", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog title="제목" onClose={onClose}>
        본문
      </Dialog>,
    );
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector(".dlg-bg")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closeOnBackdrop=false이면 배경을 눌러도 닫히지 않는다", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Dialog title="제목" onClose={onClose} closeOnBackdrop={false}>
        본문
      </Dialog>,
    );
    fireEvent.click(container.querySelector(".dlg-bg")!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc는 가장 위에 열린 대화상자만 닫는다", () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Dialog title="아래" onClose={closeBottom}>
          a
        </Dialog>
        <Dialog title="위" onClose={closeTop}>
          b
        </Dialog>
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });

  it("onEscape가 있으면 Esc는 그것을 부른다 (× 버튼은 onClose)", () => {
    const onClose = vi.fn();
    const onEscape = vi.fn();
    render(
      <Dialog title="제목" onClose={onClose} onEscape={onEscape}>
        본문
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
