import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "./social-platform-types";

const getSocialPostById = vi.fn();
const requestSocialPostApproval = vi.fn();
const approveSocialPostInRepository = vi.fn();
const rejectSocialPostInRepository = vi.fn();
const revokeSocialPostApprovalInRepository = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  requestSocialPostApproval: (...args: unknown[]) => requestSocialPostApproval(...args),
  approveSocialPost: (...args: unknown[]) => approveSocialPostInRepository(...args),
  rejectSocialPost: (...args: unknown[]) => rejectSocialPostInRepository(...args),
  revokeSocialPostApproval: (...args: unknown[]) => revokeSocialPostApprovalInRepository(...args),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { requestApproval, approveSocialPost, rejectSocialPost, revokeApproval } = await import(
  "./social-post-approval-service"
);

function makeSocialPost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "social-post-1",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "충분히 긴 본문 내용입니다.",
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
    qualitySummary: { checklist: [{ key: "content_present", status: "pass" }] },
    approvalStatus: "not_requested",
    approvedBy: null,
    approvedAt: null,
    publishStatus: "not_published",
    externalPostId: null,
    postUrl: null,
    exportFormat: null,
    exportPayload: {},
    errorMessage: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
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
    ...overrides,
  };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  requestSocialPostApproval.mockReset();
  approveSocialPostInRepository.mockReset();
  rejectSocialPostInRepository.mockReset();
  revokeSocialPostApprovalInRepository.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("requestApproval", () => {
  it("승인을 요청하면 repository의 requestSocialPostApproval을 호출한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    requestSocialPostApproval.mockResolvedValue(makeSocialPost({ approvalStatus: "pending_review" }));

    const result = await requestApproval("social-post-1", "검토 부탁드립니다");

    expect(result.success).toBe(true);
    expect(requestSocialPostApproval).toHaveBeenCalledWith("social-post-1", "검토 부탁드립니다");
  });
});

describe("approveSocialPost", () => {
  it("quality_status가 ready이면 승인이 가능하다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "ready" }));
    approveSocialPostInRepository.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(true);
    expect(approveSocialPostInRepository).toHaveBeenCalledWith("social-post-1", "editor", null);
  });

  it("Phase 3-25: quality_status가 needs_revision이어도 checklist에 blocked/fail 항목이 없으면(경고만 있으면) 승인을 허용한다", async () => {
    // "확인 필요" 수준(경고만 있는 needs_revision)은 사람이 화면에서
    // 확인한 뒤 바로 승인할 수 있어야 한다 — quality_status가 정확히
    // 'ready'가 아니라는 이유만으로 승인을 막지 않는다.
    getSocialPostById.mockResolvedValue(
      makeSocialPost({
        qualityStatus: "needs_revision",
        qualitySummary: { checklist: [{ key: "length_check", status: "warning" }] },
      })
    );
    approveSocialPostInRepository.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(true);
    expect(approveSocialPostInRepository).toHaveBeenCalled();
  });

  it("quality_status가 needs_revision이고 checklist에 fail 항목이 있으면(수정 필요) 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(
      makeSocialPost({
        qualityStatus: "needs_revision",
        qualitySummary: { checklist: [{ key: "wordpress_blog_body_depth", status: "fail" }] },
      })
    );

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
    expect(approveSocialPostInRepository).not.toHaveBeenCalled();
  });

  it("quality_status가 not_checked이면(아직 자동 검토 전) 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "not_checked", qualitySummary: {} }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
    expect(result.message).toContain("자동 검토");
    expect(approveSocialPostInRepository).not.toHaveBeenCalled();
  });

  it("quality_status가 failed이면(자동 검토 실행 실패) 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "failed", qualitySummary: {} }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
    expect(approveSocialPostInRepository).not.toHaveBeenCalled();
  });

  it("quality_status가 blocked이면 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ qualityStatus: "blocked" }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
    expect(approveSocialPostInRepository).not.toHaveBeenCalled();
  });

  it("publish_status가 blocked이면 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ publishStatus: "blocked" }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
  });

  it("이미 approved 상태면 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
  });

  it("quality gate 결과에 blocked/fail 체크리스트가 있으면 승인을 거부한다", async () => {
    getSocialPostById.mockResolvedValue(
      makeSocialPost({ qualitySummary: { checklist: [{ key: "no_threat_language", status: "blocked" }] } })
    );

    const result = await approveSocialPost("social-post-1", "editor");

    expect(result.success).toBe(false);
    expect(approveSocialPostInRepository).not.toHaveBeenCalled();
  });
});

describe("rejectSocialPost", () => {
  it("반려 성공 시 social_post_approvals에 rejected 기록을 남긴다 (repository 호출)", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    rejectSocialPostInRepository.mockResolvedValue(makeSocialPost({ approvalStatus: "rejected" }));

    const result = await rejectSocialPost("social-post-1", "editor", "문체가 부적절합니다");

    expect(result.success).toBe(true);
    expect(rejectSocialPostInRepository).toHaveBeenCalledWith("social-post-1", "editor", "문체가 부적절합니다");
  });

  it("사유가 없으면 반려를 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());

    const result = await rejectSocialPost("social-post-1", "editor", "");

    expect(result.success).toBe(false);
    expect(rejectSocialPostInRepository).not.toHaveBeenCalled();
  });
});

describe("revokeApproval", () => {
  it("승인된 post의 승인을 취소하면 social_post_approvals에 revoked 기록을 남긴다 (repository 호출)", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));
    revokeSocialPostApprovalInRepository.mockResolvedValue(makeSocialPost({ approvalStatus: "revoked" }));

    const result = await revokeApproval("social-post-1", "editor", "재검토 필요");

    expect(result.success).toBe(true);
    expect(revokeSocialPostApprovalInRepository).toHaveBeenCalledWith("social-post-1", "editor", "재검토 필요");
  });

  it("approved 상태가 아니면 승인 취소를 거부한다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ approvalStatus: "not_requested" }));

    const result = await revokeApproval("social-post-1", "editor", "재검토 필요");

    expect(result.success).toBe(false);
    expect(revokeSocialPostApprovalInRepository).not.toHaveBeenCalled();
  });
});

describe("보안 요구사항", () => {
  it("logs에 API key/auth token/full post_body가 저장되지 않는다", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost());
    approveSocialPostInRepository.mockResolvedValue(makeSocialPost({ approvalStatus: "approved" }));
    await approveSocialPost("social-post-1", "editor");

    const serialized = JSON.stringify(logEvent.mock.calls).toLowerCase();
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("app_password");
    expect(serialized).not.toContain("충분히 긴 본문");
  });
});
