// Phase 3-2: social post AI 출력 결과가 social_posts 저장 구조 및
// 플랫폼별 contract(`contracts/social/*.schema.json`)와 호환되는지
// 검증한다. 이 파일은 순수 검증 로직만 담당하며, 실제 AI 호출이나
// DB 접근을 하지 않는다.

import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import type { SocialPlatform } from "./social-platform-types";

/** 협박/공포 조장 표현. */
const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];
/** 광고 클릭 유도 표현. */
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];
/** 허위/과장 수익 보장 표현. */
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];
/** 개인정보 노출 의심 패턴(주민등록번호/전화번호 형식). */
const PII_PATTERN = /\d{6}-\d{7}|\d{3}-\d{3,4}-\d{4}/;

/** 이 값을 초과하는 post_body는 원문 article 전체가 그대로 들어갔을 가능성이 있다고 간주한다. */
const SUSPICIOUS_RAW_CONTENT_LENGTH = 12_000;

export interface SocialOutputRaw {
  platform?: unknown;
  tone_style?: unknown;
  post_title?: unknown;
  post_body?: unknown;
  caption?: unknown;
  excerpt?: unknown;
  hashtags?: unknown;
  thread_items?: unknown;
  card_items?: unknown;
  media_requirements?: unknown;
  platform_metadata?: unknown;
  safety_notes?: unknown;
}

export interface SocialOutputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedOutput: Record<string, unknown>;
}

export function validatePlatform(platform: unknown): platform is SocialPlatform {
  return isSocialPlatform(platform);
}

export function validateToneStyle(toneStyle: unknown): boolean {
  return isToneStyle(toneStyle);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 플랫폼별 필수 필드가 채워져 있는지 확인한다. 조건은
 * `contracts/social/*.schema.json`의 required 목록과 일치한다.
 */
export function validateRequiredFieldsByPlatform(platform: SocialPlatform, output: SocialOutputRaw): string[] {
  const errors: string[] = [];

  switch (platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe":
      if (!isNonEmptyString(output.post_title)) errors.push("post_title이 필요합니다.");
      if (!isNonEmptyString(output.post_body)) errors.push("post_body가 필요합니다.");
      break;

    case "x":
      if (!isArray(output.thread_items) || output.thread_items.length === 0) {
        errors.push("x 플랫폼은 thread_items가 최소 1개 이상 필요합니다.");
      }
      break;

    case "threads":
      if (!isNonEmptyString(output.post_body)) errors.push("post_body가 필요합니다.");
      break;

    case "instagram":
      if (!isNonEmptyString(output.caption)) errors.push("caption이 필요합니다.");
      if (!isArray(output.hashtags) || output.hashtags.length === 0) {
        errors.push("instagram 플랫폼은 hashtags가 최소 1개 이상 필요합니다.");
      }
      break;

    default: {
      const exhaustiveCheck: never = platform;
      errors.push(`지원하지 않는 platform입니다: ${String(exhaustiveCheck)}`);
    }
  }

  return errors;
}

/**
 * 출력값에서 image binary/불필요한 필드를 제거하고, 배열이어야 할 필드가
 * 배열이 아니면 빈 배열로 정리한 안전한 사본을 반환한다. 원본을
 * 변형하지 않는다.
 */
export function sanitizeSocialOutput(output: SocialOutputRaw): Record<string, unknown> {
  return {
    platform: output.platform,
    tone_style: output.tone_style,
    post_title: typeof output.post_title === "string" ? output.post_title : null,
    post_body: typeof output.post_body === "string" ? output.post_body : null,
    caption: typeof output.caption === "string" ? output.caption : null,
    excerpt: typeof output.excerpt === "string" ? output.excerpt : null,
    hashtags: isArray(output.hashtags) ? output.hashtags.filter((tag) => typeof tag === "string") : [],
    thread_items: isArray(output.thread_items) ? output.thread_items : [],
    card_items: isArray(output.card_items) ? output.card_items : [],
    media_requirements:
      output.media_requirements && typeof output.media_requirements === "object" ? output.media_requirements : {},
    platform_metadata:
      output.platform_metadata && typeof output.platform_metadata === "object" ? output.platform_metadata : {},
  };
}

/**
 * social post AI 출력 결과를 검증한다. platform/tone_style 유효성,
 * 플랫폼별 필수 필드, 배열 타입, 빈 글 여부, 금지 표현(협박/광고 클릭
 * 유도/허위 수익 보장/개인정보 노출 의심), 원문 article이 그대로
 * 들어간 것으로 의심되는 과도한 길이를 확인한다.
 */
export function validateSocialOutput(platform: unknown, output: SocialOutputRaw): SocialOutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!validatePlatform(platform)) {
    errors.push(`지원하지 않는 platform입니다: ${String(platform)}`);
  }
  if (!validateToneStyle(output.tone_style)) {
    errors.push(`지원하지 않는 tone_style입니다: ${String(output.tone_style)}`);
  }

  if (output.hashtags !== undefined && !isArray(output.hashtags)) {
    errors.push("hashtags는 배열이어야 합니다.");
  }
  if (output.thread_items !== undefined && !isArray(output.thread_items)) {
    errors.push("thread_items는 배열이어야 합니다.");
  }
  if (output.card_items !== undefined && !isArray(output.card_items)) {
    errors.push("card_items는 배열이어야 합니다.");
  }

  const hasAnyContent =
    isNonEmptyString(output.post_body) ||
    isNonEmptyString(output.caption) ||
    (isArray(output.thread_items) && output.thread_items.length > 0);
  if (!hasAnyContent) {
    errors.push("post_body/caption/thread_items가 모두 비어 있습니다.");
  }

  if (validatePlatform(platform)) {
    errors.push(...validateRequiredFieldsByPlatform(platform, output));
  }

  const combinedText = [
    textOf(output.post_title),
    textOf(output.post_body),
    textOf(output.caption),
    textOf(output.excerpt),
  ].join(" ");

  const threatFound = THREAT_PATTERNS.some((pattern) => combinedText.includes(pattern));
  if (threatFound) errors.push("협박성 표현이 포함되어 있습니다.");

  const adClickFound = AD_CLICK_BAIT_PATTERNS.some((pattern) => combinedText.includes(pattern));
  if (adClickFound) errors.push("광고 클릭 유도 표현이 포함되어 있습니다.");

  const incomeGuaranteeFound = INCOME_GUARANTEE_PATTERNS.some((pattern) => combinedText.includes(pattern));
  if (incomeGuaranteeFound) errors.push("허위/과장 수익 보장 표현이 포함되어 있습니다.");

  if (PII_PATTERN.test(combinedText)) {
    errors.push("개인정보 노출로 의심되는 문자열이 포함되어 있습니다.");
  }

  const postBodyLength = textOf(output.post_body).length;
  if (postBodyLength > SUSPICIOUS_RAW_CONTENT_LENGTH) {
    warnings.push(
      `post_body 길이가 비정상적으로 깁니다 (${postBodyLength}자) — 원문 article 전체가 그대로 들어갔을 수 있습니다.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedOutput: sanitizeSocialOutput(output),
  };
}
