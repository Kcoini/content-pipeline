// Phase 4-21: 마스터 원고/프롬프트 내부 작성 구조(리드문/본문/배경 설명/
// 쟁점/향후 확인할 점/출처)가 AI 실수로 게시용 소제목에 그대로 남는
// 문제를 막기 위한 안전망. 프롬프트 자체도 이 구조명을 그대로 쓰지
// 말라고 안내하지만(prompts/social/*.md), AI 생성은 100% 결정적이지
// 않으므로 저장 직전에 한 번 더 정리한다(defense in depth).
//
// "리드문"은 소제목을 아예 지운다(제목 아래 첫 문단으로 흡수한다는
// 뜻 — 본문 내용 자체는 건드리지 않고 소제목 줄만 제거한다). 나머지는
// 완전히 정확한 내용형 제목을 만들 수는 없으므로(문맥을 재작성하지
// 않는다는 원칙), 스펙이 제시한 무난한 기본 대체 문구로 바꾼다 — 그래도
// 남아 있는 "정말 좋은 소제목인가"는 사람이 검토하거나 자동 검토의
// "수정 필요" 표시로 안내한다(detectInternalSectionHeadings 참고).

export type InternalSectionHeadingKey = "lead" | "body" | "background" | "issues" | "future_checks" | "sources";

interface InternalHeadingRule {
  key: InternalSectionHeadingKey;
  /** 정규화된 소제목 텍스트(공백/콜론 제거 후 비교). */
  term: string;
  /** null이면 소제목 줄 자체를 제거한다(리드문). */
  replacement: string | null;
}

const INTERNAL_HEADING_RULES: InternalHeadingRule[] = [
  { key: "lead", term: "리드문", replacement: null },
  { key: "body", term: "본문", replacement: "핵심 내용" },
  { key: "background", term: "배경설명", replacement: "왜 이런 상황인가" },
  { key: "issues", term: "쟁점", replacement: "쟁점: 기회와 우려" },
  { key: "future_checks", term: "향후확인할점", replacement: "앞으로 확인해야 할 변수" },
  { key: "sources", term: "출처", replacement: "참고한 자료" },
];

/** 소제목 후보 텍스트를 비교 가능한 형태로 정규화한다(공백/trailing 콜론 제거). */
function normalizeHeadingText(text: string): string {
  return text.trim().replace(/\s+/g, "").replace(/[:：]+$/, "");
}

/**
 * 한 줄이 "## 리드문"/"# 리드문"/"**리드문**" 형태의 내부 구조명
 * 소제목인지 확인하고, 매칭되면 교체 결과를 반환한다. markdown
 * heading(`#`/`##`/`###`)과 bold-as-heading(`**...**`) 두 형태만
 * 인식한다 — 문장 중간에 섞인 일반 단어("본문에서 확인했듯이" 등)는
 * 건드리지 않는다.
 */
function matchInternalHeadingLine(line: string): { rule: InternalHeadingRule; headingPrefix: string | null } | null {
  const trimmed = line.trim();

  const markdownHeadingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (markdownHeadingMatch) {
    const normalized = normalizeHeadingText(markdownHeadingMatch[2]);
    const rule = INTERNAL_HEADING_RULES.find((r) => r.term === normalized);
    if (rule) return { rule, headingPrefix: markdownHeadingMatch[1] };
  }

  const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
  if (boldHeadingMatch) {
    const normalized = normalizeHeadingText(boldHeadingMatch[1]);
    const rule = INTERNAL_HEADING_RULES.find((r) => r.term === normalized);
    if (rule) return { rule, headingPrefix: null };
  }

  return null;
}

export interface SanitizeInternalSectionHeadingsResult {
  body: string | null;
  /** 실제로 뭔가 바꾸거나 지웠으면 true. */
  changed: boolean;
  /** 어떤 내부 구조명이 발견/처리됐는지(로그·자동 검토용 — full body는 담지 않는다). */
  affectedKeys: InternalSectionHeadingKey[];
}

/**
 * post_body에서 "## 리드문"/"**본문**" 같은 내부 작성용 소제목을
 * 찾아 제거하거나 독자 친화적인 기본 문구로 바꾼다. 문단 내용
 * 자체(사실/수치/문장)는 전혀 건드리지 않는다 — 소제목 줄만 처리한다.
 */
export function sanitizeInternalSectionHeadings(body: string | null | undefined): SanitizeInternalSectionHeadingsResult {
  if (!body) return { body: body ?? null, changed: false, affectedKeys: [] };

  const lines = body.split("\n");
  const affectedKeys: InternalSectionHeadingKey[] = [];
  let changed = false;
  const outputLines: string[] = [];

  for (const line of lines) {
    const match = matchInternalHeadingLine(line);
    if (!match) {
      outputLines.push(line);
      continue;
    }

    changed = true;
    affectedKeys.push(match.rule.key);

    if (match.rule.replacement === null) {
      // 리드문: 소제목 줄 자체를 제거한다(다음 줄부터가 곧 "제목 아래 첫 문단"이 된다).
      continue;
    }

    outputLines.push(match.headingPrefix ? `${match.headingPrefix} ${match.rule.replacement}` : `**${match.rule.replacement}**`);
  }

  // 리드문 소제목을 제거하면서 생긴 연속 빈 줄(3줄 이상)을 2줄로 줄인다.
  const collapsed = outputLines.join("\n").replace(/\n{3,}/g, "\n\n");

  return { body: collapsed, changed, affectedKeys };
}

/**
 * 현재 post_body에 내부 작성용 소제목이 남아 있는지만 확인한다(수정하지
 * 않는다) — 자동 검토(quality gate)에서 "수정 필요" 판단에 사용한다.
 */
export function detectInternalSectionHeadings(body: string | null | undefined): InternalSectionHeadingKey[] {
  if (!body) return [];
  return body
    .split("\n")
    .map((line) => matchInternalHeadingLine(line)?.rule.key)
    .filter((key): key is InternalSectionHeadingKey => key !== undefined);
}
