// Phase 3-20: naver_cafe는 HTML/Markdown이 아니라 사람이 카페에 그대로
// 복사해 붙여넣는 plain text 커뮤니티 글이다. 그런데 AI가 종종 다른
// 플랫폼(wordpress_blog/naver_blog 등)에서 익숙한 markdown 습관대로
// `\## 제목`, `\*\*굵게\*\*`, `&#x20;` 같은 "escape된 markdown"/HTML
// entity 잔여물을 그대로 출력하는 경우가 있다 — 프롬프트에서 금지해도
// 100% 막을 수 없으므로, 저장 전/표시 전/export 전에 항상 이 함수를
// 거쳐 안전하게 정리한다.
//
// 원칙:
// - heading(#)과 bold(**)는 plain text에서 의미가 없으므로 마커 자체를
//   제거한다(백슬래시+마커 모두 삭제, 본문 텍스트는 남긴다).
// - list bullet(-)은 plain text에서도 자연스럽게 읽히므로 백슬래시
//   escape만 벗기고 "-"는 그대로 둔다.
// - `&#x20;` 같은 HTML numeric entity는 실제 문자로 되돌린다.
// - markdown link `[text](url)`는 "text (url)" 형태로 풀어 쓴다.
// - markdown table은 셀 구분자(|)를 슬래시로 바꿔 한 줄 목록처럼 만든다
//   (naver_cafe는 표를 쓰지 않는다).
// - 남는 공백/줄바꿈을 정리한다(연속 공백 1칸, 3줄 이상 개행은 2줄로).
// - 이 함수는 순수 텍스트 변환만 하며, 내부 관리 문구(quality_status 등)를
//   추가하거나 검열하지 않는다 — 그건 quality gate가 별도로 확인한다.

const HTML_ENTITY_MAP: Record<string, string> = {
  "&#x20;": " ",
  "&#x27;": "'",
  "&#x2F;": "/",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** `&#x20;`, `&amp;` 같은 흔한 HTML entity를 실제 문자로 되돌린다. */
function decodeCommonHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    result = result.split(entity).join(char);
  }
  // 위 목록에 없는 &#x.. / &#.. 숫자 entity도 최대한 안전하게 처리한다.
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });
  result = result.replace(/&#(\d+);/g, (_match, dec: string) => {
    try {
      return String.fromCodePoint(parseInt(dec, 10));
    } catch {
      return "";
    }
  });
  return result;
}

/**
 * markdown 특수문자(#, *, -, _, [, ], (, ), >, !, .) 앞의 불필요한
 * 백슬래시 escape를 모두 제거한다(문자 자체는 남긴다). `\*\*`처럼 각
 * 문자가 개별적으로 escape된 경우(별표 사이에 백슬래시가 끼어 있는
 * 경우)도 이 단계에서 전부 풀어낸 뒤, 이어지는 단계에서 `**`/`#` 같은
 * 마커 자체를 처리한다.
 */
function unescapeMarkdownChars(text: string): string {
  return text.replace(/\\([#*_[\]()>!.-])/g, "$1");
}

/** markdown link `[text](url)`를 "text (url)" 형태의 자연스러운 plain text로 바꾼다. */
function flattenMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    const trimmedLabel = label.trim();
    return trimmedLabel ? `${trimmedLabel} (${url})` : url;
  });
}

/** markdown table을 naver_cafe에서 쓰지 않으므로, 구분 행은 제거하고 나머지 행은 "/"로 이어붙인 한 줄로 바꾼다. */
function flattenMarkdownTables(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*\|?[\s:-]+\|[\s:|-]*$/.test(line) || !line.includes("-"))
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return line;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
      return cells.join(" / ");
    })
    .join("\n");
}

/** 줄 맨 앞의 markdown heading(#, ##, ...) 마커를 제거한다(unescape 이후 호출 — escape 여부와 무관하게 처리됨). */
function stripHeadingMarkers(text: string): string {
  return text.replace(/^#{1,6}[ \t]*/gm, "");
}

/** markdown bold(**) 마커 쌍을 제거하되 안의 텍스트는 남긴다(unescape 이후 호출). */
function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, "$1");
}

/** 연속 공백을 한 칸으로, 3줄 이상 연속 개행은 2줄로 줄인다(줄 안 공백만 정리, 개행 자체는 보존). */
function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * naver_cafe 본문(post_body)을 plain text 커뮤니티 글에 맞게 정리한다.
 * - 저장 전(생성/재생성 직후), 표시 전(카드/상세/미리보기), export/copy/
 *   handoff payload 생성 전에 모두 이 함수를 거친다.
 * - 이미 깨끗한 텍스트에 다시 적용해도 안전하다(idempotent) — 반복 적용
 *   시 결과가 달라지지 않는다.
 */
export function sanitizeNaverCafePlainText(input: string | null | undefined): string {
  if (!input) return "";
  let text = input;
  text = decodeCommonHtmlEntities(text);
  text = unescapeMarkdownChars(text);
  text = flattenMarkdownTables(text);
  text = flattenMarkdownLinks(text);
  text = stripBoldMarkers(text);
  text = stripHeadingMarkers(text);
  text = normalizeWhitespace(text);
  return text;
}
