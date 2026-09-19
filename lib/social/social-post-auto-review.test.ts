import { describe, expect, it } from "vitest";
import {
  summarizeAutoReview,
  describeAutoReviewRiskLevel,
  describeApprovalReadiness,
  describeAutoReviewNotRunYet,
  getApprovalGateStatus,
  getSocialPostWorkspacePrimaryAction,
  summarizeUserFacingReview,
} from "./social-post-auto-review";

describe("summarizeAutoReview (Phase 3-25)", () => {
  it("checklist가 비어 있으면(또는 없으면) 통과로 취급한다", () => {
    expect(summarizeAutoReview(null).overallStatus).toBe("passed");
    expect(summarizeAutoReview(undefined).overallStatus).toBe("passed");
    expect(summarizeAutoReview([]).overallStatus).toBe("passed");
  });

  it("전부 pass면 통과 상태이고 위험도가 낮다", () => {
    const summary = summarizeAutoReview([
      { key: "content_present", status: "pass", message: "본문이 있습니다." },
      { key: "platform_valid", status: "pass", message: "지원하는 platform입니다." },
    ]);
    expect(summary.overallStatus).toBe("passed");
    expect(summary.riskLevel).toBe("low");
    expect(summary.counts).toEqual({ passed: 2, needsCheck: 0, needsFix: 0, blocked: 0 });
    expect(summary.passedMessages).toEqual(["본문이 있습니다.", "지원하는 platform입니다."]);
    expect(summary.issues).toEqual([]);
  });

  it("warning만 있으면 확인 필요 상태이고 위험도는 낮음이다", () => {
    const summary = summarizeAutoReview([
      { key: "length_check", status: "warning", message: "본문이 다소 짧습니다." },
    ]);
    expect(summary.overallStatus).toBe("needs_check");
    expect(summary.riskLevel).toBe("low");
    expect(summary.counts.needsCheck).toBe(1);
    expect(summary.issues[0].severity).toBe("needs_check");
    expect(summary.issues[0].canDismiss).toBe(true);
  });

  it("fail이 있으면 수정 필요 상태이고 위험도는 보통이다", () => {
    const summary = summarizeAutoReview([
      { key: "wordpress_blog_body_depth", status: "fail", message: "본문이 너무 짧습니다." },
    ]);
    expect(summary.overallStatus).toBe("needs_fix");
    expect(summary.riskLevel).toBe("medium");
    expect(summary.issues[0].severity).toBe("needs_fix");
    expect(summary.issues[0].canDismiss).toBe(false);
  });

  it("blocked가 있으면 차단 상태이고 위험도는 높음이다 — fail/warning이 섞여 있어도 차단이 우선이다", () => {
    const summary = summarizeAutoReview([
      { key: "length_check", status: "warning", message: "경고" },
      { key: "wordpress_blog_body_depth", status: "fail", message: "실패" },
      { key: "no_pii_exposure", status: "blocked", message: "개인정보 노출 의심" },
    ]);
    expect(summary.overallStatus).toBe("blocked");
    expect(summary.riskLevel).toBe("high");
    expect(summary.counts).toEqual({ passed: 0, needsCheck: 1, needsFix: 1, blocked: 1 });
    // severity 우선순위: blocked > needs_fix > needs_check
    expect(summary.issues.map((i) => i.severity)).toEqual(["blocked", "needs_fix", "needs_check"]);
    expect(summary.issues[0].canDismiss).toBe(false);
  });

  it("known key는 올바른 축(axis)으로 분류된다", () => {
    const summary = summarizeAutoReview([
      { key: "no_pii_exposure", status: "blocked", message: "x" },
      { key: "wordpress_blog_source_date_notice_present", status: "fail", message: "x" },
      { key: "naver_cafe_no_markdown_escape", status: "fail", message: "x" },
      { key: "tone_alignment_check", status: "warning", message: "x" },
    ]);
    const byKey = Object.fromEntries(summary.issues.map((i) => [i.key, i.axis]));
    expect(byKey.no_pii_exposure).toBe("safety");
    expect(byKey.wordpress_blog_source_date_notice_present).toBe("source");
    expect(byKey.naver_cafe_no_markdown_escape).toBe("platform_fit");
    expect(byKey.tone_alignment_check).toBe("tone");
  });

  it("알 수 없는 key는 안전하게 structure로 분류된다(예외를 던지지 않는다)", () => {
    const summary = summarizeAutoReview([{ key: "future_unknown_check", status: "warning", message: "x" }]);
    expect(summary.issues[0].axis).toBe("structure");
  });
});

describe("describeAutoReviewRiskLevel (Phase 3-25)", () => {
  it("low/medium/high를 한국어로 바꾼다", () => {
    expect(describeAutoReviewRiskLevel("low")).toBe("낮음");
    expect(describeAutoReviewRiskLevel("medium")).toBe("보통");
    expect(describeAutoReviewRiskLevel("high")).toBe("높음");
  });
});

describe("describeApprovalReadiness (Phase 3-25)", () => {
  it("차단이면 승인 불가 안내, 통과/확인 필요면 승인 가능 안내를 반환한다", () => {
    expect(describeApprovalReadiness(summarizeAutoReview([{ key: "no_pii_exposure", status: "blocked", message: "x" }]))).toContain(
      "승인할 수 없습니다"
    );
    expect(describeApprovalReadiness(summarizeAutoReview([]))).toContain("승인할 수 있습니다");
    expect(
      describeApprovalReadiness(summarizeAutoReview([{ key: "length_check", status: "warning", message: "x" }]))
    ).toContain("승인할 수 있습니다");
  });
});

describe("describeAutoReviewNotRunYet (Phase 3-25)", () => {
  it("raw quality_status 값을 그대로 노출하지 않고 한국어 안내 문구를 만든다", () => {
    const message = describeAutoReviewNotRunYet("not_checked");
    expect(message).toContain("아직 자동 검토를 실행하지 않았습니다");
    expect(message).toContain("아직 확인 전");
  });
});

describe("getApprovalGateStatus (Phase 3-26)", () => {
  const base = {
    qualityStatus: "ready",
    approvalStatus: "pending_review",
    publishStatus: "not_ready",
    hasContent: true,
    hasBlockingIssues: false,
  };

  it("이미 승인된 글이면 승인 불가다", () => {
    expect(getApprovalGateStatus({ ...base, approvalStatus: "approved" })).toEqual({
      canApprove: false,
      reason: "이미 승인된 글입니다.",
    });
  });

  it("자동 검토를 한 번도 실행하지 않았으면 승인 불가다", () => {
    const result = getApprovalGateStatus({ ...base, qualityStatus: "not_checked" });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("자동 검토를 실행해야");
  });

  it("차단 항목이 있으면 승인 불가다", () => {
    const result = getApprovalGateStatus({ ...base, qualityStatus: "blocked" });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("차단 항목이 있어");
  });

  it("본문이 없으면 승인 불가다", () => {
    const result = getApprovalGateStatus({ ...base, hasContent: false });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("본문이 없어");
  });

  it("차단/수정 필요 checklist 항목이 있으면 승인 불가다", () => {
    const result = getApprovalGateStatus({ ...base, hasBlockingIssues: true });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("승인할 수 없습니다");
  });

  it("검토를 통과했고 본문이 있으며 차단 항목이 없으면 승인 가능하다", () => {
    expect(getApprovalGateStatus(base)).toEqual({ canApprove: true, reason: null });
  });

  it("게시 상태가 차단되어 있으면 승인 불가다(Phase UX-05A 전수 감사)", () => {
    const result = getApprovalGateStatus({ ...base, publishStatus: "blocked" });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("게시 상태가 차단되어");
  });

  it("이미 게시된 글은 승인 불가다(Phase UX-05A 전수 감사)", () => {
    const result = getApprovalGateStatus({ ...base, publishStatus: "published" });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("이미 게시된 글");
  });

  it("자동 검토 실행이 실패했으면 승인 불가다(Phase UX-05A 전수 감사)", () => {
    const result = getApprovalGateStatus({ ...base, qualityStatus: "failed" });
    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain("실행이 실패했습니다");
  });

  it("Phase UX-05A: 모든 canApprove=false 케이스는 사용자용 자연어 reason을 갖고, raw DB 필드명/enum이 섞이지 않는다", () => {
    const cases = [
      { ...base, approvalStatus: "approved" },
      { ...base, publishStatus: "blocked" },
      { ...base, publishStatus: "published" },
      { ...base, qualityStatus: "not_checked" },
      { ...base, qualityStatus: "failed" },
      { ...base, qualityStatus: "blocked" },
      { ...base, hasContent: false },
      { ...base, hasBlockingIssues: true },
    ];
    for (const input of cases) {
      const result = getApprovalGateStatus(input);
      expect(result.canApprove).toBe(false);
      expect(result.reason).toBeTruthy();
      // raw enum/필드명이 문장에 그대로 섞이지 않는다(예: "quality_status=ready", "approval_status!=approved").
      expect(result.reason).not.toMatch(/[a-z_]+\s*(===|!==|=)\s*['"a-z_]+/i);
      expect(result.reason).not.toContain("quality_status");
      expect(result.reason).not.toContain("approval_status");
      expect(result.reason).not.toContain("publish_status");
    }
  });
});

describe("getSocialPostWorkspacePrimaryAction (Phase 3-26)", () => {
  it("승인 완료면 게시 준비하기다", () => {
    expect(getSocialPostWorkspacePrimaryAction("ready", "approved", summarizeAutoReview([])).kind).toBe(
      "publish_prep"
    );
  });

  it("자동 검토 전이면 자동 검토 실행이다", () => {
    expect(
      getSocialPostWorkspacePrimaryAction("not_checked", "pending_review", summarizeAutoReview(null)).kind
    ).toBe("run_review");
  });

  it("차단됨이면 문제 수정하기다", () => {
    const review = summarizeAutoReview([{ key: "no_pii_exposure", status: "blocked", message: "x" }]);
    const action = getSocialPostWorkspacePrimaryAction("blocked", "pending_review", review);
    expect(action.kind).toBe("edit");
    expect(action.label).toBe("문제 수정하기");
  });

  it("수정 필요면 수정하기다", () => {
    const review = summarizeAutoReview([{ key: "wordpress_blog_body_depth", status: "fail", message: "x" }]);
    expect(getSocialPostWorkspacePrimaryAction("needs_revision", "pending_review", review).label).toBe("수정하기");
  });

  it("확인 필요면 본문 확인하기다", () => {
    const review = summarizeAutoReview([{ key: "length_check", status: "warning", message: "x" }]);
    expect(getSocialPostWorkspacePrimaryAction("ready", "pending_review", review).label).toBe("본문 확인하기");
  });

  it("통과했으면 최종 승인이다", () => {
    expect(getSocialPostWorkspacePrimaryAction("ready", "pending_review", summarizeAutoReview([])).label).toBe(
      "최종 승인"
    );
  });
});

describe("summarizeUserFacingReview (Phase UX-04A)", () => {
  it("qualityStatus=not_checked면 checking 상태다", () => {
    const review = summarizeAutoReview([]);
    const summary = summarizeUserFacingReview("not_checked", review, []);
    expect(summary.state).toBe("checking");
    expect(summary.stateLabel).toBe("자동 검토 중");
  });

  it("qualityStatus=failed면 failed 상태다", () => {
    const review = summarizeAutoReview([]);
    const summary = summarizeUserFacingReview("failed", review, []);
    expect(summary.state).toBe("failed");
  });

  it("문제가 없으면 ready 상태이고 confirmationCount는 0이다", () => {
    const checklist = [{ key: "content_present", status: "pass" as const, message: "통과" }];
    const review = summarizeAutoReview(checklist);
    const summary = summarizeUserFacingReview("ready", review, checklist);
    expect(summary.state).toBe("ready");
    expect(summary.confirmationCount).toBe(0);
    expect(summary.visibleIssues).toHaveLength(0);
  });

  it("auto_fixable 문제만 남아 있으면 사람이 확인할 항목이 아니므로 ready로 취급하고 issue를 숨긴다", () => {
    // wordpress_blog_body_depth는 review-issue-fixability의 AUTO_FIXABLE_KEYS에 속한다.
    const checklist = [{ key: "wordpress_blog_body_depth", status: "fail" as const, message: "본문이 짧습니다." }];
    const review = summarizeAutoReview(checklist);
    const summary = summarizeUserFacingReview("needs_revision", review, checklist);
    expect(summary.state).toBe("ready");
    expect(summary.confirmationCount).toBe(0);
    expect(summary.visibleIssues).toHaveLength(0);
    expect(summary.hiddenAutoFixableCount).toBe(1);
  });

  it("user_confirmation_required 문제가 있으면 needs_confirmation이고 그 문제만 visibleIssues에 남는다", () => {
    const checklist = [
      { key: "wordpress_blog_body_depth", status: "fail" as const, message: "본문이 짧습니다." },
      { key: "news_article_no_unsourced_claim", status: "warning" as const, message: "출처를 확인하세요." },
    ];
    const review = summarizeAutoReview(checklist);
    const summary = summarizeUserFacingReview("needs_revision", review, checklist);
    expect(summary.state).toBe("needs_confirmation");
    expect(summary.confirmationCount).toBe(1);
    expect(summary.visibleIssues.map((i) => i.key)).toEqual(["news_article_no_unsourced_claim"]);
    expect(summary.hiddenAutoFixableCount).toBe(1);
  });

  it("blocking 문제가 있으면 auto_fixable/user_confirmation 여부와 관계없이 blocked다", () => {
    const checklist = [
      { key: "wordpress_blog_body_depth", status: "fail" as const, message: "본문이 짧습니다." },
      { key: "content_present", status: "blocked" as const, message: "본문이 없습니다." },
    ];
    const review = summarizeAutoReview(checklist);
    const summary = summarizeUserFacingReview("needs_revision", review, checklist);
    expect(summary.state).toBe("blocked");
    expect(summary.visibleIssues.map((i) => i.key)).toContain("content_present");
  });

  it("raw fixability/qualityStatus enum을 stateLabel/stateMessage에 그대로 노출하지 않는다", () => {
    const review = summarizeAutoReview([]);
    const summary = summarizeUserFacingReview("not_checked", review, []);
    expect(summary.stateLabel).not.toContain("not_checked");
    expect(summary.stateMessage).not.toContain("auto_fixable");
  });
});
