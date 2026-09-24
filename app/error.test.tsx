import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GlobalError from "./error";

describe("PRODUCT-01G: app/error.tsx (전역 error boundary)", () => {
  it("raw Error.message 대신 친화 문구를 보여주고, '다시 시도'/복귀 링크를 제공한다", () => {
    const error = Object.assign(new Error("Cannot read properties of undefined (reading 'foo')"), { digest: "abc123" });
    const html = renderToStaticMarkup(<GlobalError error={error} reset={vi.fn()} />);
    expect(html).toContain("문제가 발생했습니다.");
    expect(html).not.toContain("Cannot read properties of undefined");
    expect(html).toContain("다시 시도");
    expect(html).toContain("내 콘텐츠로 돌아가기");
  });

  it("사람이 쓴 도메인 메시지는 그대로 보여준다(과도하게 감추지 않는다)", () => {
    const error = new Error("이미 삭제된 항목입니다.");
    const html = renderToStaticMarkup(<GlobalError error={error} reset={vi.fn()} />);
    expect(html).toContain("이미 삭제된 항목입니다.");
  });

  it("보장할 수 없는 데이터 보존 문구를 추측해서 넣지 않는다", () => {
    const error = new Error("문제 발생");
    const html = renderToStaticMarkup(<GlobalError error={error} reset={vi.fn()} />);
    expect(html).not.toContain("안전하게 저장되어 있습니다");
  });

  it("error.digest는 짧은 참조 번호로만 보여주고(DB UUID 아님), 기본은 접힘 상태다(AdvancedDetails 재사용)", () => {
    const error = Object.assign(new Error("문제 발생"), { digest: "abc123" });
    const html = renderToStaticMarkup(<GlobalError error={error} reset={vi.fn()} />);
    expect(html).toContain("abc123");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
  });
});
