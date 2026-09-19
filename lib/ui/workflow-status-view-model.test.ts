import { describe, expect, it } from "vitest";
import {
  fromWordPressPublishPrepStateToWorkflowStatus,
  fromSocialPostCardActionStateToWorkflowStatus,
  fromUserFacingReviewToWorkflowStatus,
} from "./workflow-status-view-model";
import { getWordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import { getSocialPostCardActionState } from "@/lib/social/social-post-card-action-state";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";

function makePrepInput(overrides: Partial<Parameters<typeof getWordPressPublishPrepState>[0]> = {}) {
  return {
    bodyExists: true,
    qualityStatus: "ready",
    approvalStatus: "approved",
    draftExists: true,
    featuredImageAttached: true,
    featuredImageWaived: false,
    featuredImageMediaIdPresent: true,
    checklistPrepared: true,
    publishGuardStatus: "ready",
    seoTitle: "제목",
    metaDescription: "설명",
    targetKeyword: "키워드",
    ...overrides,
  };
}

describe("fromWordPressPublishPrepStateToWorkflowStatus", () => {
  it("모든 조건이 충족되면 completed다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput());
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.state).toBe("completed");
  });

  it("아무것도 시작하지 않았으면 idle이다", () => {
    const prep = getWordPressPublishPrepState(
      makePrepInput({
        qualityStatus: "not_checked",
        approvalStatus: "not_requested",
        draftExists: false,
        featuredImageAttached: false,
        featuredImageWaived: false,
        featuredImageMediaIdPresent: false,
        checklistPrepared: false,
        seoTitle: null,
        metaDescription: null,
        targetKeyword: null,
      })
    );
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.state).toBe("idle");
  });

  it("일부는 완료, 일부는 남아 있으면 needs_attention이다", () => {
    const prep = getWordPressPublishPrepState(
      makePrepInput({ featuredImageAttached: false, featuredImageWaived: false, checklistPrepared: false })
    );
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.state).toBe("needs_attention");
    expect(vm.completedItems).toContain("품질검사 완료");
    expect(vm.remainingItems?.length).toBeGreaterThan(0);
  });

  it("추적 대상 항목은 모두 끝났지만 마지막 반영 단계가 남으면 in_progress다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ publishGuardStatus: "needs_revision" }));
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.state).toBe("in_progress");
    expect(vm.remainingItems).toEqual([]);
  });

  it("title은 raw enum이 아니라 statusLabel을 그대로 쓴다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput());
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.title).toBe(prep.statusLabel);
    expect(vm.title).not.toMatch(/^(ready|approved|not_checked|draft)$/);
  });

  it("completedItems/remainingItems를 그대로 전달한다(가공 없이)", () => {
    const prep = getWordPressPublishPrepState(makePrepInput());
    const vm = fromWordPressPublishPrepStateToWorkflowStatus(prep);
    expect(vm.completedItems).toEqual(prep.completedItems);
    expect(vm.remainingItems).toEqual(prep.remainingItems);
  });
});

describe("fromSocialPostCardActionStateToWorkflowStatus", () => {
  it("수정 필요 상태는 needs_attention이다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "needs_revision", approvalStatus: "not_requested", exportStatus: "not_ready" });
    const vm = fromSocialPostCardActionStateToWorkflowStatus(cardState);
    expect(vm.state).toBe("needs_attention");
    expect(vm.title).toBe("수정 필요");
  });

  it("export 완료 상태는 completed다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "ready", approvalStatus: "approved", exportStatus: "exported" });
    const vm = fromSocialPostCardActionStateToWorkflowStatus(cardState);
    expect(vm.state).toBe("completed");
  });

  it("그 외 상태는 ready다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "not_checked", approvalStatus: "not_requested", exportStatus: "not_ready" });
    const vm = fromSocialPostCardActionStateToWorkflowStatus(cardState);
    expect(vm.state).toBe("ready");
  });
});

describe("fromUserFacingReviewToWorkflowStatus (Phase UX-04A)", () => {
  it("checking은 in_progress다", () => {
    const review = summarizeUserFacingReview("not_checked", summarizeAutoReview([]), []);
    const vm = fromUserFacingReviewToWorkflowStatus(review);
    expect(vm.state).toBe("in_progress");
    expect(vm.title).toBe("자동 검토 중");
  });

  it("ready는 ready다", () => {
    const checklist = [{ key: "content_present", status: "pass" as const, message: "통과" }];
    const review = summarizeUserFacingReview("ready", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToWorkflowStatus(review);
    expect(vm.state).toBe("ready");
    expect(vm.title).toBe("승인 가능");
  });

  it("needs_confirmation은 needs_attention이다", () => {
    const checklist = [{ key: "news_article_no_unsourced_claim", status: "warning" as const, message: "출처 확인" }];
    const review = summarizeUserFacingReview("needs_revision", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToWorkflowStatus(review);
    expect(vm.state).toBe("needs_attention");
  });

  it("blocked는 blocked다", () => {
    const checklist = [{ key: "content_present", status: "blocked" as const, message: "본문 없음" }];
    const review = summarizeUserFacingReview("needs_revision", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToWorkflowStatus(review);
    expect(vm.state).toBe("blocked");
  });

  it("raw qualityStatus enum을 title/message에 그대로 노출하지 않는다", () => {
    const review = summarizeUserFacingReview("not_checked", summarizeAutoReview([]), []);
    const vm = fromUserFacingReviewToWorkflowStatus(review);
    expect(vm.title).not.toContain("not_checked");
  });
});
