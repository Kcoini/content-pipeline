// Phase UX-06: Journey 1 — WordPress. "처음 사용하는 사용자가 테마/자료
// 선택 이후 WordPress 블로그 글을 승인하고 게시 준비까지 진행할 수
// 있는가?"를 실제 서비스 함수를 그대로 체이닝해서 검증한다. 이 파일은
// 새 business logic을 추가하지 않는다 — 이미 있는 순수 계산 함수만
// 그대로 호출한다(mock이 필요 없다: getWordPressPublishPrepState/
// getApprovalGateStatus/fromWordPressPublishPrepStateToPublishPreparation은
// 전부 DB를 읽지 않는 순수 함수다).
//
// 사용자 click/판단 단계 tally(수동 계산, 참고용 — 새 인프라 아님):
//   사람이 직접 눌러야 하는 것: 품질검사 실행(필요시) → 최종 승인 →
//     WordPress Draft 만들기 → (이미지/체크리스트/SEO 등 남은 항목 처리) →
//     Draft 반영 = 최대 5회
//   시스템이 자동으로 하는 것: 자동 검토(quality gate), 자동 수정
//     (auto_fixable 문제만 있을 때 생성 직후 1회) = 2단계
//   반복되는 불필요 click: 없음(같은 primaryAction이 상태가 바뀔 때마다
//     다른 label/actionType으로 바뀐다 — 완료된 action이 다시 primary로
//     나오지 않음, getWordPressPublishPrepState의 우선순위 계산이 보장)

import { describe, expect, it } from "vitest";
import { getWordPressPublishPrepState, type WordPressPublishPrepStateInput } from "@/lib/social/wordpress-blog-publish-prep-state";
import { fromWordPressPublishPrepStateToPublishPreparation } from "@/lib/ui/publish-preparation-view-model";
import { getApprovalGateStatus } from "@/lib/social/social-post-auto-review";

function makePrepInput(overrides: Partial<WordPressPublishPrepStateInput> = {}): WordPressPublishPrepStateInput {
  return {
    bodyExists: true,
    qualityStatus: "ready",
    approvalStatus: "approved",
    draftExists: false,
    featuredImageAttached: true,
    featuredImageWaived: false,
    featuredImageMediaIdPresent: true,
    checklistPrepared: true,
    seoTitle: "제목",
    metaDescription: "설명",
    targetKeyword: "키워드",
    publishGuardStatus: "ready",
    ...overrides,
  };
}

describe("Journey 1 — WordPress: 승인 전 → 승인 → 게시 준비 → Draft (Phase UX-06)", () => {
  it("1단계: 승인 전에는 getApprovalGateStatus가 승인을 막는다(자동 검토 미실행)", () => {
    const gate = getApprovalGateStatus({
      qualityStatus: "not_checked",
      approvalStatus: "not_requested",
      publishStatus: "not_published",
      hasContent: true,
      hasBlockingIssues: false,
    });
    expect(gate.canApprove).toBe(false);
    expect(gate.reason).toContain("자동 검토를 실행해야");
  });

  it("2단계: 자동 검토 통과 + 아직 승인 전이면 승인 가능 상태다", () => {
    const gate = getApprovalGateStatus({
      qualityStatus: "ready",
      approvalStatus: "not_requested",
      publishStatus: "not_published",
      hasContent: true,
      hasBlockingIssues: false,
    });
    expect(gate.canApprove).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it("3단계: 승인 전이면 WordPress 게시 준비의 primary action도 '승인'이지 Draft 관련이 아니다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ approvalStatus: "not_requested" }));
    expect(prep.primaryAction.actionType).toBe("approve");

    const preparation = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(preparation.state).toBe("not_approved");
  });

  it("4단계: 승인 완료 + Draft 없음 → primary action은 Draft 만들기다(공개 게시 아님)", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ draftExists: false }));
    expect(prep.primaryAction.actionType).toBe("create_draft");
    expect(prep.primaryAction.label).not.toContain("공개 게시");
    expect(prep.primaryAction.label).not.toContain("실제 게시");

    const preparation = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(preparation.state).toBe("ready");
    expect(preparation.primaryAction?.type).toBe("create_draft");
  });

  it("5단계: Draft 생성됨 + 나머지 항목 모두 충족 → Draft 보기가 primary다(여전히 '완료'가 아니라 'ready')", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ draftExists: true, draftUrl: "https://example.com/?p=1&preview=true" }));
    expect(prep.primaryAction.actionType).toBe("view_draft");

    const preparation = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    // 성공 계약: WordPress는 이 프로젝트 범위에서 publishStatus가
    // "published"에 도달하지 않는다 — Draft 준비 완료는 "ready"이지
    // "completed"(실제 외부 공개 게시 확인)가 아니다.
    expect(preparation.state).toBe("ready");
    expect(preparation.state).not.toBe("completed");
  });

  it("일반 흐름에서 public/실제 게시가 primary action으로 등장하지 않는다(모든 단계 전수 확인)", () => {
    const scenarios: WordPressPublishPrepStateInput[] = [
      makePrepInput({ approvalStatus: "not_requested" }),
      makePrepInput({ featuredImageAttached: false, featuredImageWaived: false }),
      makePrepInput({ checklistPrepared: false }),
      makePrepInput({ draftExists: false }),
      makePrepInput({ seoTitle: null }),
      makePrepInput({ draftExists: true, publishGuardStatus: "needs_revision" }),
      makePrepInput({ draftExists: true }),
    ];
    for (const scenario of scenarios) {
      const prep = getWordPressPublishPrepState(scenario);
      expect(prep.primaryAction.actionType).not.toBe("public_publish");
      expect(prep.primaryAction.label).not.toContain("공개 게시");
      expect(prep.primaryAction.label).not.toMatch(/^게시하기$/);
    }
  });

  it("승인 완료 후에는 '승인' primary action이 다시 나타나지 않는다(반복 노출 금지)", () => {
    const scenarios: WordPressPublishPrepStateInput[] = [
      makePrepInput({ featuredImageAttached: false, featuredImageWaived: false }),
      makePrepInput({ checklistPrepared: false }),
      makePrepInput({ draftExists: false }),
      makePrepInput({ draftExists: true }),
    ];
    for (const scenario of scenarios) {
      const prep = getWordPressPublishPrepState(scenario);
      expect(prep.primaryAction.actionType).not.toBe("approve");
    }
  });

  it("Draft 실패(재시도가 필요한 상태)에서도 dead-end가 없다 — publishGuardStatus가 문제여도 항상 실행 가능한 primary action이 있다", () => {
    const prep = getWordPressPublishPrepState(makePrepInput({ draftExists: true, publishGuardStatus: "failed" }));
    expect(prep.primaryAction).toBeTruthy();
    expect(prep.primaryAction.label.length).toBeGreaterThan(0);
  });

  it("성공 계약: 승인→Draft 생성까지 순서대로 진행하면 최종 state가 ready이고 primaryAction이 Draft 관련이다", () => {
    // 승인 전
    let prep = getWordPressPublishPrepState(makePrepInput({ approvalStatus: "not_requested" }));
    expect(prep.primaryAction.actionType).toBe("approve");
    // 승인 후, 아직 Draft 없음
    prep = getWordPressPublishPrepState(makePrepInput({ draftExists: false }));
    expect(prep.primaryAction.actionType).toBe("create_draft");
    // Draft 생성 후
    prep = getWordPressPublishPrepState(makePrepInput({ draftExists: true }));
    const finalPreparation = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(finalPreparation.state).toBe("ready");
    expect(["create_draft", "update_draft", "view_draft"]).toContain(finalPreparation.primaryAction?.type);
  });
});
