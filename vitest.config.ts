import { defineConfig, configDefaults } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // QA-01: e2e/는 이 기본 config(일반 "npm run test")의 대상이
    // 아니다 — Playwright 전용 spec(e2e/*.pw.ts)과 fixture 생성
    // 스크립트(e2e/generate-fixtures.setup.tsx, `.next` 빌드 결과가
    // 있어야 실행 가능)는 별도로 관리한다(vitest.e2e-fixtures.config.ts,
    // "npm run test:e2e" 참고).
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
