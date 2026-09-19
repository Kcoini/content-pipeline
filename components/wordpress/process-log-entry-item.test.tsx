import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProcessLogEntryItem } from "./process-log-entry-item";
import type { WordPressBlogProcessLogEntry } from "@/lib/social/wordpress-blog-process-log-view";

function makeEntry(overrides: Partial<WordPressBlogProcessLogEntry> = {}): WordPressBlogProcessLogEntry {
  return {
    id: "log-1",
    eventName: "blog_post_wordpress_draft_requested",
    status: "success",
    message: "Draft 생성 완료",
    createdAt: "2026-09-19T00:00:00.000Z",
    socialPostId: "post-1",
    category: "wordpress",
    detailsSummary: "socialPostId=post-1",
    rawDetails: { socialPostId: "post-1", guardScore: 82, ready: false },
    ...overrides,
  };
}

describe("ProcessLogEntryItem", () => {
  it("상세 JSON 보기는 기본 닫힘이다(open 속성 없음)", () => {
    const html = renderToStaticMarkup(<ProcessLogEntryItem entry={makeEntry()} />);
    expect(html).toContain("상세 JSON 보기");
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("QA-01-FIX1: guard가 정상적으로 blocked 결과를 낸 로그(status=success)는 '차단됨'으로 표시되고, raw 'success'/'failed' 영단어를 그대로 보여주지 않는다", () => {
    const html = renderToStaticMarkup(
      <ProcessLogEntryItem entry={makeEntry({ eventName: "social_platform_publish_guard_blocked", status: "success" })} />
    );

    expect(html).toContain("차단됨");
    expect(html).not.toContain(">success<");
    expect(html).not.toContain(">failed<");
  });

  it("guard 실행 자체가 예외로 실패한 로그(social_platform_publish_guard_failed, status=failed)는 '실패'로 표시된다", () => {
    const html = renderToStaticMarkup(
      <ProcessLogEntryItem entry={makeEntry({ eventName: "social_platform_publish_guard_failed", status: "failed" })} />
    );

    expect(html).toContain("실패");
  });

  it("guard와 무관한 일반 로그가 실행 자체 실패(status=failed)면 '처리 실패'로 표시된다(raw failed 노출 없음)", () => {
    const html = renderToStaticMarkup(
      <ProcessLogEntryItem entry={makeEntry({ eventName: "blog_post_wordpress_draft_requested", status: "failed" })} />
    );

    expect(html).toContain("처리 실패");
    expect(html).not.toContain(">failed<");
  });

  it("rawDetails는 details 안(상세 JSON 보기)에서만 존재한다 — guardScore/ready 같은 raw 값이 접힘 밖에는 없다", () => {
    const html = renderToStaticMarkup(<ProcessLogEntryItem entry={makeEntry()} />);
    const beforeDetails = html.split("<details")[0];
    expect(beforeDetails).not.toContain("guardScore");
    expect(beforeDetails).not.toContain("ready");
  });
});
