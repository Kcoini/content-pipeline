import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// OPS-02B: scripts/ops/*.ts(운영 CLI: preflight/비용 리포트/health
// summary 등)를 실행하기 위한 전용 config. 일반 "npm run test"의
// 수집 대상이 아니다 — npm run ops:* 스크립트가 이 config로만
// 명시적으로 실행한다(scripts/ops-01/의 vitest.ops-01.config.ts와
// 동일한 패턴).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["scripts/ops/*.ts"],
  },
});
