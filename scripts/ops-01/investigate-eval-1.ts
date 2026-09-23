import "./load-env";
import { describe, it } from "vitest";
import { getAnthropicClient, ANTHROPIC_MODEL } from "@/lib/ai/anthropic-client";
import { getArticleById } from "@/lib/repositories/article-repository";
import { loadEvalConfig } from "@/lib/ai/eval-article";
import { getArticleModeConfig } from "@/lib/articles/article-modes";

// OPS-02A root-cause investigation for High "monetized_blog aggregateScore=0".
// One real, minimal Anthropic call to inspect the RAW tool_use input shape
// (no full pipeline re-run, no new article generated — reuses the real
// Pilot A article already stored in the DB). Read-only otherwise.

describe("OPS-02A investigation: raw AI tool_use shape for monetized_blog eval", () => {
  it("logs raw toolUseBlock.input keys (not full content)", async () => {
    const article = await getArticleById("3b94f78b-680b-46e0-b9c7-a0033a287f2d");
    if (!article) throw new Error("article not found");

    const modeConfig = getArticleModeConfig("monetized_blog");
    const evalConfig = loadEvalConfig(modeConfig.evalFileName);
    const criterionIds = evalConfig.criteria.map((c) => c.id);

    const client = getAnthropicClient();
    const tool = {
      name: "score_article",
      description: `기사 품질 평가 결과를 저장한다. ${criterionIds.length}개 기준 모두에 score(1-5 정수)와 reason을 반드시 포함해야 한다.`,
      input_schema: {
        type: "object" as const,
        properties: {
          criteria_scores: {
            type: "object",
            description: `각 기준 ID를 키, {score: 1~5 정수, reason: 한국어 근거}를 값으로 가진 객체. 필수 키: ${criterionIds.join(", ")}`,
          },
          notes: { type: "string", description: "전반적인 평가 요약" },
        },
        required: ["criteria_scores", "notes"],
      },
    };

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: "당신은 콘텐츠 품질 평가자입니다. score_article 도구를 반드시 호출하세요.",
      tools: [tool],
      tool_choice: { type: "tool", name: "score_article" },
      messages: [{ role: "user", content: `기사 제목: ${article.title}\n\n기사 본문(앞 500자만): ${article.content.slice(0, 500)}` }],
    });

    console.log("stop_reason:", response.stop_reason);
    console.log("content block types:", response.content.map((b) => b.type));
    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (toolUseBlock && toolUseBlock.type === "tool_use") {
      const input = toolUseBlock.input as Record<string, unknown>;
      console.log("top-level input keys:", Object.keys(input));
      const scores = input.criteria_scores;
      console.log("criteria_scores typeof:", typeof scores);
      if (scores && typeof scores === "object") {
        console.log("criteria_scores keys (actual AI output):", Object.keys(scores));
        console.log("expected criterion ids:", criterionIds);
      }
    } else {
      console.log("NO tool_use block found. Full content:", JSON.stringify(response.content).slice(0, 500));
    }
  });
});
