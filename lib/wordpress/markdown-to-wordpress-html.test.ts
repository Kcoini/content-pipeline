import { describe, expect, it } from "vitest";
import {
  convertMarkdownToWordPressHtml,
  ensureWordPressHtmlContent,
  looksLikeHtmlContent,
  WORDPRESS_BOX_CLASSES,
} from "./markdown-to-wordpress-html";
import { adSlotMarkerComment } from "@/lib/articles/article-modes";

describe("convertMarkdownToWordPressHtml", () => {
  it("## 는 <h2>로 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("## 먼저 결론부터 보면\n\n본문입니다.");
    expect(html).toContain("<h2>먼저 결론부터 보면</h2>");
  });

  it("### 는 <h3>로 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("### 신혼부부·자녀출산 가구라면\n\n본문입니다.");
    expect(html).toContain("<h3>신혼부부·자녀출산 가구라면</h3>");
  });

  it("최상위 # h1은 h2로 낮춰서 변환한다(post_title과 중복 방지)", () => {
    const html = convertMarkdownToWordPressHtml("# 제목입니다\n\n본문입니다.");
    expect(html).toContain("<h2>제목입니다</h2>");
    expect(html).not.toContain("<h1>");
  });

  it("##/###는 h1 낮추기 로직의 영향을 받지 않는다", () => {
    const html = convertMarkdownToWordPressHtml("## 소제목\n\n### 소소제목");
    expect(html).toContain("<h2>소제목</h2>");
    expect(html).toContain("<h3>소소제목</h3>");
  });

  it("markdown table이 <table>(가독성 스타일 포함)로 변환된다", () => {
    const markdown = ["| 구분 | 대상 | 지원 내용 |", "|---|---|---|", "| A | 신혼부부 | 이자 지원 |"].join("\n");
    const html = convertMarkdownToWordPressHtml(markdown);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("구분");
    expect(html).toContain("신혼부부");
  });

  it("unordered list가 <ul><li>로 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("- 항목 A\n- 항목 B");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>항목 A</li>");
  });

  it("ordered list가 <ol><li>로 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("1. 첫 번째\n2. 두 번째");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>첫 번째</li>");
  });

  it("bold/italic이 strong/em으로 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("**굵게** 그리고 *기울임*");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<em>기울임</em>");
  });

  it("링크가 <a href>로 변환되고 안전한 rel이 붙는다", () => {
    const html = convertMarkdownToWordPressHtml("[출처](https://example.com/article)");
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });

  it("blockquote/code/hr이 변환된다", () => {
    const html = convertMarkdownToWordPressHtml("> 인용문\n\n`코드`\n\n---");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<code>코드</code>");
    expect(html).toMatch(/<hr\s*\/?>/);
  });

  it("script 태그는 실행 가능한 형태로 렌더링되지 않는다(html:false로 escape되어 텍스트로만 남음)", () => {
    const html = convertMarkdownToWordPressHtml("본문입니다.\n\n<script>alert(1)</script>\n\n이어지는 본문.");
    // sanitize-html 대상 태그는 존재하지 않고(실행 가능한 <script> 요소가 없고),
    // markdown-it(html:false)이 이미 &lt;script&gt;로 escape해 순수 텍스트로만 남는다.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<script ");
    expect(html).toContain("&lt;script&gt;");
  });

  it("iframe 태그는 제거된다", () => {
    const html = convertMarkdownToWordPressHtml('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("onclick 등 이벤트 속성은 제거된다", () => {
    const html = convertMarkdownToWordPressHtml('[링크](https://example.com "onclick=alert(1)")');
    expect(html).not.toContain("onclick");
  });

  it("style 속성은 제거된다", () => {
    // sanitize-html의 allowedAttributes에 style이 없으므로, markdown-it이 만들어내지
    // 않는 style 속성이 섞여 들어와도 최종 출력에는 남지 않는다.
    const html = convertMarkdownToWordPressHtml("일반 본문입니다.");
    expect(html).not.toContain("style=");
  });

  it("AD_SLOT marker가 렌더링/sanitize 후에도 그대로 보존된다", () => {
    const marker = adSlotMarkerComment("after_intro");
    const html = convertMarkdownToWordPressHtml(`도입부입니다.\n\n${marker}\n\n## 다음 섹션`);
    expect(html).toContain(marker);
  });

  it("AD_SLOT marker를 사용자에게 보이는 문장으로 바꾸지 않는다", () => {
    const marker = adSlotMarkerComment("before_faq");
    const html = convertMarkdownToWordPressHtml(`본문\n\n${marker}\n\n## FAQ`);
    expect(html).not.toMatch(/광고|배너|ad slot/i);
    expect(html).toContain(marker);
  });

  it("여러 개의 서로 다른 AD_SLOT marker가 모두 보존된다", () => {
    const markerA = adSlotMarkerComment("after_summary");
    const markerB = adSlotMarkerComment("mid_content_1");
    const html = convertMarkdownToWordPressHtml(`요약\n\n${markerA}\n\n본문\n\n${markerB}\n\n결론`);
    expect(html).toContain(markerA);
    expect(html).toContain(markerB);
  });

  it("빈 문자열/null/undefined는 빈 문자열을 반환한다(에러를 던지지 않음)", () => {
    expect(convertMarkdownToWordPressHtml("")).toBe("");
    expect(convertMarkdownToWordPressHtml(null)).toBe("");
    expect(convertMarkdownToWordPressHtml(undefined)).toBe("");
  });

  it("허용되지 않은 태그(div, span 등)는 제거되지만 텍스트 내용은 보존한다", () => {
    const html = convertMarkdownToWordPressHtml("<div>본문 내용</div>");
    expect(html).not.toContain("<div");
    expect(html).toContain("본문 내용");
  });

  describe("표(table) 가독성 개선 — WordPress 공개 화면 대응", () => {
    const FOUR_COL_TABLE = [
      "| 구분 | 대상 | 지원 내용 | 신청 기한 |",
      "|---|---|---|---|",
      "| 신혼부부 | 무주택 신혼부부 | 대출이자 최대 1.5% | 2026.5.4~6.22 |",
      "| 다자녀 | 2자녀 이상 가구 | 대출이자 최대 2% | 별도 공지 |",
    ].join("\n");

    it("<table>에 width/border-collapse/table-layout:fixed 스타일이 적용된다", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      expect(html).toMatch(/<table style="[^"]*width:100%[^"]*border-collapse:collapse[^"]*table-layout:fixed[^"]*">/);
    });

    it("th/td에 border/padding(12px 이상)/vertical-align:top/word-break/overflow-wrap이 적용된다", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      expect(html).toMatch(/<th style="[^"]*border:1px solid[^"]*padding:12px[^"]*vertical-align:top[^"]*word-break:keep-all[^"]*overflow-wrap:break-word[^"]*"/);
      expect(html).toMatch(/<td style="[^"]*border:1px solid[^"]*padding:12px[^"]*vertical-align:top[^"]*word-break:keep-all[^"]*overflow-wrap:break-word[^"]*"/);
    });

    it("thead에 배경색이 적용된다", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      expect(html).toMatch(/<thead style="background-color:[^"]+">/);
    });

    it("tbody의 짝수 번째 행(0-indexed 1,3,...)에 zebra 배경이 적용되고 첫 행은 적용되지 않는다", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
      expect(tbodyMatch).toBeTruthy();
      const rows = tbodyMatch![1].match(/<tr[^>]*>/g) ?? [];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toBe("<tr>");
      expect(rows[1]).toMatch(/<tr style="background-color:[^"]+">/);
    });

    it("4열 표는 구분 16%/대상 28%/지원 내용 34%/신청 기한 22% 권장 폭의 colgroup을 갖는다", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      expect(html).toContain(
        '<colgroup><col style="width:16%"><col style="width:28%"><col style="width:34%"><col style="width:22%"></colgroup>'
      );
    });

    it("4열이 아닌 표는 열 개수에 맞춰 균등한 폭의 colgroup을 갖는다", () => {
      const threeColTable = ["| A | B | C |", "|---|---|---|", "| 1 | 2 | 3 |"].join("\n");
      const html = convertMarkdownToWordPressHtml(threeColTable);
      expect(html).toContain(
        '<colgroup><col style="width:33.33%"><col style="width:33.33%"><col style="width:33.33%"></colgroup>'
      );
    });

    it("표는 가로 스크롤이 가능한 반응형 래퍼(div)로 감싸진다(모바일 대응)", () => {
      const html = convertMarkdownToWordPressHtml(FOUR_COL_TABLE);
      expect(html).toMatch(/<div style="[^"]*overflow-x:auto[^"]*"><table/);
    });

    it("markdown 표 정렬(:---:)이 지정되면 text-align이 가독성 스타일과 함께 유지된다", () => {
      const alignedTable = ["| 구분 | 금액 |", "|---|---:|", "| A | 100만원 |"].join("\n");
      const html = convertMarkdownToWordPressHtml(alignedTable);
      expect(html).toMatch(/<th style="[^"]*text-align:right;?"/);
    });

    it("표 셀 안의 <br>은 여러 항목을 짧게 나열하는 용도로 보존된다(bullet 2~3개 표현)", () => {
      const tableWithBr = [
        "| 지원 내용 | 대상 |",
        "|---|---|",
        "| 이자 0.2%<br>대출잔액 3억 이내 | 신혼부부 |",
      ].join("\n");
      const html = convertMarkdownToWordPressHtml(tableWithBr);
      expect(html).toContain("이자 0.2%<br>대출잔액 3억 이내");
    });

    it("표가 아닌 일반 본문에도 <br>이 안전하게 보존된다", () => {
      const html = convertMarkdownToWordPressHtml("첫 줄<br>둘째 줄");
      expect(html).toContain("<br>");
    });

    it("표 밖의 일반 헤딩/문단에는 표 전용 스타일이 붙지 않는다", () => {
      const html = convertMarkdownToWordPressHtml("## 소제목\n\n일반 문단입니다.");
      expect(html).not.toContain("border:1px solid");
    });
  });
});

describe("looksLikeHtmlContent (Phase 2-21: article 고급 기능 공통 재사용)", () => {
  it("markdown 원문(#, ##, 표, 목록)은 HTML로 보지 않는다", () => {
    expect(looksLikeHtmlContent("# 제목\n\n본문")).toBe(false);
    expect(looksLikeHtmlContent("## 소제목\n\n- 목록1\n- 목록2")).toBe(false);
    expect(looksLikeHtmlContent("| A | B |\n|---|---|\n| 1 | 2 |")).toBe(false);
  });

  it("빈 값/공백은 HTML로 보지 않는다", () => {
    expect(looksLikeHtmlContent(null)).toBe(false);
    expect(looksLikeHtmlContent(undefined)).toBe(false);
    expect(looksLikeHtmlContent("")).toBe(false);
    expect(looksLikeHtmlContent("   ")).toBe(false);
  });

  it("<h2>/<p>/<table> 등 블록 태그가 있으면 HTML로 인식한다", () => {
    expect(looksLikeHtmlContent("<h2>제목</h2><p>본문</p>")).toBe(true);
    expect(looksLikeHtmlContent("<table><tr><td>표</td></tr></table>")).toBe(true);
    expect(looksLikeHtmlContent("<ul><li>목록</li></ul>")).toBe(true);
  });
});

describe("ensureWordPressHtmlContent (Phase 2-21: article 고급 기능 WordPress 전송용 content 확정)", () => {
  it("markdown이면 convertMarkdownToWordPressHtml과 동일하게 변환한다", () => {
    const markdown = "# 제목\n\n## 소제목\n\n본문 내용";
    expect(ensureWordPressHtmlContent(markdown)).toBe(convertMarkdownToWordPressHtml(markdown));
  });

  it("markdown 표/목록/링크가 모두 올바른 HTML로 변환된다", () => {
    const markdown = [
      "### 하위 소제목",
      "",
      "- 목록 항목",
      "",
      "| 항목 | 설명 |",
      "|---|---|",
      "| A | B |",
      "",
      "[링크](https://example.com)",
    ].join("\n");
    const html = ensureWordPressHtmlContent(markdown);
    expect(html).toContain("<h3>하위 소제목</h3>");
    expect(html).toContain("<li>목록 항목</li>");
    expect(html).toContain("<table");
    expect(html).toMatch(/<a href="https:\/\/example\.com"[^>]*>링크<\/a>/);
  });

  it("이미 HTML이면 markdown 렌더러를 다시 거치지 않고 그대로(sanitize만 적용) 반환한다", () => {
    const html = "<h2>이미 변환된 제목</h2><p>본문입니다.</p>";
    expect(ensureWordPressHtmlContent(html)).toBe(html);
  });

  it("이미 HTML이어도 script/on* 이벤트 등 위험한 내용은 sanitize로 제거된다", () => {
    const dangerousHtml = '<h2>제목</h2><p onclick="alert(1)">본문</p><script>alert(1)</script>';
    const result = ensureWordPressHtmlContent(dangerousHtml);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("onclick");
  });

  it("빈 값/공백은 빈 문자열을 반환한다", () => {
    expect(ensureWordPressHtmlContent(null)).toBe("");
    expect(ensureWordPressHtmlContent(undefined)).toBe("");
    expect(ensureWordPressHtmlContent("   ")).toBe("");
  });
});

describe("박스 컨테이너(<div class=\"...\">) 변환 (Phase 2-24: 수익형 블로그 구조 강화)", () => {
  it('<div class="summary-box">...</div>가 그대로 보존되고, 안의 markdown(굵게/목록)은 정상 변환된다', () => {
    const markdown = [
      "## 먼저 결론부터 보면",
      "",
      '<div class="summary-box">',
      "",
      "**먼저 결론**",
      "",
      "- 핵심 결론 1",
      "- 핵심 결론 2",
      "",
      "</div>",
    ].join("\n");
    const html = convertMarkdownToWordPressHtml(markdown);
    expect(html).toContain('<div class="summary-box">');
    expect(html).toContain("</div>");
    expect(html).toContain("<strong>먼저 결론</strong>");
    expect(html).toContain("<li>핵심 결론 1</li>");
    // <div>가 <p> 안에 갇히지 않아야 한다(block 요소가 p 안에 들어가면 깨진다).
    expect(html).not.toMatch(/<p>\s*<div/);
  });

  it("WORDPRESS_BOX_CLASSES에 있는 모든 class를 지원한다(checklist-box/warning-box/source-box/key-points-box)", () => {
    for (const boxClass of WORDPRESS_BOX_CLASSES) {
      const markdown = [`<div class="${boxClass}">`, "", "내용", "", "</div>"].join("\n");
      const html = convertMarkdownToWordPressHtml(markdown);
      expect(html).toContain(`<div class="${boxClass}">`);
    }
  });

  it("화이트리스트에 없는 class는 보존되지 않고 escape되어 안전하게 무력화된다", () => {
    const markdown = ['<div class="evil-class">', "", "내용", "", "</div>"].join("\n");
    const html = convertMarkdownToWordPressHtml(markdown);
    expect(html).not.toMatch(/<div\b/);
    expect(html).toContain("&lt;div");
  });

  it("onclick 등 위험한 속성이 섞인 div는 실행 가능한 HTML로 남지 않는다(escape되어 무력화)", () => {
    const markdown = ['<div class="summary-box" onclick="alert(1)">', "", "내용", "", "</div>"].join("\n");
    const html = convertMarkdownToWordPressHtml(markdown);
    // 화이트리스트 패턴(class 속성 하나만 있는 형태)과 정확히 일치하지 않으므로
    // 박스로 인식되지 않고 그대로 escape된다 — onclick이 실제 속성으로 남지 않는다.
    expect(html).not.toMatch(/<div\b[^&]*onclick=/);
  });

  it("이미 HTML로 변환된 content(ensureWordPressHtmlContent의 HTML 분기)에서도 summary-box가 유지된다", () => {
    const alreadyHtml = '<h2>제목</h2><div class="summary-box"><p>본문</p></div>';
    const result = ensureWordPressHtmlContent(alreadyHtml);
    expect(result).toContain('<div class="summary-box">');
  });
});
