// Phase 1-3/1-4: 출처 요약기.
// prompts/source-summary.v1.md의 출력 형식(sourceId, summary)을 따른다.
// mock 구현(summarizeSourcesMock)과 실제 AI 연동(summarizeSourcesWithAi)을 분리한다.
//
// 비용 안전장치: 기사 생성 1회 클릭당 AI 호출은 source summary 1회로 제한하기
// 위해, 출처별로 호출하지 않고 모든 출처를 한 번의 요청으로 묶어 요약한다.

import { getAnthropicClient, ANTHROPIC_MODEL } from "./anthropic-client";
import type { Source, Theme } from "@/lib/types/domain";

export interface SourceSummary {
  sourceId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  summary: string;
}

/**
 * Phase 1-3: 실제 AI 호출 없이, 출처에 등록된 정보를 그대로 요약으로 사용하는
 * mock 구현. 등록된 summary가 없으면 제목/출판사로 대체 문구를 만든다.
 */
export function summarizeSourcesMock(sources: Source[]): SourceSummary[] {
  return sources.map((source) => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    summary: source.summary || `${source.title} (${source.publisher || "출처 미상"})`,
  }));
}

const SYSTEM_PROMPT = `당신은 기사 작성을 위한 리서치 어시스턴트입니다.
주어진 출처 정보를 바탕으로 기사 작성에 사용할 핵심 근거 요약을 작성하세요.

규칙:
1. 뉴스 원문을 그대로 복사하지 마세요 (요약/재구성만 허용).
2. 출처에 명시된 사실관계만 포함하고, 추측이나 새로운 정보를 추가하지 마세요.
3. 각 출처당 3~5문장 이내로 간결하게 작성하세요.
4. 출력은 반드시 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.

출력 형식:
{
  "summaries": [
    { "sourceId": "source-id", "summary": "출처의 핵심 근거를 요약한 텍스트" }
  ]
}`;

function buildUserPrompt(theme: Theme, sources: Source[]): string {
  const sourceLines = sources
    .map((source) =>
      [
        `- sourceId: ${source.id}`,
        `  title: ${source.title}`,
        `  url: ${source.url}`,
        `  publisher: ${source.publisher}`,
        `  publishedAt: ${source.publishedAt}`,
        `  summary: ${source.summary}`,
      ].join("\n")
    )
    .join("\n");

  return `주제: ${theme.title}\n주제 설명: ${theme.description}\n\n출처 목록:\n${sourceLines}\n\n위 출처들을 바탕으로 각 출처별 핵심 근거 요약을 작성하세요.`;
}

interface RawSourceSummary {
  sourceId?: unknown;
  summary?: unknown;
}

/**
 * Phase 1-4: prompts/source-summary.v1.md 기준으로 Anthropic API를 호출해
 * 모든 출처를 한 번의 요청으로 요약한다. JSON parse에 실패하면 에러를 던진다
 * (호출부에서 mock 요약으로 대체 처리한다).
 */
export async function summarizeSourcesWithAi(
  theme: Theme,
  sources: Source[]
): Promise<SourceSummary[]> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(theme, sources) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("summarizeSourcesWithAi: AI 응답에서 텍스트를 찾을 수 없습니다.");
  }

  let parsed: { summaries?: RawSourceSummary[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("summarizeSourcesWithAi: AI 응답을 JSON으로 해석할 수 없습니다.");
  }

  const summaryById = new Map<string, string>();
  for (const item of parsed.summaries ?? []) {
    if (typeof item.sourceId === "string" && typeof item.summary === "string") {
      summaryById.set(item.sourceId, item.summary);
    }
  }

  return sources.map((source) => ({
    sourceId: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    summary:
      summaryById.get(source.id) ||
      source.summary ||
      `${source.title} (${source.publisher || "출처 미상"})`,
  }));
}
