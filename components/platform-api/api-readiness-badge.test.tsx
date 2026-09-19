import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiReadinessBadge } from "./api-readiness-badge";

describe("ApiReadinessBadge", () => {
  it("각 status에 대해 한글 라벨을 렌더링한다", () => {
    expect(renderToStaticMarkup(<ApiReadinessBadge status="disabled" />)).toContain("비활성화됨");
    expect(renderToStaticMarkup(<ApiReadinessBadge status="blocked" />)).toContain("차단됨");
  });

  it("Phase UX-04B: 'dry-run'/'test' 같은 기술 용어 대신 실제 의미를 설명하는 한국어 문구를 쓴다(H2 해결)", () => {
    expect(renderToStaticMarkup(<ApiReadinessBadge status="dry_run_ready" />)).toContain("연결 확인 가능");
    expect(renderToStaticMarkup(<ApiReadinessBadge status="ready_for_future_test" />)).toContain("실제 게시 기능 준비 중");
    const html = renderToStaticMarkup(<ApiReadinessBadge status="dry_run_ready" />) + renderToStaticMarkup(<ApiReadinessBadge status="ready_for_future_test" />);
    expect(html).not.toContain("Dry-run");
    expect(html).not.toContain("dry-run");
    expect(html).not.toContain("test");
  });
});
