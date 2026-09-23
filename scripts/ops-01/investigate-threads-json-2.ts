import "./load-env";
import { describe, it } from "vitest";
import { buildSocialWritingContext } from "@/lib/social/social-writing-context-builder";
import { assembleSocialWritingPrompt } from "@/lib/social/social-prompt-assembler";
import { generateSocialPostWithAI } from "@/lib/social/social-ai-client";
import { getSocialAiMaxTokens, getSocialAiTemperature } from "@/lib/social/social-ai-generation-config";

// OPS-02A: exercise the REAL production parser (generateSocialPostWithAI)
// directly, 5x, for threads+story on the real Pilot C article — to see
// whether the actual bug reproduces via the real code path (not a
// reimplementation of the classifier).

const ARTICLE_ID = "7481495e-b8d9-4c1c-bbe4-5a439189287d";
const RUNS = 5;

describe("OPS-02A investigation: real generateSocialPostWithAI reliability for threads+story (n=5)", () => {
  it(`runs ${RUNS}x`, async () => {
    const context = await buildSocialWritingContext(ARTICLE_ID, { platform: "threads", toneStyle: "story" });
    const assembled = assembleSocialWritingPrompt(context);

    const results: { ok: boolean; error?: string }[] = [];
    for (let i = 0; i < RUNS; i++) {
      const result = await generateSocialPostWithAI({
        systemPrompt: assembled.systemPrompt,
        userPrompt: assembled.userPrompt,
        platform: "threads",
        toneStyle: "story",
        contractName: assembled.contractName,
        maxTokens: getSocialAiMaxTokens(),
        temperature: getSocialAiTemperature(),
      });
      results.push({ ok: result.ok, error: result.error });
      console.log(`run ${i + 1}: ok=${result.ok}${result.error ? ` error=${result.error}` : ""}`);
    }

    const successCount = results.filter((r) => r.ok).length;
    console.log(`\nsummary: ${successCount}/${RUNS} succeeded`);
  });
});
