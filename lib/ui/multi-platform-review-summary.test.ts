import { describe, expect, it } from "vitest";
import { summarizeMultiPlatformReview, getMultiPlatformReviewSortKey, type MultiPlatformReviewPostInput } from "./multi-platform-review-summary";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";

function makePost(
  id: string,
  approvalStatus: string,
  checklist: Array<{ key: string; status: "pass" | "fail" | "warning" | "blocked"; message: string }>,
  qualityStatus = "ready"
): MultiPlatformReviewPostInput {
  const review = summarizeAutoReview(checklist);
  return { id, approvalStatus, review: summarizeUserFacingReview(qualityStatus, review, checklist) };
}

describe("summarizeMultiPlatformReview (Phase UX-04B)", () => {
  it("total은 전체 post 개수다", () => {
    const posts = [makePost("a", "not_requested", []), makePost("b", "not_requested", [])];
    expect(summarizeMultiPlatformReview(posts).total).toBe(2);
  });

  it("checking 계산: qualityStatus=not_checked인 post 개수", () => {
    const posts = [makePost("a", "not_requested", [], "not_checked")];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.checking).toBe(1);
    expect(summary.checkingPostIds).toEqual(["a"]);
  });

  it("ready 계산: 문제 없는 post 개수", () => {
    const posts = [makePost("a", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }])];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.ready).toBe(1);
    expect(summary.readyPostIds).toEqual(["a"]);
  });

  it("needsConfirmation 계산: 사람 확인이 필요한 issue가 있는 post 개수", () => {
    const posts = [
      makePost("a", "not_requested", [{ key: "news_article_no_unsourced_claim", status: "warning", message: "출처 확인" }]),
    ];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.needsConfirmation).toBe(1);
    expect(summary.needsConfirmationPostIds).toEqual(["a"]);
  });

  it("blocked 계산: 차단 issue가 있는 post 개수", () => {
    const posts = [makePost("a", "not_requested", [{ key: "content_present", status: "blocked", message: "본문 없음" }])];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.blocked).toBe(1);
    expect(summary.blockedPostIds).toEqual(["a"]);
  });

  it("failed 계산: qualityStatus=failed인 post 개수", () => {
    const posts = [makePost("a", "not_requested", [], "failed")];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.failed).toBe(1);
    expect(summary.failedPostIds).toEqual(["a"]);
  });

  it("approved 계산: approvalStatus===approved인 post 개수(review state와 별개)", () => {
    const posts = [
      makePost("a", "approved", [{ key: "content_present", status: "pass", message: "통과" }]),
      makePost("b", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]),
    ];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.approved).toBe(1);
    expect(summary.approvedPostIds).toEqual(["a"]);
    // approved post도 review state 축(ready)에는 여전히 집계된다 — 두 축은 독립적이다.
    expect(summary.ready).toBe(2);
  });

  it("같은 post가 잘못 두 review state에 중복 집계되지 않는다", () => {
    const posts = [makePost("a", "not_requested", [{ key: "content_present", status: "blocked", message: "차단" }])];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.blocked + summary.needsConfirmation + summary.checking + summary.ready + summary.failed).toBe(1);
  });

  it("bulkApprovalEligiblePostIds는 ready이면서 아직 approved가 아닌 post만 포함한다", () => {
    const posts = [
      makePost("a", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]), // ready, 미승인 → 대상
      makePost("b", "approved", [{ key: "content_present", status: "pass", message: "통과" }]), // ready지만 이미 승인 → 제외
      makePost("c", "not_requested", [{ key: "news_article_no_unsourced_claim", status: "warning", message: "확인" }]), // needs_confirmation → 제외
    ];
    const summary = summarizeMultiPlatformReview(posts);
    expect(summary.bulkApprovalEligiblePostIds).toEqual(["a"]);
  });

  it("userFacingReview 기반 집계가 단일 post 결과와 일치한다", () => {
    const checklist = [{ key: "content_present", status: "blocked" as const, message: "차단" }];
    const review = summarizeAutoReview(checklist);
    const single = summarizeUserFacingReview("needs_revision", review, checklist);
    const summary = summarizeMultiPlatformReview([{ id: "a", approvalStatus: "not_requested", review: single }]);
    expect(summary.blocked).toBe(single.state === "blocked" ? 1 : 0);
  });
});

describe("getMultiPlatformReviewSortKey (Phase UX-04B)", () => {
  it("blocked > needsConfirmation > failed > checking > ready > approved 순으로 정렬 키가 작아진다", () => {
    const blocked = makePost("a", "not_requested", [{ key: "content_present", status: "blocked", message: "차단" }]);
    const needsConfirmation = makePost("b", "not_requested", [
      { key: "news_article_no_unsourced_claim", status: "warning", message: "확인" },
    ]);
    const failed = makePost("c", "not_requested", [], "failed");
    const checking = makePost("d", "not_requested", [], "not_checked");
    const ready = makePost("e", "not_requested", [{ key: "content_present", status: "pass", message: "통과" }]);
    const approved = makePost("f", "approved", [{ key: "content_present", status: "pass", message: "통과" }]);

    const keys = [blocked, needsConfirmation, failed, checking, ready, approved].map(getMultiPlatformReviewSortKey);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(new Set(keys).size).toBe(6);
  });

  it("이미 승인된 post는 review state와 무관하게 항상 가장 낮은 우선순위다", () => {
    const approvedButBlocked = makePost("a", "approved", [{ key: "content_present", status: "blocked", message: "차단" }]);
    expect(getMultiPlatformReviewSortKey(approvedButBlocked)).toBe(5);
  });
});
