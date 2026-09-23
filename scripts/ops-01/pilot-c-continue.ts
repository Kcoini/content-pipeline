import "./load-env";
import { describe, it, expect } from "vitest";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { runSocialPostQualityGateAndSave } from "@/lib/social/social-post-service";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";
import { runAutoFixAndRecheck } from "@/lib/social/post-auto-fix-service";
import { bulkApproveSocialPosts } from "@/lib/social/social-post-approval-service";
import { summarizeMultiPlatformReview } from "@/lib/ui/multi-platform-review-summary";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
const APPROVED_BY = "ops-01-pilot-c";
const SOCIAL_POST_IDS: Record<"x" | "threads" | "instagram", string> = {
  x: "b77fc804-967d-456f-a212-ceddf1fea6c7",
  threads: "0dbee46c-2ac7-4bb6-87e9-960aac1880ba",
  instagram: "abf6e101-71a2-49cd-88cd-51dbdb1cbc9c",
};
const PLATFORMS = ["x", "threads", "instagram"] as const;

describe("OPS-01 Pilot C 이어서 실행: 품질검사/자동검토/자동수정/요약/일괄승인/다음작업", () => {
  it("7. threads/instagram 품질 검사 + 자동 검토 + 자동 수정 (x는 이미 완료됨)", async () => {
    for (const platform of ["threads", "instagram"] as const) {
      const id = SOCIAL_POST_IDS[platform];
      const gateResult = await runSocialPostQualityGateAndSave(id);
      console.log(`[ops-01-pilot-c] ${platform} quality gate success=${gateResult.success} status=${gateResult.socialPost?.qualityStatus}`);

      const post = await getSocialPostById(id);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as never[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      console.log(
        `[ops-01-pilot-c] ${platform} review state=${userFacing.state} confirmationCount=${userFacing.confirmationCount} hiddenAutoFixable=${userFacing.hiddenAutoFixableCount}`
      );
      if (userFacing.confirmationCount > 0) {
        for (const issue of userFacing.visibleIssues) {
          console.log(`[ops-01-pilot-c] ${platform} confirmation issue: ${issue.key} - ${issue.message}`);
        }
      }

      if (post!.qualityStatus === "needs_revision") {
        const autoFix = await runAutoFixAndRecheck(id);
        console.log(
          `[ops-01-pilot-c] ${platform} auto-fix changesApplied=${autoFix.changesApplied.length} noSafeChangesFound=${autoFix.noSafeChangesFound} finalState=${autoFix.finalState}`
        );
      }
    }
    expect(true).toBe(true);
  });

  it("8. MultiPlatformReviewSummary 계산 + bulk approval", async () => {
    const posts = [];
    for (const platform of PLATFORMS) {
      const post = await getSocialPostById(SOCIAL_POST_IDS[platform]);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as never[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      posts.push({ id: post!.id, approvalStatus: post!.approvalStatus, review: userFacing });
    }
    const reviewSummary = summarizeMultiPlatformReview(posts);
    console.log(
      `[ops-01-pilot-c] MultiPlatformReviewSummary total=${reviewSummary.total} ready=${reviewSummary.ready} needsConfirmation=${reviewSummary.needsConfirmation} blocked=${reviewSummary.blocked} failed=${reviewSummary.failed} bulkEligible=${reviewSummary.bulkApprovalEligiblePostIds.length}`
    );

    const bulkResult = await bulkApproveSocialPosts(reviewSummary.bulkApprovalEligiblePostIds, APPROVED_BY);
    console.log(`[ops-01-pilot-c] bulkApprove success=${bulkResult.successCount} failure=${bulkResult.failureCount}`);
    for (const f of bulkResult.failures) console.log(`[ops-01-pilot-c] bulk approve failure: ${f.socialPostId} - ${f.message}`);

    for (const platform of PLATFORMS) {
      const post = await getSocialPostById(SOCIAL_POST_IDS[platform]);
      console.log(`[ops-01-pilot-c] ${platform} final approvalStatus=${post!.approvalStatus}`);
    }
    expect(true).toBe(true);
  });

  it("9. 승인 완료 post의 다음 작업(copy_body) 확인 — 게시하기 버튼 없음", async () => {
    for (const platform of PLATFORMS) {
      const post = await getSocialPostById(SOCIAL_POST_IDS[platform]);
      if (post!.approvalStatus !== "approved") {
        console.log(`[ops-01-pilot-c] ${platform} 미승인 상태(${post!.approvalStatus}) — next action 확인 skip`);
        continue;
      }
      const next = getPostApprovalNextActions({ platform: post!.platform, apiConfigured: false });
      console.log(`[ops-01-pilot-c] ${platform} next action = ${next.primaryAction.actionType} (${next.primaryAction.label})`);
      expect(next.primaryAction.actionType).not.toBe("publish");
      expect(next.primaryAction.label).not.toContain("게시하기");
    }
  });
});
