import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { TransientNotice } from "./transient-notice";

const componentSource = readFileSync(path.join(__dirname, "transient-notice.tsx"), "utf8");

describe("TransientNotice 렌더링", () => {
  it("message가 있으면 표시한다", () => {
    const html = renderToStaticMarkup(<TransientNotice message="품질검사 완료" />);
    expect(html).toContain("품질검사 완료");
  });

  it("message가 없으면(null/undefined/빈 문자열) 아무것도 렌더링하지 않는다", () => {
    expect(renderToStaticMarkup(<TransientNotice message={null} />)).toBe("");
    expect(renderToStaticMarkup(<TransientNotice message={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<TransientNotice message="" />)).toBe("");
  });

  it("닫기 버튼을 포함한다", () => {
    const html = renderToStaticMarkup(<TransientNotice message="작업 완료" />);
    expect(html).toContain("닫기");
  });

  it("variant별 스타일 class가 적용된다", () => {
    expect(renderToStaticMarkup(<TransientNotice message="성공" variant="success" />)).toContain("bg-green-50");
    expect(renderToStaticMarkup(<TransientNotice message="실패" variant="error" />)).toContain("bg-red-50");
    expect(renderToStaticMarkup(<TransientNotice message="정보" variant="info" />)).toContain("bg-indigo-50");
    expect(renderToStaticMarkup(<TransientNotice message="경고" variant="warning" />)).toContain("bg-amber-50");
  });

  it("position: fixed로 페이지 레이아웃을 밀어내지 않는다", () => {
    expect(renderToStaticMarkup(<TransientNotice message="테스트" />)).toContain("fixed");
  });
});

describe("TransientNotice 정적 소스 검사", () => {
  it("\"use client\" 컴포넌트이며 useState/useEffect로 자동 사라짐을 구현한다", () => {
    expect(componentSource).toContain('"use client"');
    expect(componentSource).toContain("useState");
    expect(componentSource).toContain("useEffect");
    expect(componentSource).toContain("setTimeout");
  });

  it("기본 durationMs는 4000(4초)이다", () => {
    expect(componentSource).toContain("durationMs = 4000");
  });

  it("새 라이브러리를 추가하지 않고 react만 import한다", () => {
    const importLines = componentSource.split(/\r?\n/).filter((line) => line.trim().startsWith("import "));
    expect(importLines).toEqual(['import { useEffect, useState } from "react";']);
  });
});
