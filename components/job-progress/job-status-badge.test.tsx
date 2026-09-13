import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JobStatusBadge } from "./job-status-badge";

describe("JobStatusBadge 렌더링", () => {
  it("raw status 대신 한국어 라벨을 보여준다", () => {
    const html = renderToStaticMarkup(<JobStatusBadge status="running" />);
    expect(html).toContain("진행 중");
    expect(html).not.toContain(">running<");
  });

  it("raw status는 title 속성에만 남긴다", () => {
    const html = renderToStaticMarkup(<JobStatusBadge status="waiting_user" />);
    expect(html).toContain('title="waiting_user"');
    expect(html).toContain("확인 필요");
  });

  it("알 수 없는 status도 예외 없이 원본 값을 보여준다", () => {
    const html = renderToStaticMarkup(<JobStatusBadge status="new_unknown_status" />);
    expect(html).toContain("new_unknown_status");
  });
});
