import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const CSS_DIR = path.join(process.cwd(), ".next", "static", "chunks");
export const GENERATED_DIR = path.join(process.cwd(), "e2e", ".generated");

function loadCompiledCss(): string {
  let files: string[];
  try {
    files = readdirSync(CSS_DIR).filter((f) => f.endsWith(".css"));
  } catch (error) {
    throw new Error(
      `.next 빌드 출력을 찾을 수 없습니다(${CSS_DIR}). "npm run build"를 먼저 실행하세요. 원본 오류: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  if (files.length === 0) {
    throw new Error(
      `${CSS_DIR}에 CSS 파일이 없습니다. "npm run build"를 먼저 실행해 실제 Tailwind CSS를 생성하세요(fixture는 이 CSS를 그대로 재사용한다).`
    );
  }
  return files.map((f) => readFileSync(path.join(CSS_DIR, f), "utf-8")).join("\n");
}

let cachedCss: string | null = null;

/**
 * QA-01: 실제 공유 UI 컴포넌트를 renderToStaticMarkup으로 렌더링하고,
 * `npm run build`가 만든 실제 Tailwind CSS를 그대로 붙여 browser에
 * 띄운다. 이 프로젝트는 모든 route가 Supabase를 직접 조회하는 서버
 * 컴포넌트라 live 서버+DB 없이는 전체 페이지를 렌더링할 수 없다 —
 * 대신 각 페이지가 실제로 사용하는 컴포넌트를 fixture props로
 * 렌더링해 "실제 코드가 실제 브라우저에서 어떻게 보이는지"를
 * 검증한다. DB 연결/외부 API 호출은 전혀 하지 않는다.
 *
 * 알려진 한계: client component의 onClick 등 인터랙션은 hydration
 * 스크립트가 없어 실제로 동작하지 않는다(클릭 시 아무 일도 일어나지
 * 않는다) — 이 fixture는 "실제로 렌더링된 DOM/CSS/접근성 구조"만
 * 검증하며, 실제 폼 제출/서버 action 왕복은 검증하지 않는다.
 *
 * 중요: 이 함수는 반드시 Vitest 프로세스(e2e/generate-fixtures.setup.test.tsx)
 * 안에서만 호출한다 — Playwright test runner는 `.tsx`를 로드할 때
 * playwright 자신의 jsx-runtime으로 JSX를 강제 변환해(하드코딩,
 * node_modules/playwright/lib/common/index.js) 실제 React 컴포넌트가
 * 깨진다("Objects are not valid as a React child (__pw_type...)" —
 * 실제로 재현/확인됨, tsconfig의 jsxImportSource로도 우회 불가). 그래서
 * fixture는 Vitest가 미리 정적 HTML 파일로 구워두고(writeFixtureFile),
 * Playwright의 *.spec.ts는 그 결과 파일만 file://로 연다 — Playwright
 * 프로세스 안에서는 JSX를 아예 파싱하지 않는다.
 */
export function buildFixtureHtml(node: ReactElement, title = "QA-01 fixture"): string {
  if (cachedCss === null) cachedCss = loadCompiledCss();
  const bodyHtml = renderToStaticMarkup(node);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${cachedCss}</style>
<style>body { margin: 0; background: #fafafa; padding: 16px; color: #18181b; }</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** fixture HTML을 e2e/.generated/<name>.html로 저장한다(Playwright가 file://로 연다). */
export function writeFixtureFile(name: string, node: ReactElement, title?: string): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const html = buildFixtureHtml(node, title ?? name);
  writeFileSync(path.join(GENERATED_DIR, `${name}.html`), html, "utf-8");
}
