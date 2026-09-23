// OPS-02B: scripts/ops/*.ts용 .env.local 로더. scripts/ops-01/load-env.ts와
// 동일한 패턴이다(이 프로젝트에 이미 확립된 방식 — 새 로더 라이브러리를
// 추가하지 않는다). 다른 lib/* import보다 먼저 이 파일을 import해야
// process.env가 채워진 상태로 나머지 모듈이 로드된다. secret 값을
// 로그로 남기지 않는다.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

function loadEnvLocal(): void {
  if (!existsSync(ENV_PATH)) return; // .env.local이 없어도 preflight 자체는 "미설정"으로 정상 동작해야 한다.
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
