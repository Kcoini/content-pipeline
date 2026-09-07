import { describe, expect, it } from "vitest";
import { extractDomain, summarizeSourceStatus, resolveDashboardWorkflowState } from "./source-display";

describe("extractDomain", () => {
  it("URL에서 도메인만 추출한다", () => {
    expect(extractDomain("https://www.example.com/article/123?query=1")).toBe("example.com");
  });

  it("www. 접두사를 제거한다", () => {
    expect(extractDomain("https://www.naver.com")).toBe("naver.com");
  });

  it("URL이 없으면 안내 문구를 반환한다", () => {
    expect(extractDomain(null)).toBe("(URL 없음)");
    expect(extractDomain("")).toBe("(URL 없음)");
  });

  it("파싱할 수 없는 문자열이면 원본을 그대로 반환한다", () => {
    expect(extractDomain("not-a-valid-url")).toBe("not-a-valid-url");
  });
});

describe("summarizeSourceStatus", () => {
  it("등록 개수/조건 충족 여부/수집·요약 현황을 계산한다", () => {
    const sources = [
      { fetchStatus: "success", summaryStatus: "success" },
      { fetchStatus: "success", summaryStatus: "failed" },
      { fetchStatus: "failed", summaryStatus: "skipped" },
    ];

    const summary = summarizeSourceStatus(sources, 3);

    expect(summary).toEqual({
      total: 3,
      minRequired: 3,
      isReady: true,
      fetchSuccessCount: 2,
      summarySuccessCount: 1,
      fetchFailedCount: 1,
      summaryFailedCount: 1,
    });
  });

  it("등록된 출처가 최소 개수 미만이면 isReady가 false다", () => {
    const summary = summarizeSourceStatus([{ fetchStatus: "success", summaryStatus: "success" }], 3);
    expect(summary.isReady).toBe(false);
  });

  it("출처가 없으면 모든 카운트가 0이다", () => {
    const summary = summarizeSourceStatus([], 3);
    expect(summary.total).toBe(0);
    expect(summary.isReady).toBe(false);
  });
});

// Phase 3-23-2: 대시보드 상태 판단은 이 함수 하나로 통합되었다
// (예전에 있던 resolveNextActionState/NextActionState는 서로 모순된
// 안내를 낼 수 있어 제거했다 — 더 이상 이 모듈에 존재하지 않는다).
describe("resolveDashboardWorkflowState (Phase 3-23 / 3-23-2)", () => {
  const base = {
    hasTheme: true,
    sourceCount: 0,
    minRequired: 3,
    hasArticle: false,
    socialPostCount: 0,
    approvedSocialPostCount: 0,
  };

  it("선택된 테마가 없으면 다른 값과 무관하게 needs_theme를 반환한다", () => {
    expect(resolveDashboardWorkflowState({ ...base, hasTheme: false })).toBe("needs_theme");
    expect(
      resolveDashboardWorkflowState({
        ...base,
        hasTheme: false,
        hasArticle: true,
        socialPostCount: 5,
        approvedSocialPostCount: 1,
      })
    ).toBe("needs_theme");
  });

  it("기사가 없고 출처가 부족하면 needs_source를 반환한다", () => {
    expect(resolveDashboardWorkflowState({ ...base, sourceCount: 1 })).toBe("needs_source");
  });

  it("기사가 없고 출처가 충분하면 ready_to_generate를 반환한다", () => {
    expect(resolveDashboardWorkflowState({ ...base, sourceCount: 3 })).toBe("ready_to_generate");
  });

  it("기사가 있고 플랫폼 글이 없으면 needs_platform_posts를 반환한다", () => {
    expect(resolveDashboardWorkflowState({ ...base, sourceCount: 3, hasArticle: true })).toBe("needs_platform_posts");
  });

  it("플랫폼 글이 있지만 승인된 것이 없으면 needs_review를 반환한다", () => {
    expect(
      resolveDashboardWorkflowState({ ...base, sourceCount: 3, hasArticle: true, socialPostCount: 2 })
    ).toBe("needs_review");
  });

  it("승인된 플랫폼 글이 하나라도 있으면 ready_for_publish_prep을 반환한다", () => {
    expect(
      resolveDashboardWorkflowState({
        ...base,
        sourceCount: 3,
        hasArticle: true,
        socialPostCount: 3,
        approvedSocialPostCount: 1,
      })
    ).toBe("ready_for_publish_prep");
  });
});
