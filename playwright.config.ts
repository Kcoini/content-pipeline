import { defineConfig, devices } from "@playwright/test";

// QA-01: 이 프로젝트의 모든 route는 DB(Supabase)를 직접 조회하는
// 서버 컴포넌트라, live 서버+테스트 DB 없이는 전체 페이지를 띄울 수
// 없다. 대신 각 페이지가 실제로 쓰는 공유 UI 컴포넌트를 fixture
// props로 renderToStaticMarkup + npm run build가 만든 실제 Tailwind
// CSS로 렌더링해, Chromium에서 실제로 어떻게 보이는지 검증한다
// (e2e/support/render-fixture.tsx 참고). webServer를 띄우지 않으므로
// production 자격증명/외부 API 호출이 전혀 없다.
export default defineConfig({
  testDir: "./e2e",
  // QA-01: 기본 "*.spec.ts"가 아니라 "*.pw.ts"를 쓴다 — vitest의 기본
  // 수집 패턴(*.test.*/*.spec.*)과 겹치지 않게 해서, Playwright 전용
  // 파일이 "npm run test"(vitest)에 절대 섞여 들어가지 않게 한다.
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./e2e/.artifacts",
  use: {
    trace: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "narrow-390x844",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
