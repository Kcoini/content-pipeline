import "./load-env";
import { describe, it } from "vitest";
import { buildSocialWritingContext } from "@/lib/social/social-writing-context-builder";
import { assembleSocialWritingPrompt } from "@/lib/social/social-prompt-assembler";
import { getAnthropicClient } from "@/lib/ai/anthropic-client";
import { getSocialAiModel, getSocialAiMaxTokens, getSocialAiTemperature } from "@/lib/social/social-ai-generation-config";

// OPS-02A: loop real calls until we capture an ACTUAL failing response
// (reproducing the exact production parser logic inline), then dump
// structural diagnostics of that one failing text (never the full text
// to a committed file — only counts/markers to console for this
// investigation run).

const ARTICLE_ID = "7481495e-b8d9-4c1c-bbe4-5a439189287d";
const MAX_ATTEMPTS = 6;

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function extractJsonObjectSubstring(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return text.slice(firstBrace, lastBrace + 1);
}

describe("OPS-02A investigation: capture an actual failing threads+story response", () => {
  it("loops until failure or attempts exhausted", async () => {
    const context = await buildSocialWritingContext(ARTICLE_ID, { platform: "threads", toneStyle: "story" });
    const assembled = assembleSocialWritingPrompt(context);
    const client = getAnthropicClient();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await client.messages.create({
        model: getSocialAiModel(),
        max_tokens: getSocialAiMaxTokens(),
        temperature: getSocialAiTemperature(),
        system: assembled.systemPrompt,
        messages: [{ role: "user", content: assembled.userPrompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

      const cleaned = stripCodeFence(text);
      let parsedOk = true;
      let parseErrorMsg = "";
      try {
        JSON.parse(cleaned);
      } catch (e) {
        parsedOk = false;
        parseErrorMsg = (e as Error).message;
        const fallback = extractJsonObjectSubstring(cleaned);
        if (fallback) {
          try {
            JSON.parse(fallback);
            parsedOk = true;
          } catch (e2) {
            parseErrorMsg = (e2 as Error).message;
          }
        }
      }

      console.log(`attempt ${attempt}: parsedOk=${parsedOk} stopReason=${response.stop_reason} rawLen=${text.length} cleanedLen=${cleaned.length}`);

      if (!parsedOk) {
        console.log("=== FAILURE CAPTURED ===");
        console.log("parseErrorMsg:", parseErrorMsg);
        console.log("cleaned first 200 chars:", JSON.stringify(cleaned.slice(0, 200)));
        console.log("cleaned last 200 chars:", JSON.stringify(cleaned.slice(-200)));
        // Find the character position JSON.parse choked on, and show context around it.
        const posMatch = /position (\d+)/.exec(parseErrorMsg);
        if (posMatch) {
          const pos = Number(posMatch[1]);
          console.log(`context around error position ${pos}:`, JSON.stringify(cleaned.slice(Math.max(0, pos - 60), pos + 60)));
        }
        console.log("raw starts with fence?", text.trim().startsWith("```"));
        console.log("raw ends with fence?", text.trim().endsWith("```"));
        console.log("newline count in cleaned:", (cleaned.match(/\n/g) ?? []).length);
        // Check for literal (unescaped) control chars inside string values by
        // looking for a quote followed by content containing a raw newline
        // before the next unescaped quote — common cause of "malformed escape".
        const rawNewlineInString = /"[^"\\]*\n[^"\\]*"/.test(cleaned);
        console.log("looks like raw newline inside a JSON string value:", rawNewlineInString);
        return;
      }
    }
    console.log("No failure captured in", MAX_ATTEMPTS, "attempts.");
  });
});
