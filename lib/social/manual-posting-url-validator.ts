// Phase 3-8: Platform Manual Posting Checklist & Result Recording — URL 검증.
// 사람이 입력한 실제 게시 URL이 http(s) 형식인지, 플랫폼별 권장 도메인과
// 일치하는지 검사한다. 도메인이 다르다고 무조건 차단하지 않고 warning
// 처리한다 — 명백히 URL 형식이 아닌 경우만 blocked로 취급한다.

import type { SocialPlatform } from "./social-platform-types";

export interface ManualPostUrlValidationResult {
  valid: boolean;
  blocked: boolean;
  warnings: string[];
  errors: string[];
}

const RECOMMENDED_DOMAINS: Partial<Record<SocialPlatform, string[]>> = {
  naver_blog: ["blog.naver.com", "m.blog.naver.com"],
  naver_cafe: ["cafe.naver.com"],
  x: ["x.com", "twitter.com"],
  threads: ["threads.net"],
  instagram: ["instagram.com"],
};

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * 수동 게시 URL을 검증한다. http/https가 아니거나 URL 형식이 아니면
 * blocked=true를 반환한다. 플랫폼 권장 도메인과 다르면 warning만
 * 반환한다(차단하지 않음). wordpress_blog는 configuredBaseUrl과
 * 비교해 가산/warning을 판단한다.
 */
export function validateManualPostUrl(
  platform: SocialPlatform,
  url: string,
  configuredBaseUrl?: string | null
): ManualPostUrlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, blocked: true, warnings, errors: ["게시 URL이 비어 있습니다."] };
  }

  const parsed = parseUrl(trimmed);
  if (!parsed) {
    return { valid: false, blocked: true, warnings, errors: ["올바른 URL 형식이 아닙니다."] };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, blocked: true, warnings, errors: ["URL은 http 또는 https 프로토콜이어야 합니다."] };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (platform === "wordpress_blog") {
    if (configuredBaseUrl) {
      const configuredHost = parseUrl(configuredBaseUrl)?.hostname.toLowerCase();
      if (configuredHost && configuredHost !== hostname) {
        warnings.push(`설정된 WordPress 도메인(${configuredHost})과 게시 URL 도메인(${hostname})이 다릅니다.`);
      }
    }
  } else {
    const recommended = RECOMMENDED_DOMAINS[platform];
    if (recommended && !recommended.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      warnings.push(`${platform}의 권장 도메인(${recommended.join(", ")})과 다른 도메인(${hostname})입니다.`);
    }
  }

  return { valid: true, blocked: false, warnings, errors };
}
