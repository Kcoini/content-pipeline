// wordpress_blog 전용: "SEO Metadata 반영"이 개인정보 의심 표현 때문에
// 차단됐을 때, 실제 개인정보인지 false positive(예: 공공기관 대표번호)인지
// 사람이 확인하고 예외 처리할 수 있게 하는 모듈이다.
//
// 중요 원칙(반드시 지킨다):
// - platform='wordpress_blog'에만 적용한다. naver_blog 등 다른 플랫폼에는
//   전혀 영향을 주지 않는다 — 이 파일은 wordpress_blog 전용이며,
//   `lib/social/platform-publishing-rules.ts`의 공용 PII_PATTERN(모든
//   플랫폼이 함께 쓰는 checkForbiddenPatterns)은 절대 수정하지 않는다.
// - 이 모듈은 그 공용 검사와 "같은 판정 기준"(주민등록번호/전화번호 형식)을
//   재사용하되, 실제 매칭된 문자열의 위치/마스킹 표시만 별도로 계산한다.
// - 실제 개인정보(주민등록번호, 010 휴대전화)로 보이는 값은 절대
//   false positive로 확인(override)할 수 없다 — 이 모듈 안에서 항상
//   "실제 위험(real risk)"으로 분류되어 예외 대상에서 제외된다.
// - 원문 전체를 로그나 platformMetadata에 저장하지 않는다 — 항상
//   마스킹된 값(maskedValue)과 위치(location)만 남긴다.
// - DB schema를 변경하지 않는다 — 결과는 기존 JSON 컬럼인
//   social_posts.platformMetadata 안(manualSafetyReview 키)에만 저장한다.

import { createHash } from "node:crypto";
import { getSocialPostById, updateSocialPostContent } from "@/lib/repositories/social-posts-repository";
import { logEvent } from "@/lib/harness/logger";
import type { SocialPost } from "./social-platform-types";
import type { WordPressBlogPublishReadiness } from "./wordpress-blog-publish-readiness";

/**
 * 실제 개인정보로 보는 유형(resident_registration_number_like,
 * mobile_phone_like)은 절대 false positive 예외 대상이 아니다.
 * phone_like_pattern(010이 아닌 나머지 자리수 조합 — 지역번호/대표번호 등)만
 * 사람이 "개인정보 아님"으로 확인할 수 있다.
 */
export type PersonalInfoSuspectType =
  | "resident_registration_number_like"
  | "mobile_phone_like"
  | "phone_like_pattern";

export type PersonalInfoSuspectLocation = "post_title" | "post_body" | "seo_title" | "meta_description";

export interface PersonalInfoSuspectItem {
  type: PersonalInfoSuspectType;
  location: PersonalInfoSuspectLocation;
  /** 마스킹된 감지 문자열. 원문은 절대 포함하지 않는다. */
  maskedValue: string;
  /** 마스킹된 문맥 일부(앞뒤 짧은 텍스트 포함, 원문 노출 없이). */
  context: string;
}

export interface ManualSafetyReviewOverrideItem {
  type: PersonalInfoSuspectType;
  location: PersonalInfoSuspectLocation;
  maskedValue: string;
}

export interface ProhibitedExpressionOverride {
  status: "confirmed_false_positive";
  reason: string;
  confirmedAt: string;
  confirmedBy: string;
  items: ManualSafetyReviewOverrideItem[];
  /** 확인 당시 감지된 항목들의 지문 — 이후 본문이 바뀌어 감지 결과가 달라지면 재확인이 필요하다. */
  contentFingerprint: string;
}

export interface ManualSafetyReviewRecord {
  prohibitedExpressionOverride?: ProhibitedExpressionOverride;
}

const RESIDENT_NUMBER_PATTERN = /\d{6}-\d{7}/g;
const PHONE_LIKE_PATTERN = /\d{3}-\d{3,4}-\d{4}/g;

const CONTEXT_WINDOW = 15;

/** 010으로 시작하는 번호만 실제 휴대전화(개인정보) 위험으로 본다. */
function isMobilePhoneLike(raw: string): boolean {
  return raw.startsWith("010-");
}

/** resident_registration_number_like/mobile_phone_like는 실제 개인정보 위험이라 override 대상이 될 수 없다. */
export function isRealPersonalInfoRisk(type: PersonalInfoSuspectType): boolean {
  return type === "resident_registration_number_like" || type === "mobile_phone_like";
}

/**
 * 전화번호형: 첫 자리 그룹(지역번호/010 등)은 그대로 남기고 나머지는 마스킹한다.
 * 예: 010-1234-5678 → 010-****-****, 064-710-4252 → 064-***-****
 */
function maskPhoneLike(raw: string): string {
  const parts = raw.split("-");
  return parts.map((part, index) => (index === 0 ? part : "*".repeat(part.length))).join("-");
}

/** 주민등록번호형: 모든 자리를 마스킹한다. 예: 123456-1234567 → ******-******* */
function maskResidentNumber(raw: string): string {
  return raw
    .split("-")
    .map((part) => "*".repeat(part.length))
    .join("-");
}

function maskByType(raw: string, type: PersonalInfoSuspectType): string {
  return type === "resident_registration_number_like" ? maskResidentNumber(raw) : maskPhoneLike(raw);
}

/** 매칭된 문맥 일부를 만들되, 그 안의 원문 매칭 문자열도 마스킹해서 절대 원문이 남지 않게 한다. */
function buildMaskedContext(text: string, matchIndex: number, matchLength: number, maskedValue: string): string {
  const start = Math.max(0, matchIndex - CONTEXT_WINDOW);
  const end = Math.min(text.length, matchIndex + matchLength + CONTEXT_WINDOW);
  const before = text.slice(start, matchIndex);
  const after = text.slice(matchIndex + matchLength, end);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${before}${maskedValue}${after}${suffix}`;
}

function scanFieldForSuspects(text: string, location: PersonalInfoSuspectLocation): PersonalInfoSuspectItem[] {
  if (!text) return [];
  const items: PersonalInfoSuspectItem[] = [];
  const claimedRanges: Array<[number, number]> = [];

  for (const match of text.matchAll(RESIDENT_NUMBER_PATTERN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    claimedRanges.push([index, index + raw.length]);
    const maskedValue = maskByType(raw, "resident_registration_number_like");
    items.push({
      type: "resident_registration_number_like",
      location,
      maskedValue,
      context: buildMaskedContext(text, index, raw.length, maskedValue),
    });
  }

  for (const match of text.matchAll(PHONE_LIKE_PATTERN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    // 주민등록번호로 이미 잡힌 자리와 겹치면 중복으로 세지 않는다.
    if (claimedRanges.some(([s, e]) => index < e && index + raw.length > s)) continue;
    const type: PersonalInfoSuspectType = isMobilePhoneLike(raw) ? "mobile_phone_like" : "phone_like_pattern";
    const maskedValue = maskByType(raw, type);
    items.push({
      type,
      location,
      maskedValue,
      context: buildMaskedContext(text, index, raw.length, maskedValue),
    });
  }

  return items;
}

function readMetadataString(platformMetadata: Record<string, unknown>, key: string): string {
  const value = platformMetadata[key];
  return typeof value === "string" ? value : "";
}

/**
 * wordpress_blog social_post의 post_title/post_body/platformMetadata.seoTitle/
 * platformMetadata.metaDescription에서 개인정보 의심 항목을 찾는다.
 * FAQ 등 본문 내 하위 섹션은 post_body 위치에 포함된다(본문 전체를 한 번에
 * 스캔하므로 별도 세분화하지 않는다).
 */
export function findWordPressBlogPersonalInfoSuspects(post: SocialPost): PersonalInfoSuspectItem[] {
  const platformMetadata = post.platformMetadata ?? {};
  return [
    ...scanFieldForSuspects(post.postTitle ?? "", "post_title"),
    ...scanFieldForSuspects(post.postBody ?? "", "post_body"),
    ...scanFieldForSuspects(readMetadataString(platformMetadata, "seoTitle"), "seo_title"),
    ...scanFieldForSuspects(readMetadataString(platformMetadata, "metaDescription"), "meta_description"),
  ];
}

/** false positive 확인 대상이 될 수 있는(실제 위험이 아닌) 항목만 남긴다. */
function nonRiskItems(items: PersonalInfoSuspectItem[]): PersonalInfoSuspectItem[] {
  return items.filter((item) => !isRealPersonalInfoRisk(item.type));
}

/** 항목 목록으로부터 안정적인 지문(fingerprint)을 만든다 — 원문을 포함하지 않는다. */
function buildSuspectFingerprint(items: PersonalInfoSuspectItem[]): string {
  const normalized = items
    .map((item) => `${item.type}:${item.location}:${item.maskedValue}`)
    .sort()
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export function getManualSafetyReview(post: SocialPost): ManualSafetyReviewRecord | null {
  const raw = (post.platformMetadata ?? {}).manualSafetyReview;
  if (!raw || typeof raw !== "object") return null;
  return raw as ManualSafetyReviewRecord;
}

export interface PersonalInfoOverrideEligibility {
  eligible: boolean;
  /** eligible=false일 때 사용자에게 보여줄 구체적인 사유 목록. */
  reasons: string[];
  suspects: PersonalInfoSuspectItem[];
}

/**
 * "SEO Metadata 반영"을 override(예외 허용)해도 되는지 판단한다. 아래
 * 조건을 모두 만족해야 eligible=true다:
 * - approval_status가 approved (override는 승인 여부까지 대신하지 않는다)
 * - readiness.blockers 중 "개인정보(주민등록번호/전화번호 형식) 의심"
 *   이외의 다른 차단 사유가 없다(광고 클릭 유도/공포 조장/품질 미달 등이
 *   남아 있으면 override 불가)
 * - 현재 본문을 다시 스캔한 결과, 실제 위험(주민등록번호/010 휴대전화)
 *   항목이 하나도 없다
 * - manualSafetyReview.prohibitedExpressionOverride가
 *   status="confirmed_false_positive"이고, 그 확인 당시의 지문이 현재
 *   감지 결과와 일치한다(본문이 그 사이 바뀌었으면 재확인 필요)
 */
export function checkWordPressBlogPersonalInfoOverrideEligibility(
  post: SocialPost,
  readiness: Pick<WordPressBlogPublishReadiness, "blockers">
): PersonalInfoOverrideEligibility {
  const suspects = findWordPressBlogPersonalInfoSuspects(post);
  const reasons: string[] = [];

  const otherBlockers = readiness.blockers.filter((b) => !b.includes("개인정보"));
  if (otherBlockers.length > 0) {
    reasons.push("개인정보 의심 이외의 다른 차단 사유가 남아 있습니다: " + otherBlockers.join(" / "));
  }

  if (post.approvalStatus !== "approved") {
    reasons.push(`approval_status가 approved가 아닙니다 (현재: ${post.approvalStatus}).`);
  }

  const realRiskItems = suspects.filter((item) => isRealPersonalInfoRisk(item.type));
  if (realRiskItems.length > 0) {
    reasons.push("실제 개인정보(주민등록번호 또는 휴대전화 번호)로 보이는 항목이 남아 있어 예외 처리할 수 없습니다.");
  }

  const review = getManualSafetyReview(post);
  const override = review?.prohibitedExpressionOverride;
  if (!override || override.status !== "confirmed_false_positive") {
    reasons.push("개인정보 의심 항목에 대한 '개인정보 아님' 확인 기록이 없습니다.");
  } else {
    const currentFingerprint = buildSuspectFingerprint(nonRiskItems(suspects));
    if (currentFingerprint !== override.contentFingerprint) {
      reasons.push("확인 이후 본문/메타데이터가 변경되어 다시 확인이 필요합니다.");
    }
  }

  return { eligible: reasons.length === 0, reasons, suspects };
}

export interface ConfirmPersonalInfoFalsePositiveInput {
  reason: string;
  confirmedBy: string;
}

export interface ConfirmPersonalInfoFalsePositiveResult {
  success: boolean;
  message: string;
}

/**
 * 개인정보 의심 항목을 "false positive(개인정보 아님)"로 확인 처리한다.
 * 실제 위험(주민등록번호/010 휴대전화)으로 보이는 항목이 하나라도 남아
 * 있으면 절대 확인 처리하지 않는다 — 그 경우 사용자는 먼저 본문을
 * 수정해야 한다.
 */
export async function confirmWordPressBlogPersonalInfoFalsePositive(
  socialPostId: string,
  input: ConfirmPersonalInfoFalsePositiveInput
): Promise<ConfirmPersonalInfoFalsePositiveResult> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}` };
  }
  if (post.platform !== "wordpress_blog") {
    return { success: false, message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).` };
  }

  const reason = input.reason?.trim() ?? "";
  if (!reason) {
    return { success: false, message: "확인 사유를 입력해야 합니다." };
  }

  const suspects = findWordPressBlogPersonalInfoSuspects(post);
  if (suspects.length === 0) {
    return { success: false, message: "확인할 개인정보 의심 항목이 없습니다." };
  }

  const realRiskItems = suspects.filter((item) => isRealPersonalInfoRisk(item.type));
  if (realRiskItems.length > 0) {
    return {
      success: false,
      message:
        "실제 주민등록번호 또는 휴대전화 번호(010)로 보이는 항목이 있어 '개인정보 아님'으로 확인할 수 없습니다. " +
        "본문을 먼저 수정한 뒤 다시 시도하세요.",
    };
  }

  const eligibleItems = nonRiskItems(suspects);
  const confirmedAt = new Date().toISOString();
  const confirmedBy = input.confirmedBy?.trim() || "user";

  const override: ProhibitedExpressionOverride = {
    status: "confirmed_false_positive",
    reason,
    confirmedAt,
    confirmedBy,
    items: eligibleItems.map((item) => ({ type: item.type, location: item.location, maskedValue: item.maskedValue })),
    contentFingerprint: buildSuspectFingerprint(eligibleItems),
  };

  const existingMetadata = post.platformMetadata ?? {};
  await updateSocialPostContent(socialPostId, {
    platformMetadata: {
      ...existingMetadata,
      manualSafetyReview: {
        ...(existingMetadata.manualSafetyReview as Record<string, unknown> | undefined),
        prohibitedExpressionOverride: override,
      },
    },
  });

  // 실제 개인정보 원문은 절대 로그에 남기지 않는다 — maskedValue/location만 남긴다.
  await logEvent({
    type: "wordpress_blog_personal_info_false_positive_confirmed",
    status: "success",
    message: `wordpress_blog 글(${socialPostId})의 개인정보 의심 항목 ${eligibleItems.length}건을 false positive로 확인했습니다.`,
    articleId: post.articleId,
    targetType: "article",
    targetId: post.articleId,
    details: {
      socialPostId,
      reason,
      confirmedBy,
      items: override.items,
    },
  });

  return { success: true, message: `개인정보 의심 항목 ${eligibleItems.length}건을 확인했습니다.` };
}

/**
 * 사용자가 "차단 사유 상세 보기"/"의심 위치 확인"을 열었다는 사실을
 * 감사 로그로 남긴다. 데이터는 변경하지 않는다(read-only) — 현재 감지된
 * 의심 항목만 함께 반환한다.
 */
export async function openWordPressBlogSafetyReview(
  socialPostId: string
): Promise<{ success: boolean; message: string; suspects: PersonalInfoSuspectItem[] }> {
  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return { success: false, message: `블로그 글을 찾을 수 없습니다: ${socialPostId}`, suspects: [] };
  }
  if (post.platform !== "wordpress_blog") {
    return {
      success: false,
      message: `이 기능은 wordpress_blog 글에서만 사용할 수 있습니다 (현재 platform: ${post.platform}).`,
      suspects: [],
    };
  }

  const suspects = findWordPressBlogPersonalInfoSuspects(post);

  await logEvent({
    type: "wordpress_blog_safety_review_opened",
    status: "info",
    message: `wordpress_blog 글(${socialPostId})의 차단 사유 상세를 확인했습니다.`,
    articleId: post.articleId,
    targetType: "article",
    targetId: post.articleId,
    details: { socialPostId, suspectCount: suspects.length },
  });

  return { success: true, message: "차단 사유 상세를 확인했습니다.", suspects };
}
