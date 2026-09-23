import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// OPS-01: 실제 파일럿 드라이버 스크립트(scripts/ops-01/pilot-*.ts)를
// 실행하기 위한 전용 config. 일반 "npm run test"(vitest.config.ts)의
// 수집 대상이 아니다 — 이 config로만 명시적으로 실행한다. 각 스크립트는
// 실제 Supabase/Anthropic/WordPress에 접근하므로 병렬 실행하지 않는다
// (파일당 하나의 worker, 순서 보장 불필요하면 개별 실행).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["scripts/ops-01/pilot-*.ts", "scripts/ops-01/investigate-*.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
