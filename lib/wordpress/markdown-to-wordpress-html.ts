// Markdown → WordPress 전송용 HTML 변환 공통 유틸.
// 실제 WordPress REST API content로 보내기 전에 Markdown을 안전한 HTML로
// 변환한다. 원래 wordpress_blog 전용으로 만들어졌지만(post_body 변환),
// Phase 2-21부터 article 고급 기능(원본 article WordPress 전송,
// source_based_explainer/monetized_blog/general_news 공통)도 이 파일의
// `ensureWordPressHtmlContent()`를 통해 재사용한다 — 변환 로직 자체를
// 중복 구현하지 않는다.
//
// 중요 원칙(반드시 지킨다):
// - naver_blog(markdown_copy export)에는 이 변환을 적용하지 않는다 —
//   naver_blog는 markdown 원문을 그대로 사용자가 복사해 붙여넣는
//   워크플로우라 HTML 변환이 필요 없다(오히려 방해가 된다).
// - "언제 호출하느냐"는 이 파일이 아니라 각 호출부가 결정한다 —
//   wordpress_blog는 `lib/social/wordpress-blog-content-override-builder.ts`,
//   article 고급 기능은 `lib/publish/publish-service.ts`에서 호출한다.
// - 변환 후 결과는 반드시 sanitize한다 — script/iframe/on* 이벤트 속성은
//   모두 제거한다. style 속성은 표(table) 요소에 한해서만, 우리가 직접
//   생성한 값(가독성 CSS)과 markdown 표 정렬(text-align)만 허용한다 —
//   AI가 만든 임의의 style 속성을 그대로 통과시키지 않는다.
// - AD_SLOT marker(`<!-- AD_SLOT: ... -->`)는 markdown 렌더링/sanitize
//   과정에서 사라지거나 변형되지 않고 그대로 보존한다. 마커를 사용자에게
//   보이는 문장으로 바꾸지 않는다.
// - post_title이 이미 별도로 WordPress 제목으로 전송되므로, 본문 안의
//   최상위 h1(`# 제목`)은 h2로 낮춘다(중복 제목 방지).
// - WordPress 공개 화면에서 비교표 가독성이 떨어지는 문제(border/padding
//   없음, 열 너비 미설계, 긴 텍스트 과도한 줄바꿈, 모바일 대응 없음)를
//   해결하기 위해, 렌더링된 <table>에 인라인 스타일/colgroup/반응형
//   래퍼를 자동으로 적용한다(WordPress 테마 CSS에 의존하지 않는다 —
//   테마가 무엇이든 항상 같은 모양으로 보이게 하기 위해서다).

import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";

// html:false — markdown 원문에 우연히 섞여 들어간 raw HTML(<script> 등)을
// 렌더링하지 않고 그대로 escape한다(1차 방어). linkify/typographer는 끄고
// 원문에 명시된 것만 변환한다. markdown-it의 "default" preset은 GFM
// table을 기본적으로 지원한다(별도 플러그인 불필요).
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
});

const ALLOWED_TAGS = [
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "table",
  "colgroup",
  "col",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "strong",
  "em",
  "a",
  "blockquote",
  "code",
  "pre",
  "br",
  "hr",
];

// style 속성은 표 관련 요소에만, 그것도 제한된 CSS 속성값만 허용한다.
// - text-align: markdown 표 정렬 문법(`:---:`)이 만드는 값을 보존하기 위해.
// - width: colgroup의 <col>에 열 폭을 지정하기 위해.
// AI가 만든 임의의 style(색상 조작, 숨김 처리 등)은 여기 없는 속성이라
// 전부 제거된다. table/th/td/tr 자체의 가독성 CSS(border/padding 등)는
// sanitize 이후 applyWordPressTableStyling()에서 별도로 붙인다(AI 입력과
// 무관하게 항상 같은 값이라 sanitize 대상이 아니다).
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  th: ["colspan", "rowspan", "style"],
  td: ["colspan", "rowspan", "style"],
  col: ["style"],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  th: { "text-align": [/^left$|^right$|^center$/] },
  td: { "text-align": [/^left$|^right$|^center$/] },
  col: { width: [/^\d{1,3}%$/] },
};

// AD_SLOT placeholder는 순수 영숫자(ADSLOT_숫자)만 사용한다 — 앞뒤에
// 공백을 두지 않아 markdown-it이 문단 앞뒤 공백을 trim해도 잘려나가지
// 않고, 일반 markdown 문법(굵게/기울임/링크 등)과도 충돌하지 않는다.
const AD_SLOT_PLACEHOLDER_PREFIX = "ADSLOT_";
const AD_SLOT_PLACEHOLDER_SUFFIX = "";
const AD_SLOT_PLACEHOLDER_PATTERN = /ADSLOT_(\d+)/g;

// 표 셀 안에서 여러 항목을 짧게 나열할 때만 쓰는 안전한 줄바꿈 placeholder.
// html:false 상태에서는 원문에 literal <br>을 적어도 escape되므로, 표
// 셀에서 "이자 0.2%<br>대출잔액 3억 이내" 같은 2~3개 항목 표현이 가능하도록
// <br>/<br/>만 예외적으로(AD_SLOT과 같은 방식) 보존한다. 그 외 어떤
// raw HTML 태그도 여전히 escape된다(html:true로 전면 허용하지 않는다).
const BR_PLACEHOLDER_PREFIX = "BRTAG";
const BR_PLACEHOLDER_SUFFIX = "";
const BR_PLACEHOLDER_PATTERN = /BRTAG(\d+)/g;
const BR_TAG_PATTERN = /<br\s*\/?>/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * AD_SLOT marker(HTML 주석)를 markdown 렌더링 전에 고유 placeholder로
 * 치환해 둔다 — markdown-it(html:false)이 주석을 escape하거나 sanitize가
 * 주석을 제거하는 것과 무관하게, 마커 문자열을 원본 그대로 보존하기
 * 위해서다.
 */
function extractAdSlotMarkers(markdown: string): { text: string; markers: string[] } {
  const markers: string[] = [];
  let text = markdown;
  for (const position of AD_SLOT_MARKERS) {
    const marker = adSlotMarkerComment(position);
    const pattern = new RegExp(escapeRegExp(marker), "g");
    text = text.replace(pattern, () => {
      const index = markers.push(marker) - 1;
      return `${AD_SLOT_PLACEHOLDER_PREFIX}${index}${AD_SLOT_PLACEHOLDER_SUFFIX}`;
    });
  }
  return { text, markers };
}

/** sanitize까지 끝난 HTML에서 placeholder를 원래의 AD_SLOT 주석으로 되돌린다. */
function restoreAdSlotMarkers(html: string, markers: string[]): string {
  return html.replace(AD_SLOT_PLACEHOLDER_PATTERN, (_match, indexRaw: string) => {
    const index = Number(indexRaw);
    return markers[index] ?? "";
  });
}

/** 표 셀 등에서 쓰는 literal <br>/<br/>을 placeholder로 치환해 둔다(AD_SLOT과 동일한 원리). */
function extractBrTags(markdown: string): { text: string; count: number } {
  let count = 0;
  const text = markdown.replace(BR_TAG_PATTERN, () => {
    const index = count;
    count += 1;
    return `${BR_PLACEHOLDER_PREFIX}${index}${BR_PLACEHOLDER_SUFFIX}`;
  });
  return { text, count };
}

/** sanitize까지 끝난 HTML에서 placeholder를 안전한 <br>로 되돌린다. */
function restoreBrTags(html: string): string {
  return html.replace(BR_PLACEHOLDER_PATTERN, "<br>");
}

/**
 * 줄 맨 앞의 h1(`# 제목`)만 h2로 낮춘다. `## `/`### ` 등은 건드리지 않는다
 * (정규식이 `#` 바로 뒤에 공백이 와야 매치되므로, 두 번째 `#`가 있으면
 * 그 지점에서 매치가 실패한다).
 */
function demoteTopLevelHeading(markdown: string): string {
  return markdown.replace(/^#[ \t]+(?=\S)/gm, "## ");
}

function sanitizeWordPressHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    // on* 이벤트 속성/script/iframe은 allowedTags·allowedAttributes에
    // 없으므로 자동으로 제거된다. 모든 링크에 안전한 rel을 강제한다.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer", target: "_blank" }, true),
    },
  });
}

// --- 표 가독성 개선(WordPress 공개 화면용) ---------------------------------

/** 지원정책 비교표처럼 "구분/대상/지원 내용/신청 기한"류 4열 표에 권장하는 폭. */
const FOUR_COLUMN_WIDTHS = ["16%", "28%", "34%", "22%"];

const TABLE_WRAPPER_STYLE = "overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0;";
const TABLE_STYLE = "width:100%;border-collapse:collapse;table-layout:fixed;";
const THEAD_STYLE = "background-color:#f3f4f6;";
const TH_BASE_STYLE =
  "border:1px solid #d0d5dd;padding:12px;vertical-align:top;font-weight:600;word-break:keep-all;overflow-wrap:break-word;";
const TD_BASE_STYLE = "border:1px solid #d0d5dd;padding:12px;vertical-align:top;word-break:keep-all;overflow-wrap:break-word;";
const ZEBRA_ROW_STYLE = "background-color:#f9fafb;";

/** 기존 style 속성 값(예: text-align)과 새로 추가할 스타일을 합친다. 같은 속성은 기존 값이 우선한다. */
function mergeStyleAttr(existingStyle: string | undefined, baseStyle: string): string {
  if (!existingStyle) return baseStyle;
  return `${baseStyle}${existingStyle.endsWith(";") ? existingStyle : `${existingStyle};`}`;
}

function addOrMergeAttr(tagOpen: string, attrName: string, value: string, merge = false): string {
  const attrPattern = new RegExp(`${attrName}="([^"]*)"`);
  const existingMatch = tagOpen.match(attrPattern);
  if (existingMatch) {
    const merged = merge ? mergeStyleAttr(existingMatch[1], value) : value;
    return tagOpen.replace(attrPattern, `${attrName}="${merged}"`);
  }
  return tagOpen.replace(/>$/, ` ${attrName}="${value}">`);
}

/** 열 개수에 맞는 colgroup HTML을 만든다. 4열이면 권장 폭을, 그 외에는 균등 폭을 적용한다. */
function buildColgroupHtml(columnCount: number): string {
  if (columnCount <= 0) return "";
  const widths =
    columnCount === FOUR_COLUMN_WIDTHS.length ? FOUR_COLUMN_WIDTHS : Array.from({ length: columnCount }, () => `${(100 / columnCount).toFixed(2)}%`);
  const cols = widths.map((width) => `<col style="width:${width}">`).join("");
  return `<colgroup>${cols}</colgroup>`;
}

/**
 * sanitize까지 끝난 HTML 안의 모든 <table>에 가독성 CSS(테두리/padding/
 * 헤더 배경/zebra row)와 colgroup, 모바일 대응 스크롤 래퍼를 적용한다.
 * WordPress 테마의 CSS에 의존하지 않고 항상 같은 모양으로 보이도록,
 * 필요한 스타일을 인라인으로 직접 채워 넣는다.
 */
function applyWordPressTableStyling(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_fullMatch, inner: string) => {
    const headerRowMatch = inner.match(/<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/);
    const columnCount = headerRowMatch ? (headerRowMatch[1].match(/<th[\s>]/g) ?? []).length : 0;
    const colgroupHtml = buildColgroupHtml(columnCount);

    let styled = inner;

    // th/td에 가독성 스타일을 추가한다(기존 text-align 등은 유지).
    styled = styled.replace(/<th(\s[^>]*)?>/g, (tagOpen) => addOrMergeAttr(tagOpen, "style", TH_BASE_STYLE, true));
    styled = styled.replace(/<td(\s[^>]*)?>/g, (tagOpen) => addOrMergeAttr(tagOpen, "style", TD_BASE_STYLE, true));

    // thead에 배경색을 추가한다.
    styled = styled.replace(/<thead>/, `<thead style="${THEAD_STYLE}">`);

    // tbody 안의 tr에만 zebra 배경을 적용한다(thead의 tr은 건드리지 않는다).
    styled = styled.replace(/<tbody>([\s\S]*?)<\/tbody>/, (_tbodyMatch, tbodyInner: string) => {
      let rowIndex = 0;
      const styledRows = tbodyInner.replace(/<tr>/g, () => {
        const isEven = rowIndex % 2 === 1;
        rowIndex += 1;
        return isEven ? `<tr style="${ZEBRA_ROW_STYLE}">` : "<tr>";
      });
      return `<tbody>${styledRows}</tbody>`;
    });

    const withColgroup = colgroupHtml ? styled.replace("<thead", `${colgroupHtml}<thead`) : styled;

    return `<div style="${TABLE_WRAPPER_STYLE}"><table style="${TABLE_STYLE}">${withColgroup}</table></div>`;
  });
}

/**
 * wordpress_blog의 post_body(markdown)를 WordPress REST API content로
 * 보낼 수 있는 안전한 HTML로 변환한다. 빈 문자열이 오면 빈 문자열을
 * 반환한다(에러를 던지지 않는다 — 호출하는 쪽에서 빈 본문 여부는 이미
 * 별도로 검사한다).
 */
export function convertMarkdownToWordPressHtml(markdown: string | null | undefined): string {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return "";

  const { text: withoutAdSlots, markers } = extractAdSlotMarkers(trimmed);
  const { text: withoutBrTags, count: brCount } = extractBrTags(withoutAdSlots);
  const demoted = demoteTopLevelHeading(withoutBrTags);
  const rawHtml = markdownRenderer.render(demoted);
  const safeHtml = sanitizeWordPressHtml(rawHtml);
  const styledHtml = applyWordPressTableStyling(safeHtml);
  const withBrRestored = brCount > 0 ? restoreBrTags(styledHtml) : styledHtml;
  return restoreAdSlotMarkers(withBrRestored, markers);
}

// 이미 HTML로 렌더링된 본문인지 판단할 때 쓰는 블록 태그 패턴.
// 여는 태그(`<h2 ...>`, `<p>` 등) 형태만 인식한다 — markdown 원문에
// 우연히 `<h2>` 같은 문자열이 섞여 있을 가능성은 거의 없고, 있더라도
// html:false 렌더러가 escape하므로 오탐 시 최악의 경우도 "변환을 한 번 더
// 건너뛴다" 정도로 안전한 방향이다.
const HTML_BLOCK_TAG_PATTERN = /<(h1|h2|h3|h4|p|ul|ol|table|blockquote|pre)[\s>]/i;

/**
 * content가 이미 HTML로 렌더링된 것으로 보이면 true를 반환한다.
 * article 고급 기능처럼 "본문이 markdown인지 이미 HTML인지 확신할 수
 * 없는" 호출부에서, 이미 HTML인 값을 markdown 렌더러에 다시 통과시켜
 * 이중 변환(예: `<p>` 태그가 markdown-it에 의해 escape되어 화면에 그대로
 * 노출)하는 사고를 막기 위해 사용한다.
 */
export function looksLikeHtmlContent(content: string | null | undefined): boolean {
  if (!content) return false;
  return HTML_BLOCK_TAG_PATTERN.test(content);
}

/**
 * WordPress로 전송할 content를 안전하게 확정한다.
 * - 이미 HTML로 보이면 그대로 반환한다(이중 변환 방지) — 단, 이 경우도
 *   sanitize는 항상 통과시켜 위험한 태그/속성이 섞여 들어오지 않게 한다.
 * - markdown으로 보이면 convertMarkdownToWordPressHtml()로 변환한다.
 * source_based_explainer/monetized_blog/general_news 등 article 본문
 * format을 상세히 구분하지 않고, "지금 이 문자열이 HTML인가 아닌가"만으로
 * 판단한다 — article 본문은 현재 항상 markdown으로 생성되므로 실무적으로는
 * 거의 항상 변환 분기를 탄다.
 */
export function ensureWordPressHtmlContent(content: string | null | undefined): string {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return "";
  if (looksLikeHtmlContent(trimmed)) {
    return sanitizeWordPressHtml(trimmed);
  }
  return convertMarkdownToWordPressHtml(trimmed);
}
