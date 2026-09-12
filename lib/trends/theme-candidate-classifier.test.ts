import { describe, expect, it } from "vitest";
import { classifyThemeCandidate, type ExistingThemeContext } from "./theme-candidate-classifier";
import { normalizeThemeKey } from "./theme-normalization";
import type { Theme, ThemeCluster } from "@/lib/types/domain";

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: "theme-1",
    title: "AI 동행",
    description: "고령자 돌봄을 지원하는 AI 서비스 동향",
    keywords: ["AI", "고령자", "돌봄"],
    language: "ko",
    createdAt: "2026-09-09T00:00:00.000Z",
    metadata: {},
    archivedAt: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<ExistingThemeContext> = {}): ExistingThemeContext {
  const theme = overrides.theme ?? makeTheme();
  return {
    sourceUrls: ["https://example.com/a", "https://example.com/b"],
    sourceCount: 2,
    hasMasterManuscript: true,
    hasSocialPosts: false,
    lastUpdatedAt: "2026-09-09T00:00:00.000Z",
    ...overrides,
    theme,
  };
}

function makeCluster(overrides: Partial<ThemeCluster> = {}): ThemeCluster {
  const title = overrides.title ?? "AI 동행";
  return {
    id: "cluster-1",
    title,
    description: "고령자 돌봄을 지원하는 AI 서비스 동향",
    keywords: ["AI", "고령자", "돌봄"],
    naverCount: 3,
    daumCount: 1,
    score: 4,
    status: "candidate",
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    normalizedKey: normalizeThemeKey(title),
    subtopics: [],
    evidence: [],
    seenCount: 1,
    lastSeenAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("classifyThemeCandidate", () => {
  it("normalizedThemeKey가 같고 새 URL이 없으면 duplicate_theme으로 분류한다", () => {
    const context = makeContext({ sourceUrls: ["https://example.com/a", "https://example.com/b"] });
    const cluster = makeCluster({
      evidence: [
        { platform: "naver", title: "기사 A", url: "https://example.com/a" },
        { platform: "daum", title: "기사 B", url: "https://example.com/b" },
      ],
    });

    const result = classifyThemeCandidate(cluster, [context]);

    expect(result.classification).toBe("duplicate_theme");
    expect(result.matchedExistingTheme?.id).toBe(context.theme.id);
    expect(result.newUrlCount).toBe(0);
    expect(result.duplicateUrlCount).toBe(2);
  });

  it("같은 key이지만 새 URL이 있으면 existing_theme_update로 분류된다", () => {
    const context = makeContext({ sourceUrls: ["https://example.com/a"] });
    const cluster = makeCluster({
      evidence: [
        { platform: "naver", title: "기사 A", url: "https://example.com/a" },
        { platform: "naver", title: "기사 C", url: "https://example.com/c" },
        { platform: "daum", title: "기사 D", url: "https://example.com/d" },
      ],
    });

    const result = classifyThemeCandidate(cluster, [context]);

    expect(result.classification).toBe("existing_theme_update");
    expect(result.newUrlCount).toBe(2);
    expect(result.duplicateUrlCount).toBe(1);
    expect(result.newUrls).toEqual(["https://example.com/c", "https://example.com/d"]);
  });

  it("같은 이름이지만 키워드/요약이 다르면 needs_review로 분류된다", () => {
    const context = makeContext({
      theme: makeTheme({
        title: "AI 동행",
        description: "고령자 돌봄을 지원하는 AI 서비스",
        keywords: ["고령자", "돌봄", "복지"],
      }),
    });
    const cluster = makeCluster({
      title: "AI 동행",
      description: "기업 업무 자동화를 돕는 협업 AI 도구",
      keywords: ["업무자동화", "협업", "생산성"],
      normalizedKey: normalizeThemeKey("AI 동행"),
      evidence: [{ platform: "naver", title: "기사 E", url: "https://example.com/e" }],
    });

    const result = classifyThemeCandidate(cluster, [context]);

    expect(result.classification).toBe("needs_review");
    expect(result.matchedExistingTheme?.id).toBe(context.theme.id);
    expect(result.onlyExistingKeywords.length).toBeGreaterThan(0);
    expect(result.onlyCandidateKeywords.length).toBeGreaterThan(0);
  });

  it("기존 테마와 유사하지 않으면 new_theme으로 분류된다", () => {
    const context = makeContext({
      theme: makeTheme({ title: "반도체 시장 및 수출", keywords: ["반도체", "수출"] }),
    });
    const cluster = makeCluster({
      title: "전기차 배터리 산업",
      description: "전기차 보조금과 배터리 기술 경쟁",
      keywords: ["전기차", "배터리"],
      normalizedKey: normalizeThemeKey("전기차 배터리 산업"),
      evidence: [{ platform: "naver", title: "기사 F", url: "https://example.com/f" }],
    });

    const result = classifyThemeCandidate(cluster, [context]);

    expect(result.classification).toBe("new_theme");
    expect(result.matchedExistingTheme).toBeNull();
    expect(result.newUrlCount).toBe(1);
  });

  it("기존 테마가 하나도 없으면 항상 new_theme이다", () => {
    const cluster = makeCluster({ evidence: [{ platform: "naver", title: "기사 G", url: "https://example.com/g" }] });
    const result = classifyThemeCandidate(cluster, []);
    expect(result.classification).toBe("new_theme");
    expect(result.similarityScore).toBeNull();
  });
});
