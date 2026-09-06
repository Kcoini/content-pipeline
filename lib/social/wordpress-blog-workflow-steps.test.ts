import { describe, expect, it } from "vitest";
import {
  getWordPressBlogWorkflowStatusSummary,
  getWordPressBlogNextRecommendedAction,
  type WordPressBlogWorkflowInput,
} from "./wordpress-blog-workflow-steps";

function makeInput(overrides: Partial<WordPressBlogWorkflowInput> = {}): WordPressBlogWorkflowInput {
  return {
    qualityStatus: "ready",
    approvalStatus: "approved",
    draftExists: true,
    seoTitle: "SEO 제목",
    metaDescription: "메타 설명",
    targetKeyword: "키워드",
    featuredImageAttached: true,
    featuredImageWaived: false,
    featuredImageMediaIdPresent: true,
    publishGuardStatus: "ready",
    checklistPrepared: true,
    handoffStatus: "not_started",
    ...overrides,
  };
}

describe("getWordPressBlogWorkflowStatusSummary", () => {
  it("모든 단계가 완료되면 각 상태를 완료 계열로 반환한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput());
    expect(summary.quality).toBe("완료");
    expect(summary.approval).toBe("승인됨");
    expect(summary.draft).toBe("생성됨");
    expect(summary.seo).toBe("준비됨");
    expect(summary.featuredImage).toBe("연결됨");
    expect(summary.publishGuard).toBe("ready");
    expect(summary.checklist).toBe("준비됨");
  });

  it("quality_status=needs_revision이면 실패로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ qualityStatus: "needs_revision" }));
    expect(summary.quality).toBe("실패");
  });

  it("quality_status=draft(미실행)이면 필요로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ qualityStatus: "draft" }));
    expect(summary.quality).toBe("필요");
  });

  it("승인되지 않으면 승인 필요로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ approvalStatus: "pending_review" }));
    expect(summary.approval).toBe("승인 필요");
  });

  it("Draft가 없으면 없음으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ draftExists: false }));
    expect(summary.draft).toBe("없음");
  });

  it("SEO 필드 중 하나라도 없으면 누락으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ targetKeyword: null }));
    expect(summary.seo).toBe("누락");
  });

  it("대표 이미지가 연결되지 않았지만 waived면 '이미지 없이 진행'으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(
      makeInput({ featuredImageAttached: false, featuredImageWaived: true })
    );
    expect(summary.featuredImage).toBe("이미지 없이 진행");
  });

  it("대표 이미지가 연결되지 않고 waived도 아니면 없음으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(
      makeInput({ featuredImageAttached: false, featuredImageWaived: false })
    );
    expect(summary.featuredImage).toBe("없음");
  });

  it("publishGuardStatus=not_checked이면 미확인으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ publishGuardStatus: "not_checked" }));
    expect(summary.publishGuard).toBe("미확인");
  });

  it("publishGuardStatus=blocked이면 차단됨으로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ publishGuardStatus: "blocked" }));
    expect(summary.publishGuard).toBe("차단됨");
  });

  it("handoffStatus=completed면 checklist를 'handoff 완료'로 표시한다(준비됨보다 우선)", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(
      makeInput({ checklistPrepared: true, handoffStatus: "completed" })
    );
    expect(summary.checklist).toBe("handoff 완료");
  });

  it("체크리스트가 준비되지 않았으면 미준비로 표시한다", () => {
    const summary = getWordPressBlogWorkflowStatusSummary(makeInput({ checklistPrepared: false }));
    expect(summary.checklist).toBe("미준비");
  });
});

describe("getWordPressBlogNextRecommendedAction", () => {
  it("quality_status가 ready가 아니면 품질검사를 추천한다 (최우선)", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ qualityStatus: "draft", approvalStatus: "pending_review", draftExists: false })
    );
    expect(action.title).toBe("다음 단계: 품질검사 실행");
    expect(action.step).toBe(1);
  });

  it("품질검사는 통과했지만 승인이 안 됐으면 승인을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(makeInput({ approvalStatus: "pending_review" }));
    expect(action.title).toBe("다음 단계: 승인 요청 또는 승인");
    expect(action.step).toBe(2);
  });

  it("승인까지 됐지만 Draft가 없으면 Draft 생성을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(makeInput({ draftExists: false }));
    expect(action.title).toBe("다음 단계: WordPress Draft 생성");
    expect(action.description).toContain("아직 WordPress Draft가 없습니다");
    expect(action.step).toBe(3);
  });

  it("Draft까지 있지만 SEO metadata가 없으면 SEO Metadata 업데이트를 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(makeInput({ seoTitle: null }));
    expect(action.title).toBe("다음 단계: SEO Metadata 업데이트");
    expect(action.step).toBe(4);
  });

  it("SEO까지 준비됐지만 대표 이미지가 없고 media id도 없고 waived도 아니면 업로드 또는 이미지 없이 진행을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ featuredImageAttached: false, featuredImageWaived: false, featuredImageMediaIdPresent: false })
    );
    expect(action.title).toBe("다음 단계: 대표 이미지 업로드 또는 이미지 없이 진행");
    expect(action.step).toBe(5);
  });

  it("media id는 있지만 아직 연결되지 않았고 waived도 아니면 대표 이미지 연결을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ featuredImageAttached: false, featuredImageWaived: false, featuredImageMediaIdPresent: true })
    );
    expect(action.title).toBe("다음 단계: 대표 이미지 연결");
    expect(action.step).toBe(5);
  });

  it("대표 이미지까지 waived로 해결됐지만 publish guard를 아직 안 돌렸으면 게시 가능 상태 확인을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ featuredImageAttached: false, featuredImageWaived: true, publishGuardStatus: "not_checked" })
    );
    expect(action.title).toBe("다음 단계: 게시 가능 상태 확인");
    expect(action.step).toBe(6);
  });

  it("체크리스트가 아직 준비되지 않았으면 게시 체크리스트 만들기를 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(makeInput({ checklistPrepared: false }));
    expect(action.title).toBe("다음 단계: 게시 체크리스트 만들기");
    expect(action.step).toBe(7);
  });

  it("체크리스트에 확인 필요 항목이 남아 있으면 확인 필요 항목 검토를 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(makeInput({ checklistNeedsReviewCount: 8 }));
    expect(action.title).toBe("다음 단계: 확인 필요 항목 검토");
    expect(action.step).toBe(7);
  });

  it("확인 필요 항목은 없지만 게시 URL이 기록되지 않았으면 게시 URL 기록을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ checklistNeedsReviewCount: 0, checklistUrlMissing: true })
    );
    expect(action.title).toBe("다음 단계: 게시 URL 기록");
    expect(action.step).toBe(7);
  });

  it("체크리스트가 모두 완료되면 완료됨을 추천한다", () => {
    const action = getWordPressBlogNextRecommendedAction(
      makeInput({ checklistNeedsReviewCount: 0, checklistUrlMissing: false })
    );
    expect(action.title).toBe("다음 단계: 완료됨");
    expect(action.step).toBe(7);
  });
});
