import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiReadinessBadge } from "./api-readiness-badge";

describe("ApiReadinessBadge", () => {
  it("각 status에 대해 한글 라벨을 렌더링한다", () => {
    expect(renderToStaticMarkup(<ApiReadinessBadge status="disabled" />)).toContain("비활성화됨");
    expect(renderToStaticMarkup(<ApiReadinessBadge status="dry_run_ready" />)).toContain("Dry-run 준비됨");
    expect(renderToStaticMarkup(<ApiReadinessBadge status="blocked" />)).toContain("차단됨");
  });
});
