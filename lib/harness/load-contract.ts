// Reins Engineering: contracts/*.yaml 파일을 읽어 Contract 객체로 변환한다.
// fs를 사용하므로 Node.js 런타임(Server Component, Server Action, Route Handler)에서만
// import해야 한다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import type { Contract } from "./types";

const CONTRACTS_DIR = join(process.cwd(), "contracts");

const cache = new Map<string, Contract>();

/**
 * contracts/ 디렉터리의 YAML 계약 파일을 로드한다.
 * 결과는 캐시되므로 파일 변경 시 서버를 재시작해야 한다.
 */
export function loadContract(fileName: string): Contract {
  const cached = cache.get(fileName);
  if (cached) return cached;

  const filePath = join(CONTRACTS_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  const contract = load(raw) as Contract;

  cache.set(fileName, contract);
  return contract;
}
