import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateSocialDraft = vi.fn();
const listSocialPostsByArticle = vi.fn();
const logEvent = vi.fn();

vi.mock("./social-draft-generation-service", () => ({
  generateSocialDraft: (...args: unknown[]) => generateSocialDraft(...args),
}));
vi.mock("@/lib/repositories/social-posts-repository", () => ({
  listSocialPostsByArticle: (...args: unknown[]) => listSocialPostsByArticle(...args),
}));
vi.mock("@/lib/harness/logger", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

const { generatePlatformPosts, generateSelectedPlatformPosts, generateAllPlatformPosts } = await import(
  "./multi-platform-generation-service"
);

beforeEach(() => {
  generateSocialDraft.mockReset();
  listSocialPostsByArticle.mockReset();
  logEvent.mockReset();
  listSocialPostsByArticle.mockResolvedValue([]);
  logEvent.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("generatePlatformPosts (Phase 3-21: 선택/전체 플랫폼 글 생성)", () => {
  it("이미 생성된 플랫폼은 건너뛰고, 없는 플랫폼만 생성한다(조용히 덮어쓰지 않는다)", async () => {
    listSocialPostsByArticle.mockResolvedValue([{ platform: "naver_blog", id: "existing-1" }]);
    generateSocialDraft.mockResolvedValue({ success: true, message: "생성 완료", socialPost: { id: "new-1" } });

    const summary = await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["wordpress_blog", "naver_blog"],
      toneMode: "auto_recommended",
    });

    expect(summary.results.find((r) => r.platform === "naver_blog")?.status).toBe("skipped_existing");
    expect(summary.results.find((r) => r.platform === "wordpress_blog")?.status).toBe("generated");
    expect(generateSocialDraft).toHaveBeenCalledTimes(1);
    expect(generateSocialDraft).toHaveBeenCalledWith("article-1", "wordpress_blog", expect.any(String));
  });

  it("한 플랫폼이 실패해도 나머지 플랫폼은 계속 처리한다", async () => {
    generateSocialDraft.mockImplementation(async (_articleId: string, platform: string) => {
      if (platform === "x") return { success: false, message: "AI 생성에 실패했습니다." };
      return { success: true, message: "생성 완료", socialPost: { id: `${platform}-post` } };
    });

    const summary = await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["x", "threads"],
      toneMode: "auto_recommended",
    });

    expect(summary.results.find((r) => r.platform === "x")?.status).toBe("failed");
    expect(summary.results.find((r) => r.platform === "threads")?.status).toBe("generated");
    expect(summary.failedCount).toBe(1);
    expect(summary.generatedCount).toBe(1);
  });

  it("예외가 발생해도 안전한 실패로 처리하고 나머지 플랫폼을 계속 진행한다", async () => {
    generateSocialDraft.mockImplementation(async (_articleId: string, platform: string) => {
      if (platform === "instagram") throw new Error("네트워크 오류");
      return { success: true, message: "생성 완료", socialPost: { id: `${platform}-post` } };
    });

    const summary = await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["instagram", "threads"],
      toneMode: "auto_recommended",
    });

    expect(summary.results.find((r) => r.platform === "instagram")?.status).toBe("failed");
    expect(summary.results.find((r) => r.platform === "instagram")?.message).toContain("네트워크 오류");
    expect(summary.results.find((r) => r.platform === "threads")?.status).toBe("generated");
  });

  it("toneMode=same_for_all이면 모든 플랫폼에 동일한 tone_style을 사용한다", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["wordpress_blog", "naver_blog"],
      toneMode: "same_for_all",
      uniformToneStyle: "warning",
    });

    for (const call of generateSocialDraft.mock.calls) {
      expect(call[2]).toBe("warning");
    }
  });

  it("toneMode=manual_per_platform이면 플랫폼별로 지정된 tone_style을 사용한다", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["wordpress_blog", "x"],
      toneMode: "manual_per_platform",
      toneStylesByPlatform: { wordpress_blog: "comparison", x: "curiosity" },
    });

    const wpCall = generateSocialDraft.mock.calls.find((c) => c[1] === "wordpress_blog");
    const xCall = generateSocialDraft.mock.calls.find((c) => c[1] === "x");
    expect(wpCall?.[2]).toBe("comparison");
    expect(xCall?.[2]).toBe("curiosity");
  });

  it("manual_per_platform인데 특정 플랫폼의 선택값이 없으면 추천 문체로 안전하게 대체한다(무반응 방지)", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    await generatePlatformPosts({
      articleId: "article-1",
      platforms: ["threads"],
      toneMode: "manual_per_platform",
      toneStylesByPlatform: {},
    });

    expect(generateSocialDraft).toHaveBeenCalledWith("article-1", "threads", expect.any(String));
  });

  it("자동 public publish 관련 함수를 호출하지 않는다(import 여부로 확인)", async () => {
    const moduleSource = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./multi-platform-generation-service.ts", import.meta.url), "utf-8")
    );
    expect(moduleSource).not.toMatch(/publishApprovedArticleToWordPress|publishWordPressPost|publishArticleToWordPressDraft/);
  });
});

describe("generateSelectedPlatformPosts (Phase 3-21)", () => {
  it("플랫폼을 하나도 선택하지 않으면 무반응 대신 명확한 오류를 반환한다", async () => {
    const result = await generateSelectedPlatformPosts({ articleId: "article-1", platforms: [], toneMode: "auto_recommended" });
    expect(result).toEqual({ error: "생성할 플랫폼을 1개 이상 선택하세요." });
    expect(generateSocialDraft).not.toHaveBeenCalled();
  });

  it("선택된 플랫폼만 생성한다", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    const result = await generateSelectedPlatformPosts({
      articleId: "article-1",
      platforms: ["naver_cafe"],
      toneMode: "auto_recommended",
    });

    expect("results" in result && result.results).toHaveLength(1);
    expect(generateSocialDraft).toHaveBeenCalledWith("article-1", "naver_cafe", expect.any(String));
  });
});

describe("generateAllPlatformPosts (Phase 3-21: 고급 옵션 — 전체 플랫폼)", () => {
  it("전체 7개 플랫폼(news_article 포함, Phase 4-3)을 대상으로 한다", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    const summary = await generateAllPlatformPosts({ articleId: "article-1", toneMode: "auto_recommended" });

    expect(summary.results).toHaveLength(7);
    expect(summary.results.map((r) => r.platform).sort()).toEqual(
      ["instagram", "naver_blog", "naver_cafe", "news_article", "threads", "wordpress_blog", "x"].sort()
    );
  });

  it("이미 생성된 플랫폼은 전체 생성에서도 기본적으로 건너뛴다", async () => {
    listSocialPostsByArticle.mockResolvedValue([{ platform: "x", id: "existing-x" }]);
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    const summary = await generateAllPlatformPosts({ articleId: "article-1", toneMode: "auto_recommended" });

    expect(summary.results.find((r) => r.platform === "x")?.status).toBe("skipped_existing");
    expect(summary.skippedCount).toBe(1);
  });

  it("비용 경고 표시/전체 생성 요청 로그를 기록한다", async () => {
    generateSocialDraft.mockResolvedValue({ success: true, message: "완료", socialPost: { id: "p1" } });

    await generateAllPlatformPosts({ articleId: "article-1", toneMode: "auto_recommended" });

    const loggedTypes = logEvent.mock.calls.map((call) => call[0].type);
    expect(loggedTypes).toContain("platform_generation_all_requested");
    expect(loggedTypes).toContain("platform_generation_cost_warning_shown");
  });
});
