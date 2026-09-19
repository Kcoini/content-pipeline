// Phase UX-06: Journey 2 — Naver Cafe(copy 플랫폼 대표). "글 생성 →
// markdown/bold 잔여물 자동 정리 → 승인 → 본문 복사 → 사용자가 명시적으로
// 게시 완료 기록"까지 실제 서비스 함수를 체이닝해서 검증한다. 새
// business logic을 추가하지 않는다 — 순수 함수(quality gate/sanitizer/
// ViewModel 어댑터)는 그대로 호출하고, DB를 읽는 recordManualPostingResult만
// repository를 mock해서 guard 동작을 확인한다(다른 서비스 테스트 파일과
// 동일한 mocking 패턴, lib/social/platform-manual-posting-result-service.test.ts 참고).
//
// 사용자 click/판단 단계 tally(참고용):
//   사람이 직접 눌러야 하는 것: 최종 승인 → 본문 복사 → 게시 완료로 표시(URL 입력) = 3회
//   시스템 자동: 자동 검토, markdown/bold 잔여물 자동 정리 + 재검토(생성 직후 1회) = 2단계
//   반복 불필요 click: 없음(복사는 몇 번을 눌러도 상태를 바꾸지 않으므로 "반복"이 문제되지 않는다)

import { describe, expect, it, vi } from "vitest";
import { runSocialPostQualityGate } from "@/lib/social/social-quality-gate";
import { sanitizeNaverCafePlainText } from "@/lib/social/naver-cafe-plain-text-sanitizer";
import { fromPostApprovalNextActionsToPublishPreparation } from "@/lib/ui/publish-preparation-view-model";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";
import type { SocialPost } from "@/lib/social/social-platform-types";

describe("Journey 2 — Naver Cafe: markdown 잔여물 정리 → 승인 → 복사 → 게시 완료 (Phase UX-06)", () => {
  it("1단계: **bold**/escape된 markdown이 남아 있으면 quality gate가 잡아낸다(UX-05B에서 bold 검사 추가)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody:
        "이 부분은 **정말 중요합니다** 꼭 읽어주세요. 회원분들 어떻게 생각하세요? 다들 경험 있으신가요? " +
        "본문 내용입니다. ".repeat(30),
    });
    const item = result.checklist.find((c) => c.key === "naver_cafe_no_markdown_escape");
    expect(item?.status).toBe("fail");
    expect(result.status).not.toBe("ready");
  });

  it("2단계: sanitizeNaverCafePlainText가 실제로 잔여물을 제거한다(자동 수정기가 실제 문제를 고침)", () => {
    const cleaned = sanitizeNaverCafePlainText("이 부분은 **정말 중요합니다** \\## 소제목 &#x20;내용");
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("\\##");
    expect(cleaned).not.toContain("&#x20;");
  });

  it("3단계: 정리 후 재검토하면 통과한다(auto-fix → recheck 성공 계약)", () => {
    const cleanedBody =
      sanitizeNaverCafePlainText("이 부분은 **정말 중요합니다** 꼭 읽어주세요.") +
      " 회원분들 어떻게 생각하세요? 다들 경험 있으신가요? " +
      "본문 내용입니다. ".repeat(30);
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody: cleanedBody,
    });
    const item = result.checklist.find((c) => c.key === "naver_cafe_no_markdown_escape");
    expect(item?.status).toBe("pass");
  });

  it("4단계: 승인 완료 이후 primary action은 '본문 복사'이지 존재하지 않는 '게시하기'가 아니다", () => {
    const result = getPostApprovalNextActions({ platform: "naver_cafe" });
    expect(result.primaryAction.actionType).toBe("copy_body");
    expect(result.primaryAction.label).toBe("본문 복사");
    expect(result.primaryAction.label).not.toBe("게시하기");

    const preparation = fromPostApprovalNextActionsToPublishPreparation("naver_cafe", result, "not_published");
    expect(preparation.state).toBe("ready");
    expect(preparation.primaryAction?.type).toBe("copy_body");
  });

  it("5단계: 본문 복사(클라이언트 이벤트)만으로는 completed 상태가 되지 않는다 — publishStatus/manualPostStatus가 그대로면 여전히 ready다", () => {
    const result = getPostApprovalNextActions({ platform: "naver_cafe" });
    // 복사는 서버 상태를 전혀 건드리지 않는 클라이언트 이벤트이므로,
    // publishStatus/manualPostStatus는 복사 전후로 동일하게 "아직
    // 게시 확인 전" 값을 유지한다 — 그 상태로 ViewModel을 계산해도
    // 여전히 ready여야 한다(completed로 자동 전환되면 안 된다).
    const preparation = fromPostApprovalNextActionsToPublishPreparation("naver_cafe", result, "not_published", "not_recorded");
    expect(preparation.state).toBe("ready");
    expect(preparation.state).not.toBe("completed");
  });

  it("6단계: 게시 완료 기록은 사용자의 명시적 action(recordManualPostingResult)으로만 일어나고, 조건이 안 맞으면 자연어로 막는다", async () => {
    const getSocialPostForManualPosting = vi.fn();
    const updateManualPostingResult = vi.fn();
    const logEvent = vi.fn().mockResolvedValue({});

    vi.doMock("@/lib/repositories/social-posts-repository", () => ({
      getSocialPostForManualPosting: (...args: unknown[]) => getSocialPostForManualPosting(...args),
      updateManualPostingChecklist: vi.fn(),
      updateManualPostingResult: (...args: unknown[]) => updateManualPostingResult(...args),
      SocialPostNotFoundError: class SocialPostNotFoundError extends Error {},
    }));
    vi.doMock("@/lib/harness/logger", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

    const { recordManualPostingResult } = await import("@/lib/social/platform-manual-posting-result-service");

    const basePost = {
      id: "post-1",
      articleId: "article-1",
      platform: "naver_cafe",
      qualityStatus: "needs_revision", // 아직 준비 안 됨 → 막혀야 한다
      approvalStatus: "approved",
      exportStatus: "ready",
      platformPublishGuardStatus: "ready",
      platformPublishReady: true,
      platformPublishDryRunStatus: "ready",
      handoffStatus: "completed",
      publishStatus: "not_published",
    } as unknown as SocialPost;

    getSocialPostForManualPosting.mockResolvedValue(basePost);
    updateManualPostingResult.mockResolvedValue(basePost);

    const blockedResult = await recordManualPostingResult("post-1", { manualPostUrl: "https://cafe.naver.com/x/1" });
    expect(blockedResult.success).toBe(false);
    // raw 필드명이 아니라 자연어 사유여야 한다(UX-05B에서 고친 부분 재확인).
    expect(blockedResult.message).not.toContain("quality_status");
    expect(blockedResult.message).toBeTruthy();

    vi.doUnmock("@/lib/repositories/social-posts-repository");
    vi.doUnmock("@/lib/harness/logger");
  });
});
