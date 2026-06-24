// Phase 1-10: 출처 1개를 대상으로 raw_content 기반 AI 자동 요약 생성.
// 기사 생성 시 배치 요약(source-summarizer.ts)과 달리,
// 출처 등록 시점에 source 1개당 1회 호출한다.
// 서버 전용 - client component에서 import 금지.

import { getAnthropicClient, ANTHROPIC_MODEL } from "./anthropic-client";
import type { Source } from "@/lib/types/domain";

export interface SourceSummaryResult {
  summary: string;
  keyPoints: string[];
  entities: string[];
  risksOrUncertainties: string[];
  sourceAngle: string;
}

/** raw_content에서 AI 프롬프트에 넘길 최대 길이 */
const MAX_RAW_CONTENT_FOR_PROMPT = 8_000;

const SYSTEM_PROMPT = `당신은 기사 작성을 위한 리서치 어시스턴트입니다.
주어진 출처의 본문(raw_content)을 읽고 기사 작성에 사용할 구조화된 요약을 생성하세요.

규칙:
1. 본문을 그대로 복사하지 마세요. 핵심 내용을 재구성하세요.
2. 출처에 명시된 사실관계만 포함하세요. 추측이나 없는 내용을 추가하지 마세요.
3. summary는 300~600자 이내로 작성하세요.
4. key_points는 핵심 사실·주장·수치·정책명·기관명을 3~7개의 짧은 문장으로 작성하세요.
5. entities는 본문에 등장하는 고유명사(인명·기관명·지명·정책명 등)를 배열로 추출하세요.
6. risks_or_uncertainties는 본문에서 명시적으로 언급된 불확실성·위험·반론을 정리하세요.
7. source_angle은 이 출처가 주제를 어떤 관점(찬성/반대/중립/분석 등)에서 다루는지 한 문장으로 설명하세요.`;

const SUMMARY_TOOL = {
  name: "save_source_summary",
  description: "출처 요약 결과를 저장한다. 분석이 완료되면 반드시 이 도구를 호출해야 한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "출처의 핵심 내용을 재구성한 요약 (300~600자)",
      },
      key_points: {
        type: "array",
        items: { type: "string" },
        description: "핵심 사실·주장·수치·정책명·기관명 (3~7개 짧은 문장)",
      },
      entities: {
        type: "array",
        items: { type: "string" },
        description: "본문에 등장하는 고유명사 (인명·기관명·지명·정책명 등)",
      },
      risks_or_uncertainties: {
        type: "array",
        items: { type: "string" },
        description: "본문에서 명시적으로 언급된 불확실성·위험·반론",
      },
      source_angle: {
        type: "string",
        description: "이 출처가 주제를 바라보는 관점 (찬성/반대/중립/분석 등, 한 문장)",
      },
    },
    required: ["summary", "key_points", "entities", "risks_or_uncertainties", "source_angle"],
  },
};

function buildUserPrompt(source: Source, rawContent: string): string {
  const truncated =
    rawContent.length > MAX_RAW_CONTENT_FOR_PROMPT
      ? rawContent.substring(0, MAX_RAW_CONTENT_FOR_PROMPT) + "\n...(이하 생략)"
      : rawContent;

  return [
    `출처 제목: ${source.title}`,
    `URL: ${source.url}`,
    `출판사: ${source.publisher || "(없음)"}`,
    `발행일: ${source.publishedAt || "(없음)"}`,
    "",
    "본문:",
    truncated,
    "",
    "위 본문을 바탕으로 save_source_summary 도구를 호출해 구조화된 요약을 저장하세요.",
  ].join("\n");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * AI 없이 저장된 데이터로 mock 요약을 생성한다.
 * AI_GENERATION_ENABLED=false일 때 사용한다.
 */
export function generateSourceSummaryMock(source: Source): SourceSummaryResult {
  const baseText =
    source.summary ||
    source.rawContent?.substring(0, 300) ||
    `${source.title} (${source.publisher || "출처 미상"})`;

  const sentences = baseText
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .slice(0, 3);

  const keyPoints = sentences.length > 0 ? sentences : [baseText.substring(0, 100)];

  return {
    summary: baseText,
    keyPoints,
    entities: [],
    risksOrUncertainties: [],
    sourceAngle: "정보 제공",
  };
}

/**
 * raw_content를 바탕으로 Anthropic API를 호출해 구조화된 요약을 생성한다.
 * tool_use로 JSON 출력을 강제하므로 파싱 실패가 발생하지 않는다.
 * 실패하면 예외를 던진다 (호출부에서 failed 상태로 처리한다).
 */
export async function generateSourceSummaryWithAi(
  source: Source,
  rawContent: string
): Promise<SourceSummaryResult> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: "tool", name: "save_source_summary" },
    messages: [{ role: "user", content: buildUserPrompt(source, rawContent) }],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("generateSourceSummaryWithAi: AI가 도구를 호출하지 않았습니다.");
  }

  const input = toolUseBlock.input as Record<string, unknown>;

  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!summary) {
    throw new Error("generateSourceSummaryWithAi: AI 응답에 summary가 없습니다.");
  }

  return {
    summary,
    keyPoints: toStringArray(input.key_points),
    entities: toStringArray(input.entities),
    risksOrUncertainties: toStringArray(input.risks_or_uncertainties),
    sourceAngle: typeof input.source_angle === "string" ? input.source_angle : "",
  };
}
