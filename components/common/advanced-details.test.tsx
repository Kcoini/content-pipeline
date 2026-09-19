import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvancedDetails } from "./advanced-details";

describe("AdvancedDetails", () => {
  it("기본값으로 title '상세 상태 보기'를 보여주고 기본은 닫혀 있다(open 속성 없음)", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails>
        <p>내부 정보</p>
      </AdvancedDetails>
    );
    expect(html).toContain("상세 상태 보기");
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("title prop으로 문구를 바꿀 수 있다", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails title="고급 정보">
        <p>내부 정보</p>
      </AdvancedDetails>
    );
    expect(html).toContain("고급 정보");
  });

  it("children은 항상 DOM에 존재한다(details가 닫혀 있어도 접근 가능 — CSS로만 숨겨진다)", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails>
        <p>펼치면 보이는 내용입니다</p>
      </AdvancedDetails>
    );
    expect(html).toContain("펼치면 보이는 내용입니다");
  });

  it("defaultOpen=true면 open 속성이 붙는다(정말 필요한 경우에만 사용)", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails defaultOpen>
        <p>내용</p>
      </AdvancedDetails>
    );
    expect(html).toMatch(/<details[^>]*\bopen=""/);
  });

  it("testId를 넘기면 data-testid로 렌더링된다", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails testId="wp-panel-details">
        <p>내용</p>
      </AdvancedDetails>
    );
    expect(html).toContain('data-testid="wp-panel-details"');
  });

  it("raw/internal/debug 같은 개발자 용어를 기본 title로 쓰지 않는다", () => {
    const html = renderToStaticMarkup(
      <AdvancedDetails>
        <p>내용</p>
      </AdvancedDetails>
    );
    expect(html).not.toMatch(/\braw\b/i);
    expect(html).not.toMatch(/\binternal\b/i);
    expect(html).not.toMatch(/\bdebug\b/i);
  });
});
