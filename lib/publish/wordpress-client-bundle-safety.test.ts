// Phase 2-2: WordPress Application Password가 client bundle에 노출되지 않는지
// 정적으로 검증한다. 이 프로젝트는 현재 "use client" 컴포넌트가 없는
// 서버 컴포넌트 전용 구조이지만, 향후 client component가 추가되더라도
// WORDPRESS_APP_PASSWORD를 참조하거나 wordpress-client를 import하지 않아야 한다.

import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function listFilesRecursive(dir: string, results: string[] = []): string[] {
  let dirents: Dirent[];
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const dirent of dirents) {
    if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
    const fullPath = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      listFilesRecursive(fullPath, results);
    } else if (/\.(ts|tsx)$/.test(dirent.name) && !dirent.name.endsWith(".test.ts") && !dirent.name.endsWith(".test.tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("WordPress Application Password는 client bundle에 노출되지 않는다", () => {
  it("\"use client\" 파일 중 WORDPRESS_APP_PASSWORD를 참조하거나 wordpress-client를 import하는 파일이 없다", () => {
    const files = [...listFilesRecursive(join(ROOT, "app")), ...listFilesRecursive(join(ROOT, "lib"))];

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const isClientComponent = /^\s*["']use client["'];?/m.test(content);
      if (!isClientComponent) continue;

      if (content.includes("WORDPRESS_APP_PASSWORD") || content.includes("wordpress-client")) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("wordpress-client.ts는 NEXT_PUBLIC_ 접두사 환경변수를 사용하지 않는다", () => {
    const content = readFileSync(join(ROOT, "lib", "publish", "wordpress-client.ts"), "utf-8");
    expect(content).not.toMatch(/NEXT_PUBLIC_WORDPRESS/);
  });

  it("wordpress-client.ts는 Authorization header/password를 console에 출력하지 않는다", () => {
    const content = readFileSync(join(ROOT, "lib", "publish", "wordpress-client.ts"), "utf-8");
    const consoleLines = content
      .split("\n")
      .filter((line) => line.includes("console."));
    for (const line of consoleLines) {
      expect(line).not.toMatch(/authToken|appPassword|Authorization/i);
    }
  });
});
