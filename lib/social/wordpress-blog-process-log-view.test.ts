import { describe, expect, it } from "vitest";
import {
  isWordPressBlogRelevantLog,
  buildWordPressBlogProcessLogEntries,
  filterWordPressBlogProcessLogEntries,
  filterWordPressBlogProcessLogEntriesByPost,
  sortWordPressBlogProcessLogEntriesForDisplay,
  summarizeWordPressBlogProcessLog,
  WORDPRESS_BLOG_LOG_CATEGORY_LABELS,
} from "./wordpress-blog-process-log-view";
import type { PipelineLogEntry } from "@/lib/repositories/log-repository";

function makeLog(overrides: Partial<PipelineLogEntry> = {}): PipelineLogEntry {
  return {
    id: "log-1",
    type: "blog_post_wordpress_draft_requested",
    status: "success",
    message: "Draft 생성 완료",
    details: { socialPostId: "post-1", platform: "wordpress_blog" },
    createdAt: "2026-08-20T07:00:00.000Z",
    ...overrides,
  };
}

describe("isWordPressBlogRelevantLog", () => {
  it("details.socialPostId가 wordpress_blog post 목록에 있으면 관련 로그로 판단한다", () => {
    const log = makeLog({ details: { socialPostId: "post-1" } });
    expect(isWordPressBlogRelevantLog(log, new Set(["post-1"]))).toBe(true);
  });

  it("details.platform이 wordpress_blog면 socialPostId가 목록에 없어도 관련 로그로 판단한다", () => {
    const log = makeLog({ details: { platform: "wordpress_blog" } });
    expect(isWordPressBlogRelevantLog(log, new Set())).toBe(true);
  });

  it("관련 없는 로그(다른 socialPostId, platform 없음)는 제외한다", () => {
    const log = makeLog({ details: { socialPostId: "post-other" } });
    expect(isWordPressBlogRelevantLog(log, new Set(["post-1"]))).toBe(false);
  });

  it("naver_blog platform 로그는 제외한다", () => {
    const log = makeLog({ details: { socialPostId: "post-2", platform: "naver_blog" } });
    expect(isWordPressBlogRelevantLog(log, new Set(["post-1"]))).toBe(false);
  });
});

describe("buildWordPressBlogProcessLogEntries", () => {
  it("wordpress_blog 관련 로그만 골라 표시용 형태로 변환한다", () => {
    const logs = [
      makeLog({ id: "log-1", details: { socialPostId: "post-1" } }),
      makeLog({ id: "log-2", details: { socialPostId: "post-other" } }),
    ];
    const entries = buildWordPressBlogProcessLogEntries(logs, new Set(["post-1"]));
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("log-1");
    expect(entries[0].socialPostId).toBe("post-1");
  });

  it("event type에 draft가 있으면 wordpress 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "blog_post_wordpress_draft_requested" })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("wordpress");
  });

  it("event type에 seo가 있으면 seo 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "wordpress_blog_seo_plugin_write_completed" })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("seo");
  });

  it("event type에 featured_image가 있으면 image 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "blog_post_featured_image_uploaded" })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("image");
  });

  it("event type에 guard가 있으면 publish_guard 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "platform_publishing_guard_checked" as PipelineLogEntry["type"] })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("publish_guard");
  });

  it("event type에 handoff/checklist/manual_posting이 있으면 handoff 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "blog_post_manual_checklist_item_confirmed" })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("handoff");
  });

  it("분류되지 않는 event type은 other 카테고리로 분류한다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ type: "wordpress_blog_metadata_regenerated" })],
      new Set(["post-1"])
    );
    expect(entry.category).toBe("other");
  });

  it("details를 raw JSON 그대로 노출하지 않고 짧은 한 줄 요약으로 만든다", () => {
    const [entry] = buildWordPressBlogProcessLogEntries(
      [makeLog({ details: { socialPostId: "post-1", mediaId: 42, hasUrl: true } })],
      new Set(["post-1"])
    );
    expect(entry.detailsSummary).toContain("mediaId=42");
    expect(entry.detailsSummary).not.toContain("socialPostId");
    expect(entry.rawDetails).toEqual({ socialPostId: "post-1", mediaId: 42, hasUrl: true });
  });
});

describe("filterWordPressBlogProcessLogEntries", () => {
  const entries = buildWordPressBlogProcessLogEntries(
    [
      makeLog({ id: "log-1", type: "blog_post_wordpress_draft_requested", status: "success" }),
      makeLog({ id: "log-2", type: "wordpress_blog_seo_plugin_write_completed", status: "failed" }),
      makeLog({ id: "log-3", type: "blog_post_featured_image_uploaded", status: "success" }),
    ],
    new Set(["post-1"])
  );

  it("all이면 전체를 반환한다", () => {
    expect(filterWordPressBlogProcessLogEntries(entries, "all")).toHaveLength(3);
  });

  it("카테고리로 필터링한다", () => {
    expect(filterWordPressBlogProcessLogEntries(entries, "seo")).toHaveLength(1);
    expect(filterWordPressBlogProcessLogEntries(entries, "image")).toHaveLength(1);
  });

  it("failed_only는 status=failed인 로그만 남긴다", () => {
    const failed = filterWordPressBlogProcessLogEntries(entries, "failed_only");
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe("log-2");
  });
});

describe("filterWordPressBlogProcessLogEntriesByPost", () => {
  it("특정 socialPostId의 로그만 남긴다", () => {
    const entries = buildWordPressBlogProcessLogEntries(
      [
        makeLog({ id: "log-1", details: { socialPostId: "post-1" } }),
        makeLog({ id: "log-2", details: { socialPostId: "post-2" } }),
      ],
      new Set(["post-1", "post-2"])
    );
    const filtered = filterWordPressBlogProcessLogEntriesByPost(entries, "post-1");
    expect(filtered.map((e) => e.id)).toEqual(["log-1"]);
  });
});

describe("summarizeWordPressBlogProcessLog", () => {
  it("로그가 없으면 count=0, lastRunAt/lastStatus는 null이다", () => {
    expect(summarizeWordPressBlogProcessLog([])).toEqual({ count: 0, lastRunAt: null, lastStatus: null });
  });

  it("로그가 있으면 개수/가장 최근(첫 항목) 시간과 상태를 반환한다", () => {
    const entries = buildWordPressBlogProcessLogEntries(
      [
        makeLog({ id: "log-1", createdAt: "2026-08-20T07:10:00.000Z", status: "failed" }),
        makeLog({ id: "log-2", createdAt: "2026-08-20T07:00:00.000Z", status: "success" }),
      ],
      new Set(["post-1"])
    );
    expect(summarizeWordPressBlogProcessLog(entries)).toEqual({
      count: 2,
      lastRunAt: "2026-08-20T07:10:00.000Z",
      lastStatus: "failed",
    });
  });
});

describe("sortWordPressBlogProcessLogEntriesForDisplay", () => {
  it("실패 로그가 없으면 원래 순서를 그대로 유지한다", () => {
    const entries = buildWordPressBlogProcessLogEntries(
      [makeLog({ id: "log-1", status: "success" }), makeLog({ id: "log-2", status: "info" })],
      new Set(["post-1"])
    );
    expect(sortWordPressBlogProcessLogEntriesForDisplay(entries).map((e) => e.id)).toEqual(["log-1", "log-2"]);
  });

  it("실패 로그가 있으면 앞으로 모으고 나머지는 원래 순서를 유지한다", () => {
    const entries = buildWordPressBlogProcessLogEntries(
      [
        makeLog({ id: "log-1", status: "success" }),
        makeLog({ id: "log-2", status: "failed" }),
        makeLog({ id: "log-3", status: "success" }),
        makeLog({ id: "log-4", status: "failed" }),
      ],
      new Set(["post-1"])
    );
    expect(sortWordPressBlogProcessLogEntriesForDisplay(entries).map((e) => e.id)).toEqual(["log-2", "log-4", "log-1", "log-3"]);
  });
});

describe("WORDPRESS_BLOG_LOG_CATEGORY_LABELS", () => {
  it("6개 카테고리 라벨을 정의한다", () => {
    expect(Object.keys(WORDPRESS_BLOG_LOG_CATEGORY_LABELS)).toEqual([
      "wordpress",
      "seo",
      "image",
      "publish_guard",
      "handoff",
      "other",
    ]);
  });
});
