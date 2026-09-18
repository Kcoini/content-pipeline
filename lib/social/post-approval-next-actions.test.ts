import { describe, expect, it } from "vitest";
import { getPostApprovalNextActions } from "./post-approval-next-actions";

describe("getPostApprovalNextActions", () => {
  it("wordpress_blog + Draft 없음 → primary는 [WordPress Draft 만들기]", () => {
    const result = getPostApprovalNextActions({ platform: "wordpress_blog", wordpressDraftExists: false });
    expect(result.primaryAction).toEqual({ label: "WordPress Draft 만들기", actionType: "create_wordpress_draft" });
  });

  it("wordpress_blog + Draft 있음 + 게시 준비 완료 → primary는 [WordPress Draft 보기]", () => {
    const result = getPostApprovalNextActions({
      platform: "wordpress_blog",
      wordpressDraftExists: true,
      wordpressPublishGuardReady: true,
    });
    expect(result.primaryAction).toEqual({ label: "WordPress Draft 보기", actionType: "view_wordpress_draft" });
  });

  it("wordpress_blog + Draft 있음 + 게시 준비 미완료 → primary는 [게시 준비 확인]", () => {
    const result = getPostApprovalNextActions({
      platform: "wordpress_blog",
      wordpressDraftExists: true,
      wordpressPublishGuardReady: false,
    });
    expect(result.primaryAction).toEqual({ label: "게시 준비 확인", actionType: "check_wordpress_publish_readiness" });
  });

  it("naver_cafe + API 미연결 → primary는 [본문 복사]", () => {
    const result = getPostApprovalNextActions({ platform: "naver_cafe", apiConfigured: false });
    expect(result.primaryAction).toEqual({ label: "본문 복사", actionType: "copy_body" });
    expect(result.secondaryActions).not.toContainEqual({ label: "API 게시 준비 확인", actionType: "check_api_readiness" });
  });

  it("naver_cafe + API 연결됨 → secondary에 [API 게시 준비 확인]이 있다(primary는 여전히 본문 복사 — 실제 게시 버튼은 아직 없다)", () => {
    const result = getPostApprovalNextActions({ platform: "naver_cafe", apiConfigured: true });
    expect(result.primaryAction).toEqual({ label: "본문 복사", actionType: "copy_body" });
    expect(result.secondaryActions).toContainEqual({ label: "API 게시 준비 확인", actionType: "check_api_readiness" });
  });

  it("x/threads/instagram도 naver_cafe와 같은 규칙을 따른다", () => {
    for (const platform of ["x", "threads", "instagram"] as const) {
      const result = getPostApprovalNextActions({ platform, apiConfigured: false });
      expect(result.primaryAction.actionType).toBe("copy_body");
    }
  });

  it("naver_blog는 [본문 복사]가 primary이고 [수동 export 준비]가 secondary다", () => {
    const result = getPostApprovalNextActions({ platform: "naver_blog" });
    expect(result.primaryAction).toEqual({ label: "본문 복사", actionType: "copy_body" });
    expect(result.secondaryActions).toContainEqual({ label: "수동 export 준비", actionType: "prepare_manual_export" });
  });

  it("news_article/opinion_column은 naver_blog와 같은 규칙(본문 복사 + 수동 export 준비)을 따른다", () => {
    for (const platform of ["news_article", "opinion_column"] as const) {
      const result = getPostApprovalNextActions({ platform });
      expect(result.primaryAction).toEqual({ label: "본문 복사", actionType: "copy_body" });
      expect(result.secondaryActions).toContainEqual({ label: "수동 export 준비", actionType: "prepare_manual_export" });
    }
  });

  it("모든 분기에서 primaryAction이 항상 존재하고, secondaryActions에 [본문 복사] 또는 [상세 보기] 중 하나 이상을 포함한다(빈 다음 작업 방지)", () => {
    const platforms = ["wordpress_blog", "naver_blog", "naver_cafe", "x", "threads", "instagram", "news_article", "opinion_column"] as const;
    for (const platform of platforms) {
      const result = getPostApprovalNextActions({ platform });
      expect(result.primaryAction).toBeTruthy();
      expect(result.primaryAction.label.length).toBeGreaterThan(0);
      const allLabels = [result.primaryAction, ...result.secondaryActions].map((a) => a.label);
      expect(allLabels.some((label) => label === "본문 복사" || label === "상세 보기")).toBe(true);
    }
  });

  it("message는 항상 비어 있지 않은 문자열이다", () => {
    const result = getPostApprovalNextActions({ platform: "wordpress_blog" });
    expect(result.message.length).toBeGreaterThan(0);
  });
});
