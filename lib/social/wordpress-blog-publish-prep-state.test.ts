import { describe, expect, it } from "vitest";
import { getWordPressPublishPrepState, type WordPressPublishPrepStateInput } from "./wordpress-blog-publish-prep-state";

function makeInput(overrides: Partial<WordPressPublishPrepStateInput> = {}): WordPressPublishPrepStateInput {
  return {
    bodyExists: true,
    qualityStatus: "ready",
    approvalStatus: "approved",
    draftExists: true,
    draftUrl: "https://example.com/?p=64",
    seoTitle: "제목",
    metaDescription: "설명",
    targetKeyword: "키워드",
    featuredImageAttached: true,
    featuredImageWaived: false,
    featuredImageMediaIdPresent: true,
    checklistPrepared: true,
    publishGuardStatus: "ready",
    ...overrides,
  };
}

describe("getWordPressPublishPrepState", () => {
  it("모든 조건이 충족되면 게시 준비 완료 상태를 반환하고 primary는 Draft 보기다", () => {
    const state = getWordPressPublishPrepState(makeInput());

    expect(state.statusLabel).toBe("게시 준비 완료");
    expect(state.canReflectToWordPress).toBe(true);
    expect(state.primaryAction).toEqual({ label: "WordPress Draft 보기", actionType: "view_draft", href: "https://example.com/?p=64" });
    expect(state.remainingItems).toEqual([]);
    expect(state.blockingReasons).toEqual([]);
  });

  it("본문이 없으면 primary가 [WordPress 블로그 글 생성]이다", () => {
    const state = getWordPressPublishPrepState(makeInput({ bodyExists: false }));
    expect(state.primaryAction).toEqual({ label: "WordPress 블로그 글 생성", actionType: "generate_post" });
    expect(state.statusLabel).toBe("본문 작성 필요");
  });

  it("품질검사가 안 되었으면(not_checked) primary가 [품질검사 실행]이다", () => {
    const state = getWordPressPublishPrepState(makeInput({ qualityStatus: "not_checked" }));
    expect(state.primaryAction).toEqual({ label: "품질검사 실행", actionType: "run_quality_gate" });
  });

  it("품질검사가 blocked/needs_revision이면 primary가 [문제 확인하기]다", () => {
    const state = getWordPressPublishPrepState(makeInput({ qualityStatus: "needs_revision" }));
    expect(state.primaryAction).toEqual({ label: "문제 확인하기", actionType: "review_quality_issues" });
    expect(state.statusLabel).toBe("품질 문제 확인 필요");
  });

  it("approval_status가 approved가 아니면 primary가 [최종 승인하기]다", () => {
    const state = getWordPressPublishPrepState(makeInput({ approvalStatus: "pending_review" }));
    expect(state.primaryAction).toEqual({ label: "최종 승인하기", actionType: "approve" });
    expect(state.canReflectToWordPress).toBe(false);
  });

  it("대표 이미지가 없고 waiver도 없으면 primary가 [대표 이미지 설정하기]다", () => {
    const state = getWordPressPublishPrepState(
      makeInput({ featuredImageAttached: false, featuredImageWaived: false, featuredImageMediaIdPresent: false })
    );
    expect(state.primaryAction).toEqual({ label: "대표 이미지 설정하기", actionType: "set_featured_image" });
    expect(state.secondaryActions).toContainEqual({ label: "이미지 없이 진행", actionType: "waive_featured_image" });
  });

  it("media id는 있지만 아직 연결되지 않았으면 primary 문구가 '연결하기'로 바뀐다", () => {
    const state = getWordPressPublishPrepState(
      makeInput({ featuredImageAttached: false, featuredImageWaived: false, featuredImageMediaIdPresent: true })
    );
    expect(state.primaryAction.label).toBe("대표 이미지 연결하기");
  });

  it("체크리스트가 미준비이면 [게시 체크리스트 만들기]가 남은 작업/secondary로 표시된다", () => {
    const state = getWordPressPublishPrepState(makeInput({ checklistPrepared: false }));
    expect(state.remainingItems).toContain("게시 체크리스트 미준비");
  });

  it("Draft가 없으면 primary가 [WordPress Draft 만들기]다", () => {
    const state = getWordPressPublishPrepState(makeInput({ draftExists: false }));
    expect(state.primaryAction).toEqual({ label: "WordPress Draft 만들기", actionType: "create_draft" });
  });

  it("Draft가 있고 나머지가 갖춰졌지만 guard가 ready가 아니면 [WordPress Draft 최종 반영]이 primary다", () => {
    const state = getWordPressPublishPrepState(makeInput({ publishGuardStatus: "not_checked" }));
    expect(state.primaryAction).toEqual({ label: "WordPress Draft 최종 반영", actionType: "update_draft" });
  });

  it("publish_guard_status가 blocked이면 canReflectToWordPress가 false다", () => {
    const state = getWordPressPublishPrepState(makeInput({ publishGuardStatus: "blocked" }));
    expect(state.canReflectToWordPress).toBe(false);
  });

  it("SEO 정보가 없으면 [SEO 정보 반영하기]가 primary다(이미지/체크리스트가 갖춰진 뒤)", () => {
    const state = getWordPressPublishPrepState(makeInput({ seoTitle: null }));
    expect(state.primaryAction).toEqual({ label: "SEO 정보 반영하기", actionType: "reflect_seo" });
  });

  describe("현재 예시 상태(quality ready/approved/Draft 있음/SEO 준비/이미지 없음/체크리스트 미준비/guard blocked)", () => {
    const input = makeInput({
      featuredImageAttached: false,
      featuredImageWaived: false,
      featuredImageMediaIdPresent: false,
      checklistPrepared: false,
      publishGuardStatus: "blocked",
    });
    const state = getWordPressPublishPrepState(input);

    it("상태 요약은 '대표 이미지와 체크리스트 확인 필요'다", () => {
      expect(state.statusLabel).toBe("대표 이미지와 체크리스트 확인 필요");
    });

    it("완료된 작업에 품질검사/승인/Draft/SEO가 포함된다", () => {
      expect(state.completedItems).toEqual(
        expect.arrayContaining(["품질검사 완료", "승인 완료", "WordPress Draft 생성됨", "SEO 정보 준비됨"])
      );
    });

    it("남은 작업에 대표 이미지/체크리스트가 포함된다", () => {
      expect(state.remainingItems).toEqual(["대표 이미지 없음", "게시 체크리스트 미준비"]);
    });

    it("primary는 대표 이미지 설정하기다", () => {
      expect(state.primaryAction).toEqual({ label: "대표 이미지 설정하기", actionType: "set_featured_image" });
    });

    it("secondary에 이미지 없이 진행/체크리스트 만들기/Draft 보기가 포함된다", () => {
      expect(state.secondaryActions).toEqual(
        expect.arrayContaining([
          { label: "이미지 없이 진행", actionType: "waive_featured_image" },
          { label: "게시 체크리스트 만들기", actionType: "prepare_checklist" },
          { label: "WordPress Draft 보기", actionType: "view_draft", href: "https://example.com/?p=64" },
        ])
      );
    });

    it("canReflectToWordPress는 false다(publish guard blocked)", () => {
      expect(state.canReflectToWordPress).toBe(false);
    });

    it("blockingReasons에 완전한 문장이 담긴다", () => {
      expect(state.blockingReasons).toEqual([
        "대표 이미지가 없습니다.",
        "게시 체크리스트가 아직 준비되지 않았습니다.",
      ]);
    });
  });
});
