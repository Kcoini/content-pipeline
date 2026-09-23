import "./load-env";
import { describe, it, expect } from "vitest";
import { getArticleById } from "@/lib/repositories/article-repository";
import { evaluateArticleModeWithAi, loadEvalConfig } from "@/lib/ai/eval-article";
import { getArticleModeConfig } from "@/lib/articles/article-modes";

// OPS-02A: controlled real-provider verification that the max_tokens fix
// resolves the actual Pilot A truncation bug. One real Anthropic call.
describe("OPS-02A verification: monetized_blog eval no longer truncates for the real Pilot A article", () => {
  it("aggregateScore is a genuine score, not a truncation-induced 0", async () => {
    const article = await getArticleById("3b94f78b-680b-46e0-b9c7-a0033a287f2d");
    if (!article) throw new Error("article not found");

    const modeConfig = getArticleModeConfig("monetized_blog");
    const evalConfig = loadEvalConfig(modeConfig.evalFileName);

    const result = await evaluateArticleModeWithAi(article, [], evalConfig);

    console.log("aggregateScore:", result.aggregateScore);
    console.log("passed:", result.passed);
    console.log("notes empty?:", result.notes === "");
    console.log("criteriaScores count:", Object.keys(result.criteriaScores).length);
    console.log("any score > 0?:", Object.values(result.criteriaScores).some((c) => c.score > 0));

    expect(Object.keys(result.criteriaScores).length).toBe(evalConfig.criteria.length);
    expect(result.notes).not.toContain("평가 실행 실패");
    expect(Object.values(result.criteriaScores).some((c) => c.score > 0)).toBe(true);
  });
});
