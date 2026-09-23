import "./load-env";
import { describe, it } from "vitest";
import { buildSocialWritingContext } from "@/lib/social/social-writing-context-builder";
import { assembleSocialWritingPrompt } from "@/lib/social/social-prompt-assembler";
import { getAnthropicClient } from "@/lib/ai/anthropic-client";
import { getSocialAiModel, getSocialAiMaxTokens, getSocialAiTemperature } from "@/lib/social/social-ai-generation-config";

// OPS-02A investigation: reproduce the real Pilot C threads+story JSON
// failure and classify its exact shape. Read-only otherwise; does not
// write to social_posts. Does not log full prompt/body text — only
// structural markers (lengths, first/last chars, brace counts).

const ARTICLE_ID = "7481495e-b8d9-4c1c-bbe4-5a439189287d";

function classify(text: string, stopReason: string | null) {
  const trimmed = text.trim();
  const startsWithBrace = trimmed.startsWith("{");
  const endsWithBrace = trimmed.endsWith("}");
  const hasFence = /```/.test(trimmed);
  const openBraces = (trimmed.match(/{/g) ?? []).length;
  const closeBraces = (trimmed.match(/}/g) ?? []).length;

  let category = "unknown";
  if (stopReason === "max_tokens") category = "token_truncation";
  else if (!startsWithBrace && hasFence) category = "markdown_fence";
  else if (!startsWithBrace) category = "prose_before_json";
  else if (!endsWithBrace) category = "truncated_json";
  else if (openBraces !== closeBraces) category = "unbalanced_braces";
  else {
    try {
      JSON.parse(trimmed);
      category = "valid_json";
    } catch (e) {
      category = `malformed_escape_or_syntax: ${(e as Error).message}`;
    }
  }

  return {
    category,
    length: trimmed.length,
    startsWithBrace,
    endsWithBrace,
    hasFence,
    openBraces,
    closeBraces,
    first30: trimmed.slice(0, 30),
    last30: trimmed.slice(-30),
    stopReason,
  };
}

describe("OPS-02A investigation: threads+story JSON failure classification", () => {
  it("runs 1 real call and classifies the raw response shape", async () => {
    const context = await buildSocialWritingContext(ARTICLE_ID, { platform: "threads", toneStyle: "story" });
    const assembled = assembleSocialWritingPrompt(context);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: getSocialAiModel(),
      max_tokens: getSocialAiMaxTokens(),
      temperature: getSocialAiTemperature(),
      system: assembled.systemPrompt,
      messages: [{ role: "user", content: assembled.userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    console.log("=== threads+story classification ===");
    console.log(JSON.stringify(classify(text, response.stop_reason), null, 2));
    console.log("usage:", response.usage);
  });
});
