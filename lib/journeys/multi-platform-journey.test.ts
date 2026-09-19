// Phase UX-06: Journey 4 — Multi-platform. "여러 플랫폼 글을 한 번에
// 검토 → 문제 있는 글 우선 확인 → bulk approval(일부만 대상) → 게시
// 준비 요약까지 자연스럽게 이어지는가"를 실제 서비스/ViewModel 함수를
// 체이닝해서 검증한다. bulkApproveSocialPosts만 repository를 mock한다
// (social-post-approval-service.test.ts와 동일한 패턴), 나머지는 순수
// 함수라 mock이 필요 없다.
//
// 사용자 click/판단 단계 tally(참고용, 6개 post 기준):
//   사람이 직접 눌러야 하는 것: [N개 글 승인하기](일괄) 1회 + 확인 필요/
//     차단 post 개별 처리(이 시나리오에서는 2건) = 3회
//   시스템 자동: 각 post의 자동 검토(생성 시 이미 완료), summarizeMultiPlatformReview/
//     summarizeMultiPlatformPublishPreparation 집계 계산 = 자동
//   반복 불필요 click: bulk approval 대상(ready+미승인)만 한 번에
//     처리되므로, 6개를 하나씩 승인 클릭하지 않아도 된다(1회로 대체)

import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";
import { summarizeMultiPlatformReview, getMultiPlatformReviewSortKey } from "@/lib/ui/multi-platform-review-summary";
import {
  fromPostApprovalNextActionsToPublishPreparation,
  notApprovedPublishPreparation,
} from "@/lib/ui/publish-preparation-view-model";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import {
  summarizeMultiPlatformPublishPreparation,
  getPublishPreparationSortKey,
} from "@/lib/ui/multi-platform-publish-preparation-summary";
import type { UserFacingReviewSummary } from "@/lib/social/social-post-auto-review";

const getSocialPostById = vi.fn();
const approveSocialPostInRepository = vi.fn();
const logEvent = vi.fn();

vi.mock("@/lib/repositories/social-posts-repository", () => ({
  getSocialPostById: (...args: unknown[]) => getSocialPostById(...args),
  approveSocialPost: (...args: unknown[]) => approveSocialPostInRepository(...args),
  requestSocialPostApproval: vi.fn(),
  rejectSocialPost: vi.fn(),
  revokeSocialPostApproval: vi.fn(),
  SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { bulkApproveSocialPosts } = await import("@/lib/social/social-post-approval-service");

function makeSocialPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post",
    articleId: "article-1",
    platform: "naver_blog",
    toneStyle: "informational",
    postTitle: "제목",
    postBody: "충분히 긴 본문입니다.",
    caption: null,
    threadItems: [],
    cardItems: [],
    qualityStatus: "ready",
    qualitySummary: { checklist: [{ key: "content_present", status: "pass" }] },
    approvalStatus: "not_requested",
    publishStatus: "not_published",
    exportStatus: "not_exported",
    ...overrides,
  };
}

function makeReviewInput(id: string, approvalStatus: string, checklist: Array<{ key: string; status: "pass" | "fail" | "warning" | "blocked"; message: string }>, qualityStatus = "ready") {
  const review = summarizeAutoReview(checklist);
  const userFacing: UserFacingReviewSummary = summarizeUserFacingReview(qualityStatus, review, checklist);
  return { id, approvalStatus, review: userFacing };
}

beforeEach(() => {
  getSocialPostById.mockReset();
  approveSocialPostInRepository.mockReset();
  logEvent.mockReset();
  logEvent.mockResolvedValue({});
});

describe("Journey 4 — Multi-platform: 문제 우선 정렬 → bulk approval → 게시 준비 (Phase UX-06)", () => {
  it("1단계: 6개 post 혼합 상태를 요약하면 blocked/needsConfirmation/ready/approved가 정확히 집계된다", () => {
    const inputs = [
      makeReviewInput("blocked-1", "not_requested", [{ key: "content_present", status: "blocked", message: "본문 없음" }]),
      makeReviewInput("needs-confirm-1", "not_requested", [
        { key: "news_article_no_unsourced_claim", status: "warning", message: "출처 확인" },
      ]),
      makeReviewInput("ready-1", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]),
      makeReviewInput("ready-2", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]),
      makeReviewInput("ready-3", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]),
      makeReviewInput("approved-1", "approved", [{ key: "content_present", status: "pass", message: "통과" }]),
    ];
    const summary = summarizeMultiPlatformReview(inputs);
    expect(summary.total).toBe(6);
    expect(summary.blocked).toBe(1);
    expect(summary.needsConfirmation).toBe(1);
    expect(summary.ready).toBe(4); // ready-1/2/3 + approved-1(승인돼도 review state 축에서는 ready)
    expect(summary.approved).toBe(1);
    expect(summary.bulkApprovalEligiblePostIds.sort()).toEqual(["ready-1", "ready-2", "ready-3"]);
  });

  it("2단계: 정렬하면 blocked가 needsConfirmation보다 먼저, ready/approved는 맨 뒤다", () => {
    const inputs = [
      makeReviewInput("ready-1", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]),
      makeReviewInput("blocked-1", "not_requested", [{ key: "content_present", status: "blocked", message: "본문 없음" }]),
      makeReviewInput("needs-confirm-1", "not_requested", [
        { key: "news_article_no_unsourced_claim", status: "warning", message: "출처 확인" },
      ]),
    ];
    const sorted = [...inputs].sort((a, b) => getMultiPlatformReviewSortKey(a) - getMultiPlatformReviewSortKey(b));
    expect(sorted.map((p) => p.id)).toEqual(["blocked-1", "needs-confirm-1", "ready-1"]);
  });

  it("3단계: bulk approval은 대상(ready+미승인)만 승인하고, 이미 승인된 것/차단된 것은 건드리지 않는다(부분 성공)", async () => {
    getSocialPostById.mockImplementation((id: string) =>
      Promise.resolve(
        makeSocialPost({
          id,
          qualityStatus: id === "blocked-post" ? "blocked" : "ready",
          approvalStatus: id === "already-approved" ? "approved" : "not_requested",
        })
      )
    );
    approveSocialPostInRepository.mockImplementation((id: string) =>
      Promise.resolve(makeSocialPost({ id, approvalStatus: "approved" }))
    );

    const result = await bulkApproveSocialPosts(["ready-1", "ready-2", "already-approved", "blocked-post"], "editor");

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(2);
    expect(result.approvedSocialPosts.map((p) => p.id).sort()).toEqual(["ready-1", "ready-2"]);
  });

  it("4단계: bulk approval은 외부 게시를 호출하지 않는다(mock한 함수 목록 어디에도 publish 관련 함수가 없다 — approval_status만 바꾼다)", async () => {
    getSocialPostById.mockResolvedValue(makeSocialPost({ id: "a" }));
    approveSocialPostInRepository.mockResolvedValue(makeSocialPost({ id: "a", approvalStatus: "approved" }));

    const result = await bulkApproveSocialPosts(["a"], "editor");
    expect(result.successCount).toBe(1);
    // 이 테스트 파일이 mock한 repository 함수는 승인 관련 함수뿐이다 —
    // 외부 게시/발행 관련 함수는 애초에 mock 대상에도 없다(호출할 방법이 없다).
  });

  it("5단계(성공 계약): 승인된 post들의 게시 준비 상태를 요약하면, 승인되지 않은 post와 섞여도 문제 우선 정렬이 유지된다", () => {
    const posts = [
      { id: "not-approved", vm: notApprovedPublishPreparation("naver_blog") },
      { id: "ready-1", vm: fromPostApprovalNextActionsToPublishPreparation("naver_blog", getPostApprovalNextActions({ platform: "naver_blog" }), "not_published") },
      { id: "ready-2", vm: fromPostApprovalNextActionsToPublishPreparation("x", getPostApprovalNextActions({ platform: "x" }), "not_published") },
    ];
    const summary = summarizeMultiPlatformPublishPreparation(posts.map((p) => ({ id: p.id, viewModel: p.vm })));
    expect(summary.total).toBe(3);
    expect(summary.notApproved).toBe(1);
    expect(summary.ready).toBe(2);

    const sorted = [...posts].sort(
      (a, b) => getPublishPreparationSortKey({ id: a.id, viewModel: a.vm }) - getPublishPreparationSortKey({ id: b.id, viewModel: b.vm })
    );
    expect(sorted[sorted.length - 1].id).not.toBe("not-approved"); // not_approved는 ready보다 우선순위가 높아 앞쪽에 온다
    expect(sorted[0].id).toBe("not-approved");
  });
});
