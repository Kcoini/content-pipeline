import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpandableText } from "./expandable-text";

const componentSource = readFileSync(path.join(__dirname, "expandable-text.tsx"), "utf8");

describe("ExpandableText 렌더링", () => {
  it("1,200자 이하면 전체를 그대로 보여주고 버튼이 없다", () => {
    const text = "짧은 본문입니다.".repeat(10); // 훨씬 짧음
    const html = renderToStaticMarkup(<ExpandableText text={text} />);
    expect(html).toContain(text);
    expect(html).not.toContain("전체 보기");
  });

  it("정확히 collapsedLimit와 같은 길이면 버튼이 없다(초과일 때만 접는다)", () => {
    const text = "가".repeat(1200);
    const html = renderToStaticMarkup(<ExpandableText text={text} />);
    expect(html).not.toContain("전체 보기");
  });

  it("1,200자를 초과하면 앞부분만 보여주고 [전체 보기] 버튼을 표시한다", () => {
    const text = "가".repeat(1500);
    const html = renderToStaticMarkup(<ExpandableText text={text} />);
    expect(html).toContain("전체 보기");
    expect(html).not.toContain(text); // 전체 텍스트가 그대로 나오지 않는다(잘려 있음)
  });

  it("previewLength만큼만 접힌 상태로 보여준다(기본 700자 + 말줄임표)", () => {
    const text = "나".repeat(2000);
    const html = renderToStaticMarkup(<ExpandableText text={text} />);
    expect(html).toContain("나".repeat(700));
    expect(html).not.toContain("나".repeat(701));
  });

  it("defaultExpanded=true면 처음부터 전체를 보여주고 라벨은 접기다", () => {
    const text = "다".repeat(1500);
    const html = renderToStaticMarkup(<ExpandableText text={text} defaultExpanded />);
    expect(html).toContain(text);
    expect(html).toContain("접기");
  });

  it("expandLabel/collapseLabel을 커스터마이즈할 수 있다", () => {
    const text = "라".repeat(1500);
    const html = renderToStaticMarkup(<ExpandableText text={text} expandLabel="더 보기" collapseLabel="줄이기" />);
    expect(html).toContain("더 보기");
  });

  it("collapsedLimit/previewLength를 직접 지정할 수 있다", () => {
    const text = "마".repeat(300);
    const html = renderToStaticMarkup(<ExpandableText text={text} collapsedLimit={100} previewLength={50} />);
    expect(html).toContain("전체 보기");
    expect(html).toContain("마".repeat(50));
    expect(html).not.toContain("마".repeat(51));
  });

  it("줄바꿈이 유지되도록 white-space: pre-wrap 스타일을 적용한다", () => {
    const html = renderToStaticMarkup(<ExpandableText text={"한 줄\n두 줄"} />);
    expect(html).toContain("white-space:pre-wrap");
  });
});

describe("ExpandableText 정적 소스 검사", () => {
  it('"use client" 컴포넌트이며 useState로 펼침 상태를 관리한다(서버 action/페이지 이동 없음)', () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("useState");
    expect(componentSource).not.toContain("router.push");
    expect(componentSource).not.toContain("window.location");
    expect(componentSource).not.toContain("<form");
  });

  it("기본 threshold는 1,200자, 기본 preview 길이는 700자다", () => {
    expect(componentSource).toContain("DEFAULT_THRESHOLD_LENGTH = 1200");
    expect(componentSource).toContain("DEFAULT_PREVIEW_LENGTH = 700");
  });

  it("overflow-wrap/line-height로 긴 텍스트/모바일 가독성을 보장한다", () => {
    expect(componentSource).toContain("overflowWrap");
    expect(componentSource).toContain("lineHeight");
  });
});
