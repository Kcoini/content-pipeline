import { describe, expect, it } from "vitest";
import { validateManualPostUrl } from "./manual-posting-url-validator";

describe("validateManualPostUrl", () => {
  it("http/https가 아니면 blocked를 반환한다", () => {
    const result = validateManualPostUrl("naver_blog", "ftp://blog.naver.com/abc");
    expect(result.blocked).toBe(true);
  });

  it("URL 형식이 아니면 blocked를 반환한다", () => {
    const result = validateManualPostUrl("naver_blog", "이것은 URL이 아닙니다");
    expect(result.blocked).toBe(true);
  });

  it("빈 문자열은 blocked를 반환한다", () => {
    const result = validateManualPostUrl("x", "");
    expect(result.blocked).toBe(true);
  });

  it("naver_blog 권장 도메인이면 warning이 없다", () => {
    const result = validateManualPostUrl("naver_blog", "https://blog.naver.com/myid/12345");
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("naver_cafe 권장 도메인이 아니면 warning을 반환하지만 valid하다", () => {
    const result = validateManualPostUrl("naver_cafe", "https://example.com/post/1");
    expect(result.valid).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("x는 x.com/twitter.com을 권장 도메인으로 인정한다", () => {
    expect(validateManualPostUrl("x", "https://x.com/user/status/1").warnings).toEqual([]);
    expect(validateManualPostUrl("x", "https://twitter.com/user/status/1").warnings).toEqual([]);
  });

  it("instagram/threads도 권장 도메인 검사를 수행한다", () => {
    expect(validateManualPostUrl("instagram", "https://instagram.com/p/abc").warnings).toEqual([]);
    expect(validateManualPostUrl("threads", "https://threads.net/@user/post/abc").warnings).toEqual([]);
    expect(validateManualPostUrl("instagram", "https://example.com/p/abc").warnings.length).toBeGreaterThan(0);
  });

  it("wordpress_blog는 configuredBaseUrl과 다르면 warning을 반환한다", () => {
    const result = validateManualPostUrl("wordpress_blog", "https://other-domain.com/post/1", "https://my-wordpress.com");
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("wordpress_blog는 configuredBaseUrl과 같으면 warning이 없다", () => {
    const result = validateManualPostUrl("wordpress_blog", "https://my-wordpress.com/post/1", "https://my-wordpress.com");
    expect(result.warnings).toEqual([]);
  });
});
