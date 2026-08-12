import { describe, expect, it } from "vitest";
import { buildManualPostingChecklist } from "./platform-manual-posting-checklist-builder";
import { SOCIAL_PLATFORMS } from "./social-platform-types";
import type { SocialPost } from "./social-platform-types";

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "본문",
    caption: null,
    excerpt: null,
    hashtags: [],
    threadItems: [],
    cardItems: [],
    mediaRequirements: {},
    platformMetadata: {},
    generationContext: {},
    qualityStatus: "ready",
    qualityScore: 90,
    qualitySummary: {},
    approvalStatus: "approved",
    approvedBy: "editor",
    approvedAt: null,
    publishStatus: "exported",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    editedAt: null,
    editedBy: null,
    reviewNotes: null,
    revisionCount: 0,
    lastQualityCheckedAt: null,
    approvalRequestedAt: null,
    rejectionReason: null,
    revokedAt: null,
    revokedReason: null,
    exportStatus: "exported",
    exportedAt: null,
    exportedBy: null,
    exportError: null,
    exportCopyCount: 0,
    lastCopiedAt: null,
    exportNotes: null,
    platformPublishGuardStatus: "ready",
    platformPublishGuardScore: 95,
    platformPublishGuardSummary: {},
    platformPublishGuardError: null,
    platformPublishGuardCheckedAt: null,
    platformPublishReady: true,
    platformPublishBlockedReason: null,
    platformPublishDryRunStatus: "ready",
    platformPublishDryRunPayload: {},
    platformPublishDryRunError: null,
    platformPublishDryRunCreatedAt: null,
    platformPublishDryRunCreatedBy: null,
    handoffStatus: "completed",
    handoffPayload: {},
    handoffNotes: null,
    handoffCompletedAt: null,
    handoffCompletedBy: null,
    handoffError: null,
    manualPostStatus: "not_recorded",
    manualPostUrl: null,
    manualPostedAt: null,
    manualPostedBy: null,
    manualPostResultNotes: null,
    manualPostError: null,
    manualPostRecordedAt: null,
    manualPostRecordedBy: null,
    manualPostChecklist: [],
    ...overrides,
  };
}

describe("buildManualPostingChecklist", () => {
  it("모든 플랫폼에 대해 checklist를 생성한다", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const result = buildManualPostingChecklist(makeSocialPost({ platform }));
      expect(result.checklist.length).toBeGreaterThan(0);
      expect(result.platform).toBe(platform);
    }
  });

  it("공통 checklist 항목(quality gate/approval/handoff 등)을 포함한다", () => {
    const result = buildManualPostingChecklist(makeSocialPost());
    const keys = result.checklist.map((item) => item.key);
    expect(keys).toContain("quality_gate_ready");
    expect(keys).toContain("approval_approved");
    expect(keys).toContain("handoff_completed");
    expect(keys).toContain("record_url_after_posting");
  });

  it("x는 thread item 순서/글자 수 확인 항목을 포함한다", () => {
    const result = buildManualPostingChecklist(makeSocialPost({ platform: "x" }));
    const keys = result.checklist.map((item) => item.key);
    expect(keys).toContain("x_thread_order_check");
    expect(keys).toContain("x_item_length_check");
  });

  it("instagram은 이미지/카드뉴스 준비 확인 항목을 포함한다", () => {
    const result = buildManualPostingChecklist(makeSocialPost({ platform: "instagram" }));
    const keys = result.checklist.map((item) => item.key);
    expect(keys).toContain("instagram_media_ready_check");
  });

  it("handoff_status가 completed가 아니면 warning을 반환한다", () => {
    const result = buildManualPostingChecklist(makeSocialPost({ handoffStatus: "ready" }));
    expect(result.warnings.some((w) => w.includes("handoff"))).toBe(true);
  });

  it("platform_publish_dry_run_status가 ready가 아니면 warning을 반환한다", () => {
    const result = buildManualPostingChecklist(makeSocialPost({ platformPublishDryRunStatus: "not_created" }));
    expect(result.warnings.some((w) => w.includes("dry_run"))).toBe(true);
  });
});
