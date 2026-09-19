// Phase UX-05A: x/threads/instagram(plain-text 기반 SNS 플랫폼)도
// naver_cafe와 같은 이유로 AI가 markdown 습관(escape된 `\#`/`\*\*`,
// HTML entity, 실제 `##` 소제목, `**굵게**`, 원본 HTML 태그)을 남길 수
// 있다 — 그런데 naver_cafe와 달리 이 세 플랫폼은 quality gate에 그런
// 잔여물을 감지하는 검사 자체가 없었다(UX-04B 조사 결과, 2026-09-18).
// 이 파일은 lib/social/naver-cafe-plain-text-sanitizer.ts와 같은 원칙
// (결정론적 정규식 변환만, 새 AI 호출 없음, idempotent)으로 x/threads/
// instagram 전용 정리 함수를 제공한다.
//
// naver_cafe 버전과 다른 점: 이 세 플랫폼은 원본 HTML 태그(<div>, <p> 등)
// 잔여물도 감지 대상이라 태그 제거 단계가 추가된다. 반대로 naver_cafe에만
// 있는 markdown table/link flattening은 포함하지 않는다 — x/threads/
// instagram 본문에는 표가 나타나지 않고, `[text](url)` 형태의 markdown
// 링크가 실수로 남는 경우는 흔치 않아 이번 범위에서는 다루지 않는다
// (실제로 나타나면 다음 Phase에서 검토).
//
// naver-cafe-plain-text-sanitizer.ts는 이 파일이 건드리지 않는다 —
// 그 파일의 동작/테스트는 그대로 유지된다.

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

function decodeCommonHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    result = result.split(entity).join(char);
  }
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

/** markdown 특수문자 앞의 불필요한 백슬래시 escape를 제거한다(문자 자체는 남긴다). */
function unescapeMarkdownChars(text: string): string {
  return text.replace(/\\([#*_[\]()>!.-])/g, "$1");
}

/** 줄 맨 앞의 markdown heading(#, ##, ...) 마커를 제거한다. 인라인 해시태그(#AI처럼 공백 없이 이어지는 것)는 건드리지 않는다. */
function stripHeadingMarkers(text: string): string {
  return text.replace(/^#{1,6}[ \t]+\S/gm, (match) => match.replace(/^#{1,6}[ \t]+/, ""));
}

/** markdown bold(**) 마커 쌍을 제거하되 안의 텍스트는 남긴다. */
function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, "$1");
}

/**
 * 흔한 원본 HTML 태그(div/p/span/br/h1-6/ul/ol/li/strong/em/b/i/a)를
 * 제거한다 — 태그만 지우고 안의 텍스트는 남긴다. 알 수 없는 태그(사용자가
 * 의도적으로 "<3"처럼 쓴 이모티콘 등)는 건드리지 않기 위해 알려진 태그
 * 이름만 대상으로 한다.
 */
function stripKnownHtmlTags(text: string): string {
  return text.replace(/<\/?(?:div|p|span|br|h[1-6]|ul|ol|li|strong|em|b|i|a)\b[^>]*>/gi, "");
}

/** 연속 공백을 한 칸으로, 3줄 이상 연속 개행은 2줄로 줄인다. */
function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * x/threads/instagram 본문 텍스트 하나를 정리한다(idempotent — 이미
 * 깨끗한 텍스트에 다시 적용해도 결과가 바뀌지 않는다). 사실/수치/URL은
 * 건드리지 않는다 — markdown 마커/HTML 태그/entity만 제거한다.
 */
export function sanitizePlainTextMarkupResidue(input: string | null | undefined): string {
  if (!input) return "";
  let text = input;
  text = decodeCommonHtmlEntities(text);
  text = unescapeMarkdownChars(text);
  text = stripBoldMarkers(text);
  text = stripHeadingMarkers(text);
  text = stripKnownHtmlTags(text);
  text = normalizeWhitespace(text);
  return text;
}
