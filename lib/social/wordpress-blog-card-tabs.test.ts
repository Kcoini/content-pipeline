import { describe, expect, it } from "vitest";
import {
  WORDPRESS_BLOG_CARD_TABS,
  normalizeWordPressBlogCardTab,
  getTabForWorkflowStep,
  getWordPressBlogCardTabBadges,
  type WordPressBlogCardTabBadgeInput,
} from "./wordpress-blog-card-tabs";

function makeBadgeInput(overrides: Partial<WordPressBlogCardTabBadgeInput> = {}): WordPressBlogCardTabBadgeInput {
  return {
    qualityStatus: "완료",
    approvalStatus: "승인됨",
    draftStatus: "생성됨",
    seoStatus: "준비됨",
    publishGuardStatus: "ready",
    featuredImageStatus: "연결됨",
    checklistStatus: "준비됨",
    checklistNeedsReviewCount: 0,
    ...overrides,
  };
}

describe("WORDPRESS_BLOG_CARD_TABS", () => {
  it("6개 탭(글 내용/미리보기/품질승인/WordPress 반영/대표 이미지/체크리스트)을 정의한다", () => {
    expect(WORDPRESS_BLOG_CARD_TABS.map((t) => t.key)).toEqual(["content", "preview", "quality", "wordpress", "image", "checklist"]);
  });
});

describe("normalizeWordPressBlogCardTab", () => {
  it("유효한 tab 값은 그대로 반환한다", () => {
    expect(normalizeWordPressBlogCardTab("image")).toBe("image");
    expect(normalizeWordPressBlogCardTab("checklist")).toBe("checklist");
  });

  it("모르는 값이나 undefined면 기본 탭(content)으로 되돌린다", () => {
    expect(normalizeWordPressBlogCardTab("unknown")).toBe("content");
    expect(normalizeWordPressBlogCardTab(undefined)).toBe("content");
    expect(normalizeWordPressBlogCardTab(null)).toBe("content");
  });
});

describe("getTabForWorkflowStep", () => {
  it("step 1/2는 quality 탭으로 이동한다", () => {
    expect(getTabForWorkflowStep(1)).toBe("quality");
    expect(getTabForWorkflowStep(2)).toBe("quality");
  });

  it("step 3/4는 wordpress 탭으로 이동한다", () => {
    expect(getTabForWorkflowStep(3)).toBe("wordpress");
    expect(getTabForWorkflowStep(4)).toBe("wordpress");
  });

  it("step 5는 image 탭으로 이동한다", () => {
    expect(getTabForWorkflowStep(5)).toBe("image");
  });

  it("step 6/7은 checklist 탭으로 이동한다", () => {
    expect(getTabForWorkflowStep(6)).toBe("checklist");
    expect(getTabForWorkflowStep(7)).toBe("checklist");
  });
});

describe("getWordPressBlogCardTabBadges", () => {
  it("품질검사/승인이 모두 끝나면 quality 탭은 완료다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput()).quality).toBe("완료");
  });

  it("품질검사 또는 승인이 안 끝나면 quality 탭은 필요다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ qualityStatus: "필요" })).quality).toBe("필요");
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ approvalStatus: "승인 필요" })).quality).toBe("필요");
  });

  it("Draft/SEO/guard가 모두 준비되면 wordpress 탭은 완료다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput()).wordpress).toBe("완료");
  });

  it("Draft/SEO/guard 중 하나라도 준비 안 되면 wordpress 탭은 필요다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ draftStatus: "없음" })).wordpress).toBe("필요");
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ seoStatus: "누락" })).wordpress).toBe("필요");
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ publishGuardStatus: "미확인" })).wordpress).toBe("필요");
  });

  it("대표 이미지가 연결되었거나 이미지 없이 진행이면 image 탭은 완료다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ featuredImageStatus: "연결됨" })).image).toBe("완료");
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ featuredImageStatus: "이미지 없이 진행" })).image).toBe("완료");
  });

  it("대표 이미지가 없으면 image 탭은 확인 필요다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ featuredImageStatus: "없음" })).image).toBe("확인 필요");
  });

  it("확인 필요 항목이 남아 있으면 checklist 탭은 확인 필요다(다른 상태보다 우선)", () => {
    expect(
      getWordPressBlogCardTabBadges(makeBadgeInput({ checklistStatus: "handoff 완료", checklistNeedsReviewCount: 3 })).checklist
    ).toBe("확인 필요");
  });

  it("확인 필요 항목이 없고 준비됨/handoff 완료면 checklist 탭은 완료다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ checklistStatus: "준비됨" })).checklist).toBe("완료");
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ checklistStatus: "handoff 완료" })).checklist).toBe("완료");
  });

  it("체크리스트가 아직 미준비면 checklist 탭은 필요다", () => {
    expect(getWordPressBlogCardTabBadges(makeBadgeInput({ checklistStatus: "미준비" })).checklist).toBe("필요");
  });
});
