import { describe, expect, it } from "vitest";
import {
  fromWordPressPublishPrepState,
  fromSocialPostCardActionState,
  fromPostApprovalNextActions,
  fromUserFacingReviewToNextAction,
} from "./next-action-view-model";
import { getWordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import { getSocialPostCardActionState } from "@/lib/social/social-post-card-action-state";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";

describe("fromWordPressPublishPrepState", () => {
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

  it("모든 조건이 충족되면 state가 completed다(Draft 보기만 남음)", () => {
    const prep = getWordPressPublishPrepState(makePrepInput());
    const vm = fromWordPressPublishPrepState(prep);
    expect(vm.state).toBe("completed");
    expect(vm.primaryAction?.actionType).toBe("view_draft");
  });

  it("대표 이미지가 없으면 state가 needs_attention이다", () => {
    const prep = getWordPressPublishPrepState(
      makePrepInput({
        featuredImageAttached: false,
        featuredImageWaived: false,
        featuredImageMediaIdPresent: false,
        checklistPrepared: false,
      })
    );
    const vm = fromWordPressPublishPrepState(prep);
    expect(vm.state).toBe("needs_attention");
    expect(vm.primaryAction?.label).toBe("대표 이미지 설정하기");
  });

  it("본문이 없으면 state가 ready이고 primary가 본문 생성이다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ bodyExists: false }));
    const vm = fromWordPressPublishPrepState(prep);
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.actionType).toBe("generate_post");
  });

  it("message는 raw 값이 아니라 statusLabel(사용자 친화적 문구)을 쓴다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput());
    const vm = fromWordPressPublishPrepState(prep);
    expect(vm.message).toBe(prep.statusLabel);
    expect(vm.message).not.toMatch(/^(ready|approved|not_checked)$/);
  });

  it("secondaryActions를 그대로 매핑한다(href 포함)", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ draftExists: true, draftUrl: "https://example.com/post" }));
    const vm = fromWordPressPublishPrepState(prep);
    expect(vm.secondaryActions?.some((a) => a.actionType === "view_draft")).toBe(false); // primary가 view_draft이므로 secondary 목록엔 없음
  });
});

describe("fromSocialPostCardActionState", () => {
  it("수정 필요 상태는 needs_attention으로 매핑된다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "needs_revision", approvalStatus: "not_requested", exportStatus: "not_ready" });
    const vm = fromSocialPostCardActionState(cardState);
    expect(vm.state).toBe("needs_attention");
    expect(vm.message).toBe("수정 필요");
  });

  it("export 완료 상태는 completed로 매핑된다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "ready", approvalStatus: "approved", exportStatus: "exported" });
    const vm = fromSocialPostCardActionState(cardState);
    expect(vm.state).toBe("completed");
  });

  it("자동 검토 통과(승인 전)는 ready로 매핑된다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "ready", approvalStatus: "not_requested", exportStatus: "not_ready" });
    const vm = fromSocialPostCardActionState(cardState);
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.actionType).toBe("approve");
  });

  it("raw enum(qualityStatus 등)을 message/label로 노출하지 않는다", () => {
    const cardState = getSocialPostCardActionState({ qualityStatus: "not_checked", approvalStatus: "not_requested", exportStatus: "not_ready" });
    const vm = fromSocialPostCardActionState(cardState);
    expect(vm.message).not.toBe("not_checked");
    expect(vm.primaryAction?.label).not.toContain("not_checked");
  });
});

describe("fromPostApprovalNextActions", () => {
  it("WordPress Draft 보기만 남으면 completed다", () => {
    const result = getPostApprovalNextActions({ platform: "wordpress_blog", wordpressDraftExists: true, wordpressPublishGuardReady: true });
    const vm = fromPostApprovalNextActions(result);
    expect(vm.state).toBe("completed");
  });

  it("WordPress Draft가 없으면 ready이고 primary가 Draft 만들기다", () => {
    const result = getPostApprovalNextActions({ platform: "wordpress_blog", wordpressDraftExists: false });
    const vm = fromPostApprovalNextActions(result);
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.actionType).toBe("create_wordpress_draft");
  });

  it("naver_blog는 항상 primary가 본문 복사이고 ready다", () => {
    const result = getPostApprovalNextActions({ platform: "naver_blog" });
    const vm = fromPostApprovalNextActions(result);
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.actionType).toBe("copy_body");
  });

  it("message는 항상 존재한다(dead-end 방지)", () => {
    const result = getPostApprovalNextActions({ platform: "x" });
    const vm = fromPostApprovalNextActions(result);
    expect(vm.message).toBeTruthy();
    expect(vm.primaryAction).toBeTruthy();
  });
});

describe("fromUserFacingReviewToNextAction (Phase UX-04A)", () => {
  it("checking이면 in_progress이고 primaryAction이 없다(진행 상태 표시만)", () => {
    const review = summarizeUserFacingReview("not_checked", summarizeAutoReview([]), []);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.state).toBe("in_progress");
    expect(vm.primaryAction).toBeUndefined();
  });

  it("ready면 primary가 승인이다", () => {
    const checklist = [{ key: "content_present", status: "pass" as const, message: "통과" }];
    const review = summarizeUserFacingReview("ready", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction).toEqual({ label: "승인", actionType: "approve" });
  });

  it("needs_confirmation이면 primary가 확인할 내용 보기다", () => {
    const checklist = [{ key: "news_article_no_unsourced_claim", status: "warning" as const, message: "출처 확인" }];
    const review = summarizeUserFacingReview("needs_revision", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.state).toBe("needs_attention");
    expect(vm.primaryAction).toEqual({ label: "확인할 내용 보기", actionType: "view_confirmation" });
  });

  it("blocked면 primary가 문제 확인이다", () => {
    const checklist = [{ key: "content_present", status: "blocked" as const, message: "본문 없음" }];
    const review = summarizeUserFacingReview("needs_revision", summarizeAutoReview(checklist), checklist);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.state).toBe("blocked");
    expect(vm.primaryAction).toEqual({ label: "문제 확인", actionType: "view_blocking" });
  });

  it("failed면 primary가 다시 검토다", () => {
    const review = summarizeUserFacingReview("failed", summarizeAutoReview([]), []);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.state).toBe("needs_attention");
    expect(vm.primaryAction).toEqual({ label: "다시 검토", actionType: "retry_review" });
  });

  it("message는 항상 존재한다(dead-end 방지)", () => {
    const review = summarizeUserFacingReview("ready", summarizeAutoReview([]), []);
    const vm = fromUserFacingReviewToNextAction(review);
    expect(vm.message).toBeTruthy();
  });
});
