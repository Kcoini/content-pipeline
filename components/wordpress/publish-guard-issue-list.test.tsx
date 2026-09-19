import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishGuardIssueList } from "./publish-guard-issue-list";

describe("PublishGuardIssueList", () => {
  it("issues가 비어 있으면 아무것도 렌더링하지 않는다", () => {
    const html = renderToStaticMarkup(<PublishGuardIssueList issues={[]} />);
    expect(html).toBe("");
  });

  it("blocked 사유 개수와 자연어 title/message를 보여준다", () => {
    const html = renderToStaticMarkup(
      <PublishGuardIssueList
        issues={[
          { key: "approval_status_approved", title: "아직 승인되지 않았습니다.", message: "먼저 검토·승인을 완료하세요." },
          { key: "content_present", title: "게시할 본문이 없습니다." },
        ]}
      />
    );

    expect(html).toContain("게시 전에 확인할 사항이 2개 있습니다.");
    expect(html).toContain("아직 승인되지 않았습니다.");
    expect(html).toContain("먼저 검토·승인을 완료하세요.");
    expect(html).toContain("게시할 본문이 없습니다.");
  });

  it("raw DB 필드명/checklist key를 화면 텍스트로 노출하지 않는다", () => {
    const html = renderToStaticMarkup(
      <PublishGuardIssueList issues={[{ key: "export_status_ready_or_exported", title: "수동 게시 준비 자료를 아직 만들지 않았습니다." }]} />
    );

    expect(html).not.toContain("export_status_ready_or_exported");
    expect(html).not.toContain("export_status");
  });
});
