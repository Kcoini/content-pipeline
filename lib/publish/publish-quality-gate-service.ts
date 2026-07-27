// Phase 2-15: Publish Quality Gate.
// WordPress 공개 게시 전에 반드시 통과해야 하는 품질검사 게이트다.
// article/WordPress draft/SEO metadata/featured image/source citation/AD_SLOT marker/
// content safety/logging safety를 종합 점검하며, 이 단계에서는 실제 공개 publish를
// 어떤 경우에도 수행하지 않는다 (검증 전용).

import { getArticleById, savePublishQualityGateResult } from "@/lib/repositories/article-repository";
import { savePublishLog, getSuccessfulWordPressDraft } from "@/lib/repositories/publish-repository";
import { logEvent } from "@/lib/harness/logger";
import type { LogEventType, LogStatus } from "@/lib/harness/logger";
import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";
import type { Article } from "@/lib/types/domain";

export const PUBLISH_QUALITY_GATE_TARGET = "publish_quality_gate";

const MIN_CITED_SOURCES = 1;

const MIN_WORD_COUNT_BY_MODE: Record<Article["articleMode"], number> = {
  monetized_blog: 600,
  source_based_explainer: 500,
  general_news: 400,
};

export type ChecklistItemStatus = "pass" | "warning" | "fail" | "blocked";
export type ChecklistItemSeverity = "low" | "medium" | "high" | "critical";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistItemStatus;
  message: string;
  severity: ChecklistItemSeverity;
}

export type PublishQualityGateOverallStatus =
  | "ready_to_publish"
  | "needs_revision"
  | "blocked"
  | "failed";

export interface RunPublishQualityGateResult {
  success: boolean;
  message: string;
  status: PublishQualityGateOverallStatus | "failed";
  score?: number;
  publishReady?: boolean;
  checklist?: ChecklistItem[];
  blockedReason?: string;
}

const BANNED_MONETIZATION_PHRASES = ["광고 클릭", "수익 보장", "무조건 돈 버는", "클릭하면 돈", "지금 클릭"];

const BANNED_SAFETY_PHRASES = [
  "무조건 완치",
  "100% 효과",
  "부작용 없음",
  "원금 보장",
  "확정 수익",
];

const SECRET_EXPOSURE_PATTERNS = [
  /authorization\s*:\s*basic/i,
  /application[_ ]?password/i,
  /api[_ -]?key\s*[:=]/i,
  /bearer\s+[a-z0-9._-]{10,}/i,
];

function item(
  key: string,
  label: string,
  status: ChecklistItemStatus,
  message: string,
  severity: ChecklistItemSeverity
): ChecklistItem {
  return { key, label, status, message, severity };
}

async function logGateEvent(
  type: LogEventType,
  status: LogStatus,
  message: string,
  articleId: string,
  article: Article,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    themeId: article.themeId,
    targetType: "article",
    targetId: articleId,
    ...(details ? { details } : {}),
  });
}

// A. 기본 항목 -----------------------------------------------------------

function checkTitlePresent(article: Article): ChecklistItem {
  if (article.title.trim().length > 0) {
    return item("title_present", "제목 존재", "pass", "제목이 존재합니다.", "critical");
  }
  return item("title_present", "제목 존재", "blocked", "제목이 비어 있습니다.", "critical");
}

function checkContentPresent(article: Article): ChecklistItem {
  if (article.content.trim().length > 0) {
    return item("content_present", "본문 존재", "pass", "본문이 존재합니다.", "critical");
  }
  return item("content_present", "본문 존재", "blocked", "본문이 비어 있습니다.", "critical");
}

function checkStatusReviewed(article: Article): ChecklistItem {
  if (article.status === "reviewed" || article.status === "published") {
    return item("status_reviewed", "승인 상태", "pass", `article.status=${article.status}.`, "critical");
  }
  return item(
    "status_reviewed",
    "승인 상태",
    "blocked",
    `article.status=${article.status} (reviewed 또는 published가 아닙니다).`,
    "critical"
  );
}

function checkContentLength(article: Article): ChecklistItem {
  const contentLengthChars = article.content.trim().length;
  const paragraphCount = article.content.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
  const headingCount = (article.content.match(/^#{1,6}\s/gm) ?? []).length;
  const approxWordCount = article.content.trim().split(/\s+/).filter(Boolean).length;
  const minWords = MIN_WORD_COUNT_BY_MODE[article.articleMode];
  const detail = `chars=${contentLengthChars}, words≈${approxWordCount}, paragraphs=${paragraphCount}, headings=${headingCount}`;

  if (approxWordCount >= minWords) {
    return item("content_length", "본문 분량", "pass", `분량이 충분합니다 (${detail}).`, "medium");
  }
  return item(
    "content_length",
    "본문 분량",
    "warning",
    `분량이 ${article.articleMode} 모드 권장 최소(${minWords} 단어)보다 적습니다 (${detail}).`,
    "medium"
  );
}

// B. WordPress draft 항목 -------------------------------------------------

function checkWordPressStatusDraft(): ChecklistItem {
  return item(
    "wordpress_status_draft",
    "WordPress post 상태",
    "pass",
    "이 파이프라인은 draft 상태만 생성하며 실제 공개(publish)를 수행하지 않습니다.",
    "critical"
  );
}

function checkFinalDraftReview(article: Article): ChecklistItem {
  if (article.wordpressFinalDraftReviewStatus === "failed") {
    return item(
      "final_draft_review",
      "Final Draft Review",
      "blocked",
      "Final Draft Payload Review가 실패 상태입니다.",
      "high"
    );
  }
  if (
    article.wordpressFinalDraftReviewStatus === "not_reviewed" ||
    article.wordpressFinalDraftReviewStatus === "missing_wordpress_draft"
  ) {
    return item(
      "final_draft_review",
      "Final Draft Review",
      "warning",
      "Final Draft Payload Review가 아직 실행되지 않았습니다.",
      "medium"
    );
  }
  const summary = article.wordpressFinalDraftReviewSummary as { failedItems?: unknown[] } | null;
  const failedItems = Array.isArray(summary?.failedItems) ? summary!.failedItems! : [];
  if (failedItems.length > 0) {
    return item(
      "final_draft_review",
      "Final Draft Review",
      "warning",
      `Final Draft Payload Review에 실패 항목이 ${failedItems.length}개 있습니다.`,
      "medium"
    );
  }
  return item("final_draft_review", "Final Draft Review", "pass", "Final Draft Payload Review를 통과했습니다.", "medium");
}

// C. SEO 항목 --------------------------------------------------------------

function checkSeoTitle(article: Article): ChecklistItem {
  if (article.seoTitle && article.seoTitle.trim().length > 0) {
    return item("seo_title_present", "SEO title", "pass", "SEO title이 존재합니다.", "high");
  }
  const severity: ChecklistItemSeverity = article.articleMode === "monetized_blog" ? "critical" : "high";
  return item(
    "seo_title_present",
    "SEO title",
    article.articleMode === "monetized_blog" ? "blocked" : "fail",
    "SEO title이 비어 있습니다.",
    severity
  );
}

function checkMetaDescription(article: Article): ChecklistItem {
  if (article.metaDescription && article.metaDescription.trim().length > 0) {
    return item("meta_description_present", "Meta description", "pass", "Meta description이 존재합니다.", "high");
  }
  const severity: ChecklistItemSeverity = article.articleMode === "monetized_blog" ? "critical" : "high";
  return item(
    "meta_description_present",
    "Meta description",
    article.articleMode === "monetized_blog" ? "blocked" : "fail",
    "Meta description이 비어 있습니다.",
    severity
  );
}

function checkSlug(article: Article): ChecklistItem {
  if (article.slug && article.slug.trim().length > 0) {
    return item("slug_present", "Slug", "pass", "Slug가 존재합니다.", "low");
  }
  return item("slug_present", "Slug", "warning", "Slug가 비어 있습니다.", "low");
}

function checkTargetKeyword(article: Article): ChecklistItem {
  if (article.targetKeyword && article.targetKeyword.trim().length > 0) {
    return item("target_keyword_present", "Target keyword", "pass", "target_keyword가 존재합니다.", "critical");
  }
  return item("target_keyword_present", "Target keyword", "blocked", "target_keyword가 비어 있습니다.", "critical");
}

function checkTargetKeywordInSeoTitle(article: Article): ChecklistItem {
  if (!article.targetKeyword) {
    return item("target_keyword_in_seo_title", "Target keyword in SEO title", "warning", "target_keyword가 없어 확인할 수 없습니다.", "medium");
  }
  if (article.seoTitle && article.seoTitle.includes(article.targetKeyword)) {
    return item("target_keyword_in_seo_title", "Target keyword in SEO title", "pass", "SEO title에 target_keyword가 포함되어 있습니다.", "medium");
  }
  return item(
    "target_keyword_in_seo_title",
    "Target keyword in SEO title",
    "warning",
    "SEO title에 target_keyword가 포함되어 있지 않습니다.",
    "medium"
  );
}

function checkTargetKeywordInMetaDescription(article: Article): ChecklistItem {
  if (!article.targetKeyword) {
    return item(
      "target_keyword_in_meta_description",
      "Target keyword in meta description",
      "warning",
      "target_keyword가 없어 확인할 수 없습니다.",
      "medium"
    );
  }
  if (article.metaDescription && article.metaDescription.includes(article.targetKeyword)) {
    return item(
      "target_keyword_in_meta_description",
      "Target keyword in meta description",
      "pass",
      "meta description에 target_keyword가 포함되어 있습니다.",
      "medium"
    );
  }
  return item(
    "target_keyword_in_meta_description",
    "Target keyword in meta description",
    "warning",
    "meta description에 target_keyword가 포함되어 있지 않습니다.",
    "medium"
  );
}

// D. Rank Math custom endpoint 항목 ----------------------------------------

function checkRankMathCustomEndpoint(article: Article): ChecklistItem {
  if (article.seoPluginProvider !== "rank_math") {
    return item(
      "seo_metadata_custom_endpoint",
      "Rank Math custom endpoint",
      "warning",
      "SEO plugin provider가 rank_math가 아니어서 확인 대상이 아닙니다.",
      "low"
    );
  }
  if (article.seoPluginCustomEndpointStatus === "success" && article.seoPluginCustomEndpointVerified) {
    return item(
      "seo_metadata_custom_endpoint",
      "Rank Math custom endpoint",
      "pass",
      "custom endpoint를 통한 SEO metadata 반영이 검증되었습니다.",
      "high"
    );
  }
  if (article.seoPluginCustomEndpointStatus === "success" && !article.seoPluginCustomEndpointVerified) {
    return item(
      "seo_metadata_custom_endpoint",
      "Rank Math custom endpoint",
      "warning",
      "custom endpoint write는 성공했지만 검증(verified)되지 않았습니다.",
      "medium"
    );
  }
  return item(
    "seo_metadata_custom_endpoint",
    "Rank Math custom endpoint",
    "fail",
    `custom endpoint 반영이 확인되지 않았습니다 (status=${article.seoPluginCustomEndpointStatus}).`,
    "high"
  );
}

function checkSeoMetadataActualWrite(article: Article): ChecklistItem {
  if (article.seoPluginProvider === "none") {
    return item("seo_metadata_actual_write", "SEO metadata 실제 반영", "warning", "SEO plugin provider가 none입니다.", "low");
  }
  const verified =
    (article.seoPluginActualWriteStatus === "success" && article.seoPluginActualWriteVerified) ||
    (article.seoPluginCustomEndpointStatus === "success" && article.seoPluginCustomEndpointVerified);
  if (verified) {
    return item("seo_metadata_actual_write", "SEO metadata 실제 반영", "pass", "SEO metadata 실제 반영이 검증되었습니다.", "high");
  }
  return item(
    "seo_metadata_actual_write",
    "SEO metadata 실제 반영",
    "fail",
    "SEO metadata 실제 반영이 검증되지 않았습니다.",
    "high"
  );
}

// E. Category/Tag 항목 -------------------------------------------------------

function checkCategory(article: Article): ChecklistItem {
  const hasCategory = article.wpCategoryIds.length > 0 || article.wpCategoryNames.length > 0;
  if (hasCategory) {
    return item("category_present", "Category", "pass", "category가 준비되어 있습니다.", "high");
  }
  return item("category_present", "Category", "fail", "category가 없습니다.", "high");
}

function checkTag(article: Article): ChecklistItem {
  const hasTag = article.wpTagIds.length > 0 || article.wpTagNames.length > 0;
  if (hasTag) {
    return item("tag_present", "Tag", "pass", "tag가 준비되어 있습니다.", "medium");
  }
  const status: ChecklistItemStatus = article.articleMode === "monetized_blog" ? "fail" : "warning";
  return item("tag_present", "Tag", status, "tag가 없습니다.", article.articleMode === "monetized_blog" ? "high" : "medium");
}

// F. Featured Image 항목 -----------------------------------------------------

function checkFeaturedImagePresent(article: Article): ChecklistItem {
  const hasMediaId = Boolean(article.featuredImageWordpressMediaId);
  const attached = article.wordpressFeaturedMediaAttachStatus === "attached";

  if (hasMediaId || attached) {
    return item(
      "featured_image_present",
      "Featured image 존재",
      "pass",
      "featured image가 WordPress에 준비(업로드/연결)되어 있습니다.",
      "medium"
    );
  }

  // Featured Image Workflow: source는 준비되었지만 아직 WordPress에
  // 업로드/연결되지 않은 상태 — "완전히 없음"과 구분해 warning으로 처리한다.
  const sourcePrepared =
    article.featuredImageSourceStatus === "prepared" || article.featuredImageUploadStatus === "prepared";
  if (sourcePrepared) {
    return item(
      "featured_image_present",
      "Featured image 존재",
      "warning",
      "이미지 source는 준비되었지만 아직 WordPress에 업로드/연결되지 않았습니다.",
      "medium"
    );
  }

  const noSource = article.featuredImageSourceStatus === "none" && !hasMediaId;
  const uploadFailedOrSkipped =
    (article.featuredImageUploadStatus === "skipped" || article.featuredImageUploadStatus === "failed") &&
    !hasMediaId;

  if (article.articleMode === "monetized_blog" && (noSource || uploadFailedOrSkipped)) {
    return item(
      "featured_image_present",
      "Featured image 존재",
      "fail",
      "monetized_blog에 featured image가 준비되지 않았습니다.",
      "high"
    );
  }

  return item("featured_image_present", "Featured image 존재", "warning", "featured image가 아직 준비되지 않았습니다.", "low");
}

function checkFeaturedMediaAttached(article: Article): ChecklistItem {
  if (article.wordpressFeaturedMediaAttachStatus === "attached") {
    return item("featured_media_attached", "Featured media 연결", "pass", "featured media가 draft post에 연결되었습니다.", "medium");
  }
  if (!article.featuredImageWordpressMediaId) {
    return item("featured_media_attached", "Featured media 연결", "warning", "연결할 featured media가 없습니다.", "low");
  }
  return item(
    "featured_media_attached",
    "Featured media 연결",
    "warning",
    `featured media 연결이 확인되지 않았습니다 (status=${article.wordpressFeaturedMediaAttachStatus}).`,
    "medium"
  );
}

// G. Source/Citation 항목 -----------------------------------------------------

function checkSourceExists(article: Article): ChecklistItem {
  if (article.citedSourceIds.length >= MIN_CITED_SOURCES) {
    return item("source_citation_exists", "출처 존재", "pass", `인용된 출처 ${article.citedSourceIds.length}개.`, "critical");
  }
  return item("source_citation_exists", "출처 존재", "blocked", "인용된 출처가 없습니다.", "critical");
}

function checkSourceReferenceInContent(article: Article): ChecklistItem {
  const hasMarker = /\[출처|\(출처|참고 자료|reference/i.test(article.content);
  if (hasMarker) {
    return item("source_reference_in_content", "본문 내 출처 표시", "pass", "본문에 출처 표기가 있습니다.", "medium");
  }
  return item("source_reference_in_content", "본문 내 출처 표시", "warning", "본문에서 출처 표기를 찾지 못했습니다.", "medium");
}

// H. AD_SLOT / 수익화 항목 -----------------------------------------------------

function checkAdSlotMarkerExists(article: Article): ChecklistItem {
  if (article.articleMode !== "monetized_blog") {
    return item("ad_slot_marker_present", "AD_SLOT marker 존재", "warning", "monetized_blog 모드가 아니어서 확인 대상이 아닙니다.", "low");
  }
  const present = AD_SLOT_MARKERS.filter((position) => article.content.includes(adSlotMarkerComment(position)));
  if (present.length === 0) {
    return item("ad_slot_marker_present", "AD_SLOT marker 존재", "warning", "AD_SLOT marker가 본문에 없습니다.", "medium");
  }
  if (present.length < AD_SLOT_MARKERS.length) {
    return item(
      "ad_slot_marker_present",
      "AD_SLOT marker 존재",
      "warning",
      `일부 AD_SLOT marker만 존재합니다 (${present.length}/${AD_SLOT_MARKERS.length}).`,
      "low"
    );
  }
  return item("ad_slot_marker_present", "AD_SLOT marker 존재", "pass", "모든 AD_SLOT marker가 본문에 존재합니다.", "medium");
}

function checkAdSlotMarkerNotExcessive(article: Article): ChecklistItem {
  if (article.articleMode !== "monetized_blog") {
    return item("ad_slot_marker_not_excessive", "AD_SLOT marker 과다 여부", "warning", "monetized_blog 모드가 아니어서 확인 대상이 아닙니다.", "low");
  }
  const totalMarkerCount = AD_SLOT_MARKERS.reduce(
    (count, position) => count + article.content.split(adSlotMarkerComment(position)).length - 1,
    0
  );
  if (totalMarkerCount > AD_SLOT_MARKERS.length) {
    return item(
      "ad_slot_marker_not_excessive",
      "AD_SLOT marker 과다 여부",
      "warning",
      `AD_SLOT marker가 중복 삽입된 것으로 보입니다 (총 ${totalMarkerCount}개).`,
      "low"
    );
  }
  return item("ad_slot_marker_not_excessive", "AD_SLOT marker 과다 여부", "pass", "AD_SLOT marker 개수가 정상 범위입니다.", "low");
}

function checkMonetizationBannedPhrases(article: Article): ChecklistItem {
  if (article.articleMode !== "monetized_blog") {
    return item(
      "monetization_banned_phrases",
      "수익화 금지 문구",
      "warning",
      "monetized_blog 모드가 아니어서 확인 대상이 아닙니다.",
      "low"
    );
  }
  const found = BANNED_MONETIZATION_PHRASES.filter((phrase) => article.content.includes(phrase));
  if (found.length > 0) {
    return item(
      "monetization_banned_phrases",
      "수익화 금지 문구",
      "blocked",
      `광고 클릭 유도/수익 보장성 문구가 발견되었습니다: ${found.join(", ")}.`,
      "critical"
    );
  }
  return item("monetization_banned_phrases", "수익화 금지 문구", "pass", "광고 클릭 유도 문구가 발견되지 않았습니다.", "medium");
}

// I. Safety/Compliance 항목 -----------------------------------------------------

function checkSafetyBannedPhrases(article: Article): ChecklistItem {
  const found = BANNED_SAFETY_PHRASES.filter((phrase) => article.content.includes(phrase));
  if (found.length > 0) {
    return item(
      "content_safety_banned_phrases",
      "콘텐츠 안전성(금지 문구)",
      "fail",
      `근거 없는 단정/보장성 표현이 발견되었습니다: ${found.join(", ")}.`,
      "high"
    );
  }
  return item("content_safety_banned_phrases", "콘텐츠 안전성(금지 문구)", "pass", "금지 문구가 발견되지 않았습니다.", "medium");
}

function checkSecretExposure(article: Article): ChecklistItem {
  const haystack = `${article.title}\n${article.content}`;
  const exposed = SECRET_EXPOSURE_PATTERNS.some((pattern) => pattern.test(haystack));
  if (exposed) {
    return item(
      "content_safety_secret_exposure",
      "인증정보 노출 여부",
      "blocked",
      "본문에서 인증정보(auth/password/API key 등)로 의심되는 문자열이 발견되었습니다.",
      "critical"
    );
  }
  return item("content_safety_secret_exposure", "인증정보 노출 여부", "pass", "인증정보 노출이 발견되지 않았습니다.", "critical");
}

function checkPiiExposure(article: Article): ChecklistItem {
  const pattern = /\d{6}-\d{7}|\d{3}-\d{3,4}-\d{4}/;
  if (pattern.test(article.content)) {
    return item(
      "content_safety_pii",
      "개인정보(PII) 노출 여부",
      "fail",
      "본문에서 주민등록번호/전화번호 형식의 문자열이 발견되었습니다.",
      "high"
    );
  }
  return item("content_safety_pii", "개인정보(PII) 노출 여부", "pass", "PII 패턴이 발견되지 않았습니다.", "high");
}

function checkCopyrightRisk(article: Article): ChecklistItem {
  const paragraphs = article.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const veryLongUnbrokenParagraph = paragraphs.some((p) => p.length > 1200 && !/[.!?]\s/.test(p));
  if (veryLongUnbrokenParagraph) {
    return item(
      "content_safety_copyright_risk",
      "저작권 위험도",
      "warning",
      "문장 구분이 거의 없는 매우 긴 단락이 발견되어 출처 원문 그대로 복사되었을 가능성이 있습니다.",
      "medium"
    );
  }
  return item("content_safety_copyright_risk", "저작권 위험도", "pass", "명백한 저작권 위험 신호가 발견되지 않았습니다.", "medium");
}

// J. Logging safety 항목 -----------------------------------------------------

function checkLoggingSafety(): ChecklistItem {
  return item(
    "logging_safety",
    "로깅 안전성",
    "pass",
    "publish_logs.details_json에는 본문 전체나 인증정보를 저장하지 않습니다.",
    "critical"
  );
}

function buildChecklist(article: Article, hasWordPressDraft: boolean): ChecklistItem[] {
  const items: ChecklistItem[] = [
    checkTitlePresent(article),
    checkContentPresent(article),
    checkStatusReviewed(article),
    checkContentLength(article),
    item(
      "wordpress_draft_exists",
      "WordPress draft post 존재",
      hasWordPressDraft ? "pass" : "blocked",
      hasWordPressDraft ? "WordPress draft post가 존재합니다." : "WordPress draft post가 존재하지 않습니다.",
      "critical"
    ),
    checkWordPressStatusDraft(),
    checkFinalDraftReview(article),
    checkSeoTitle(article),
    checkMetaDescription(article),
    checkSlug(article),
    checkTargetKeyword(article),
    checkTargetKeywordInSeoTitle(article),
    checkTargetKeywordInMetaDescription(article),
    checkRankMathCustomEndpoint(article),
    checkSeoMetadataActualWrite(article),
    checkCategory(article),
    checkTag(article),
    checkFeaturedImagePresent(article),
    checkFeaturedMediaAttached(article),
    checkSourceExists(article),
    checkSourceReferenceInContent(article),
    checkAdSlotMarkerExists(article),
    checkAdSlotMarkerNotExcessive(article),
    checkMonetizationBannedPhrases(article),
    checkSafetyBannedPhrases(article),
    checkSecretExposure(article),
    checkPiiExposure(article),
    checkCopyrightRisk(article),
    checkLoggingSafety(),
  ];
  return items;
}

function computeScore(checklist: ChecklistItem[]): number {
  const points: Record<ChecklistItemStatus, number> = { pass: 1, warning: 0.5, fail: 0, blocked: 0 };
  const total = checklist.reduce((sum, entry) => sum + points[entry.status], 0);
  return Math.round((total / checklist.length) * 100);
}

function determineOverallStatus(
  checklist: ChecklistItem[],
  score: number
): { status: PublishQualityGateOverallStatus; blockedReason?: string } {
  const criticalBlocked = checklist.filter((entry) => entry.status === "blocked" && entry.severity === "critical");
  if (criticalBlocked.length > 0) {
    return {
      status: "blocked",
      blockedReason: criticalBlocked.map((entry) => entry.message).join(" / "),
    };
  }

  const hasFail = checklist.some((entry) => entry.status === "fail");
  if (score >= 85 && !hasFail) {
    return { status: "ready_to_publish" };
  }
  return { status: "needs_revision" };
}

function toSafeSummary(
  checklist: ChecklistItem[],
  score: number,
  status: PublishQualityGateOverallStatus,
  publishReady: boolean
): Record<string, unknown> {
  const passCount = checklist.filter((entry) => entry.status === "pass").length;
  const warningCount = checklist.filter((entry) => entry.status === "warning").length;
  const failCount = checklist.filter((entry) => entry.status === "fail").length;
  const blockedCount = checklist.filter((entry) => entry.status === "blocked").length;

  return {
    checklist: checklist.map(({ key, label, status: itemStatus, message, severity }) => ({
      key,
      label,
      status: itemStatus,
      message,
      severity,
    })),
    score,
    qualityGateStatus: status,
    publishReady,
    passCount,
    warningCount,
    failCount,
    blockedCount,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * article의 Publish Quality Gate를 실행한다. 실제 공개(publish)는 어떤 경우에도
 * 수행하지 않으며, 이미 저장된 상태를 바탕으로 checklist를 점검하고 점수를 계산한다.
 */
export async function runPublishQualityGate(articleId: string): Promise<RunPublishQualityGateResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    return { success: false, message: `기사를 찾을 수 없습니다: ${articleId}`, status: "failed" };
  }

  try {
    await logGateEvent(
      "publish_quality_gate_started",
      "info",
      `기사(${articleId})의 Publish Quality Gate를 시작합니다.`,
      articleId,
      article
    );

    const existingDraft = await getSuccessfulWordPressDraft(articleId);
    const checklist = buildChecklist(article, Boolean(existingDraft));
    const score = computeScore(checklist);
    const { status, blockedReason } = determineOverallStatus(checklist, score);
    const publishReady = status === "ready_to_publish";

    const topWarnings = checklist.filter((entry) => entry.status === "warning").slice(0, 5).map((entry) => entry.message);
    const topFailures = checklist
      .filter((entry) => entry.status === "fail" || entry.status === "blocked")
      .slice(0, 5)
      .map((entry) => entry.message);

    const summary = toSafeSummary(checklist, score, status, publishReady);

    await savePublishQualityGateResult(articleId, {
      status,
      score,
      summary,
      errorMessage: null,
      publishReady,
      blockedReason: blockedReason ?? null,
    });

    const eventType: LogEventType =
      status === "blocked"
        ? "publish_quality_gate_blocked"
        : status === "needs_revision"
          ? "publish_quality_gate_needs_revision"
          : "publish_quality_gate_completed";

    await logGateEvent(
      eventType,
      status === "blocked" ? "failed" : "success",
      `기사(${articleId})의 Publish Quality Gate가 완료되었습니다 (status: ${status}, score: ${score}).`,
      articleId,
      article,
      { status, score, publishReady, topWarnings, topFailures }
    );

    const publishLogDetails = {
      actual: false,
      publishAction: false,
      qualityGateStatus: status,
      qualityGateScore: score,
      passCount: summary.passCount,
      warningCount: summary.warningCount,
      failCount: summary.failCount,
      blockedCount: summary.blockedCount,
      publishReady,
      topWarnings,
      topFailures,
      ...(status === "blocked" ? { blockedReasons: [blockedReason ?? "알 수 없는 blocked 사유"] } : {}),
    };

    await savePublishLog({
      articleId,
      target: PUBLISH_QUALITY_GATE_TARGET,
      status: status === "blocked" ? "failed" : "success",
      externalPostId: existingDraft?.externalPostId ?? null,
      postUrl: existingDraft?.postUrl ?? null,
      errorMessage: status === "blocked" ? (blockedReason ?? "Publish Quality Gate가 blocked 상태입니다.") : null,
      details: publishLogDetails,
    });

    return {
      success: true,
      message: `Publish Quality Gate 실행 완료 (status: ${status}, score: ${score}).`,
      status,
      score,
      publishReady,
      checklist,
      blockedReason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    try {
      await savePublishQualityGateResult(articleId, {
        status: "failed",
        errorMessage: message,
        publishReady: false,
      });
    } catch {
      // 결과 저장 실패는 무시하고 원래 오류를 그대로 알린다.
    }

    await logGateEvent(
      "publish_quality_gate_failed",
      "failed",
      `Publish Quality Gate 실행 실패: ${message}`,
      articleId,
      article
    );

    await savePublishLog({
      articleId,
      target: PUBLISH_QUALITY_GATE_TARGET,
      status: "failed",
      errorMessage: message,
      details: { actual: false, publishAction: false },
    });

    return { success: false, message, status: "failed" };
  }
}
