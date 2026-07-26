import { describe, expect, it } from "vitest";
import { mapPublishLogRow } from "./publish-repository";
import type { PublishLogRow } from "@/lib/supabase/database.types";

function makePublishLogRow(overrides: Partial<PublishLogRow> = {}): PublishLogRow {
  return {
    id: "publish-1",
    article_id: "article-1",
    status: "success",
    target: "wordpress",
    details: {},
    published_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    external_post_id: "42",
    post_url: "https://example-blog.test/?p=42",
    error_message: null,
    details_json: {},
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapPublishLogRow", () => {
  it("publish_logs row를 PublishLogEntry로 변환한다", () => {
    const entry = mapPublishLogRow(makePublishLogRow());

    expect(entry).toEqual({
      id: "publish-1",
      articleId: "article-1",
      target: "wordpress",
      status: "success",
      externalPostId: "42",
      postUrl: "https://example-blog.test/?p=42",
      errorMessage: null,
      details: {},
      publishedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("dry_run 상태를 그대로 매핑한다", () => {
    const entry = mapPublishLogRow(
      makePublishLogRow({ status: "dry_run", external_post_id: null, post_url: null, published_at: null })
    );

    expect(entry.status).toBe("dry_run");
    expect(entry.externalPostId).toBeNull();
    expect(entry.postUrl).toBeNull();
  });

  it("failed 상태이면 error_message를 그대로 매핑한다", () => {
    const entry = mapPublishLogRow(
      makePublishLogRow({ status: "failed", error_message: "WordPress 인증 실패", external_post_id: null, post_url: null })
    );

    expect(entry.status).toBe("failed");
    expect(entry.errorMessage).toBe("WordPress 인증 실패");
  });

  it("details_json을 details보다 우선 사용한다 (Phase 2-8)", () => {
    const entry = mapPublishLogRow(
      makePublishLogRow({ details: { legacy: true }, details_json: { statusCode: 401 } })
    );

    expect(entry.details).toEqual({ statusCode: 401 });
  });

  it("details_json이 비어있으면 details로 fallback한다 (과거 데이터 호환)", () => {
    const entry = mapPublishLogRow(makePublishLogRow({ details: { legacy: true }, details_json: {} }));

    expect(entry.details).toEqual({ legacy: true });
  });
});
