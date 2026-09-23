// OPS-01: 파일럿 드라이버 스크립트(scripts/ops-01/pilot-*.ts)가 vitest로
// 실행될 때 .env.local을 process.env로 로드한다. vitest는 Next.js와
// 달리 .env.local을 자동으로 읽지 않으므로, 각 드라이버 스크립트의
// 맨 위에서 다른 어떤 lib/* import보다 먼저 이 파일을 import해야 한다
// (ai-config.ts 등은 process.env를 호출 시점에 읽으므로 이 순서만
// 지키면 안전하다). secret 값을 로그로 남기지 않는다 — 여기서도 절대
// console.log로 값을 출력하지 않는다.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

function loadEnvLocal(): void {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`.env.local을 찾을 수 없습니다(${ENV_PATH}). OPS-01 파일럿은 실제 credential이 필요합니다.`);
  }
  const content = readFileSync(ENV_PATH, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();
