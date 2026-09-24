import { describe, expect, it } from "vitest";
import {
  fromWordPressPublishPrepStateToPublishPreparation,
  fromPostApprovalNextActionsToPublishPreparation,
  notApprovedPublishPreparation,
  getPublishCapability,
  describePublishCapability,
  describePublishPreparationState,
} from "./publish-preparation-view-model";
import { getWordPressPublishPrepState } from "@/lib/social/wordpress-blog-publish-prep-state";
import { getPostApprovalNextActions } from "@/lib/social/post-approval-next-actions";

function makeWordPressPrepInput(overrides: Partial<Parameters<typeof getWordPressPublishPrepState>[0]> = {}) {
  return {
    bodyExists: true,
    qualityStatus: "ready",
    approvalStatus: "approved",
    draftExists: true,
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

describe("PublishPreparationState mapping (Phase UX-05A)", () => {
  it("not_approved: 승인 전이면 어떤 플랫폼이든 not_approved다", () => {
    const vm = notApprovedPublishPreparation("wordpress_blog");
    expect(vm.state).toBe("not_approved");
    expect(vm.title).toBe("승인 필요");
  });

  it("needs_attention: WordPress 대표 이미지/체크리스트 등 미해결 항목이 있으면 needs_attention이다", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput({ featuredImageAttached: false, featuredImageWaived: false }));
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(vm.state).toBe("needs_attention");
  });

  it("needs_setup: WordPress publish guard가 준비되지 않았으면 게시 준비 액션이 필요하다(ready로 표시 — 실제 액션 가능)", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput({ publishGuardStatus: "needs_revision" }));
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.type).toBe("update_draft");
  });

  it("ready: WordPress Draft가 없고 승인 완료된 상태면 ready다(Draft 만들기 가능)", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput({ draftExists: false }));
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(vm.state).toBe("ready");
    expect(vm.primaryAction?.type).toBe("create_draft");
  });

  it("completed: publishStatus===published면 completed로 강제 override된다", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput());
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "published");
    expect(vm.state).toBe("completed");
  });

  it("failed: publishStatus===failed면 failed다", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput());
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "failed");
    expect(vm.state).toBe("failed");
  });

  it("in_progress 상태는 이 어댑터에서 직접 만들지 않는다(비동기 job이 있는 화면에서 호출부가 별도로 표시)", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput());
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(vm.state).not.toBe("in_progress");
  });

  it("raw enum(approve/create_draft 등 action type)이 title/message에 직접 노출되지 않는다", () => {
    const prep = getWordPressPublishPrepState(makeWordPressPrepInput({ approvalStatus: "not_requested" }));
    const vm = fromWordPressPublishPrepStateToPublishPreparation(prep, "not_published");
    expect(vm.title).not.toContain("approve");
    expect(vm.title).not.toContain("not_requested");
  });

  it("platform capability에 맞는 primaryAction을 선택한다(WordPress=draft 흐름, naver_blog=manual 흐름)", () => {
    const wpVm = fromWordPressPublishPrepStateToPublishPreparation(
      getWordPressPublishPrepState(makeWordPressPrepInput({ draftExists: false })),
      "not_published"
    );
    expect(wpVm.primaryAction?.type).toBe("create_draft");

    const naverVm = fromPostApprovalNextActionsToPublishPreparation(
      "naver_blog",
      getPostApprovalNextActions({ platform: "naver_blog" }),
      "not_published"
    );
    expect(naverVm.primaryAction?.type).toBe("copy_body");
  });

  it("getPublishCapability는 실제 구현된 3가지 방식만 반환한다(direct_publish는 없음)", () => {
    expect(getPublishCapability("wordpress_blog")).toBe("draft");
    expect(getPublishCapability("naver_blog")).toBe("manual");
    expect(getPublishCapability("news_article")).toBe("manual");
    expect(getPublishCapability("opinion_column")).toBe("manual");
    expect(getPublishCapability("naver_cafe")).toBe("copy");
    expect(getPublishCapability("x")).toBe("copy");
    expect(getPublishCapability("threads")).toBe("copy");
    expect(getPublishCapability("instagram")).toBe("copy");
  });

  it("PRODUCT-01F: describePublishCapability는 draft/manual/copy를 서로 다른 한국어 문구로 구분한다(같은 의미로 섞이지 않는다)", () => {
    const draft = describePublishCapability("draft");
    const manual = describePublishCapability("manual");
    const copy = describePublishCapability("copy");
    expect(draft).toBe("초안으로 저장");
    expect(manual).toBe("외부에서 직접 게시");
    expect(copy).toBe("본문 복사 후 직접 게시");
    expect(new Set([draft, manual, copy]).size).toBe(3);
  });

  it("describePublishPreparationState는 7가지 상태 모두 한국어 라벨을 반환한다", () => {
    expect(describePublishPreparationState("not_approved")).toBe("승인 필요");
    expect(describePublishPreparationState("needs_attention")).toBe("확인 필요");
    expect(describePublishPreparationState("needs_setup")).toBe("게시 설정 필요");
    expect(describePublishPreparationState("ready")).toBe("게시 준비 완료");
    expect(describePublishPreparationState("in_progress")).toBe("처리 중");
    expect(describePublishPreparationState("completed")).toBe("완료");
    expect(describePublishPreparationState("failed")).toBe("처리 실패");
  });
});

describe("fromPostApprovalNextActionsToPublishPreparation (Phase UX-05A)", () => {
  it("X 플랫폼도 '게시하기'가 아니라 '본문 복사'가 primary다(실제 direct publish 미구현)", () => {
    const vm = fromPostApprovalNextActionsToPublishPreparation("x", getPostApprovalNextActions({ platform: "x" }), "not_published");
    expect(vm.primaryAction?.label).toBe("본문 복사");
    expect(vm.primaryAction?.label).not.toBe("게시하기");
  });

  it("manualPostStatus===posted면 completed다", () => {
    const vm = fromPostApprovalNextActionsToPublishPreparation(
      "x",
      getPostApprovalNextActions({ platform: "x" }),
      "not_published",
      "posted"
    );
    expect(vm.state).toBe("completed");
  });

  it("manualPostStatus===failed면 failed다", () => {
    const vm = fromPostApprovalNextActionsToPublishPreparation(
      "naver_cafe",
      getPostApprovalNextActions({ platform: "naver_cafe" }),
      "not_published",
      "failed"
    );
    expect(vm.state).toBe("failed");
  });
});
