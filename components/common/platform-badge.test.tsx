import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const componentSource = readFileSync(join(__dirname, "platform-badge.tsx"), "utf-8");

describe("PlatformBadge 컴포넌트 (정적 소스 검사, Phase UX-03C)", () => {
  it("label/색상 계산을 컴포넌트 안에서 직접 하지 않고 lib/ui/platform-badge.ts에 위임한다", () => {
    expect(componentSource).toContain('from "@/lib/ui/platform-badge"');
    expect(componentSource).toContain("describePlatformBadge(platform)");
    expect(componentSource).toContain("getPlatformBadgeClassName(platform)");
  });

  it("raw platform 문자열을 label 변환 없이 그대로 렌더링하지 않는다", () => {
    expect(componentSource).not.toMatch(/>\s*\{platform\}\s*</);
  });
});
