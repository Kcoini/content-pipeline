import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// QA-01: e2e/generate-fixtures.setup.tsx 하나만 실행하기 위한 전용
// vitest config. 일반 "npm run test"(vitest.config.ts)는 e2e/를
// 제외하므로, 이 fixture 생성 스크립트는 이 config로만 실행된다
// ("npm run test:e2e" 참고). `.next` 빌드 결과(Tailwind CSS)가 있어야
// 하므로 항상 `next build` 다음에 실행한다.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["e2e/generate-fixtures.setup.tsx"],
  },
});
