import Link from "next/link";
import { getArticleById } from "@/lib/repositories/article-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";
import { getLogsByArticleId } from "@/lib/harness/logger";
import { getPublishLogsByArticleId } from "@/lib/repositories/publish-repository";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { SOCIAL_PLATFORMS, TONE_STYLES } from "@/lib/social/social-platform-types";
import { isSocialAiGenerationEnabled } from "@/lib/social/social-ai-generation-config";
import type { ArticleStatus } from "@/lib/types/domain";
import {
  approveArticleAction,
  updateArticleAction,
  publishToWordPressDraftAction,
  generateWordPressMetadataAction,
  reviewWordPressMetadataAction,
  generateSeoPluginMetadataAction,
  reviewSeoPluginMetadataAction,
  prepareFeaturedImageAction,
  reviewFeaturedImageAction,
  prepareWordPressMediaUploadAction,
  confirmWordPressMediaUploadDryRunAction,
  uploadFeaturedImageToWordPressAction,
  checkWordPressMediaUploadStatusAction,
  attachFeaturedMediaToDraftAction,
  checkWordPressFeaturedMediaAttachStatusAction,
  writeSeoPluginMetadataToWordPressAction,
  checkSeoPluginActualWriteStatusAction,
  writeRankMathSeoViaCustomEndpointAction,
  reviewWordPressFinalDraftAction,
  checkWordPressFinalDraftReviewStatusAction,
  generateFeaturedImageAction,
  reviewGeneratedImageAction,
  testWordPressConnectionAction,
  runPublishQualityGateAction,
  checkPublishQualityGateStatusAction,
  approvePublicPublishAction,
  revokePublicPublishApprovalAction,
  checkPublicPublishApprovalStatusAction,
  publishApprovedArticleToWordPressAction,
  checkPublicPublishStatusAction,
  saveExternalImageUrlSourceAction,
  saveLocalFeaturedImageAction,
  saveExistingWordPressMediaSourceAction,
  generatePlaceholderSocialPostAction,
  generateSocialDraftAction,
  refreshSocialPostsAction,
  runSocialPostQualityGateAction,
  approveSocialPostAction,
  rejectSocialPostAction,
  editSocialPostAction,
  requestSocialPostApprovalAction,
  revokeSocialPostApprovalAction,
  generateManualExportAction,
  recordSocialPostCopiedAction,
  runPlatformPublishingGuardAction,
  createPlatformPublishDryRunAction,
  completePlatformExportHandoffAction,
  prepareManualPostingRecordAction,
  recordManualPostingResultAction,
  markManualPostingFailedAction,
  markManualPostingSkippedAction,
  recordSocialPostMetricsAction,
  refreshSocialPostMetricsAction,
  generatePerformanceRewriteSuggestionAction,
  approveRewriteSuggestionAction,
  rejectRewriteSuggestionAction,
  applyRewriteSuggestionAction,
  recheckRewriteVersionQualityAction,
  compareRewriteVersionAction,
  requestRewriteReapprovalAction,
  approveRewriteReapprovalAction,
  rejectRewriteReapprovalAction,
  revokeRewriteReapprovalAction,
  prepareRewriteReexportAction,
  generateRewriteReexportPayloadAction,
  refreshRewriteRepublishWorkflowStatusAction,
  compareRewritePerformanceAction,
} from "./actions";
import { formatPlatformPublishDryRunPreview } from "@/lib/social/platform-publish-dry-run-preview-formatters";
import { listMetricsBySocialPost } from "@/lib/repositories/social-metrics-repository";
import { buildArticleSocialPerformanceSummary } from "@/lib/social/article-social-performance-summary";
import { listRewriteSuggestionsBySocialPost } from "@/lib/repositories/social-rewrite-suggestions-repository";
import { buildRewriteApplicationPreview } from "@/lib/social/rewrite-application-preview-builder";
import { listRewriteVersionsByRoot } from "@/lib/repositories/social-posts-repository";
import { buildRewriteVersionComparisonPreview } from "@/lib/social/rewrite-version-comparison-preview-builder";
import { getVersionComparisonById } from "@/lib/repositories/social-version-comparisons-repository";
import { buildRewritePerformanceComparisonPreview } from "@/lib/social/rewrite-performance-comparison-preview-builder";
import { getRewritePerformanceComparisonById } from "@/lib/repositories/social-rewrite-performance-comparisons-repository";
import { buildArticleRewritePerformanceSummary } from "@/lib/social/article-rewrite-performance-summary";
import { formatSocialPostPreview } from "@/lib/social/social-post-preview-formatters";
import { buildManualExportPayload } from "@/lib/social/social-export-builder";
import { CopyToClipboardButton } from "./copy-to-clipboard-button";
import { ConfirmSubmitButton } from "./confirm-submit-button";
import type {
  WordPressMetadataStatus,
  SeoPluginMetadataStatus,
  SeoPluginWriteStatus,
  FeaturedImageStatus,
  WordPressMediaUploadStatus,
  GeneratedImageStatus,
  WordPressFeaturedMediaAttachStatus,
  SeoPluginActualWriteStatus,
  SeoPluginCustomEndpointStatus,
  WordPressFinalDraftReviewStatus,
  PublishQualityGateStatus,
  PublicPublishApprovalStatus,
  PublicPublishStatus,
  FeaturedImageSourceStatus,
} from "@/lib/types/domain";
import { ARTICLE_MODE_CONFIGS } from "@/lib/articles/article-modes";
import { WORDPRESS_TARGET, isWordPressPublishEnabled } from "@/lib/publish/publish-service";
import { isWordPressMediaUploadEnabled } from "@/lib/publish/wordpress-media-config";
import { isImageGenerationEnabled } from "@/lib/images/image-generation-config";
import { getSeoPluginProvider, isSeoPluginWriteEnabled } from "@/lib/seo/seo-plugin-config";
import { isSeoCustomEndpointEnabled, getSeoCustomEndpointPath } from "@/lib/seo/wordpress-seo-custom-endpoint-client";
import type { SeoPluginPayload } from "@/lib/seo/seo-plugin-types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "초안 (draft)",
  reviewed: "승인됨 (reviewed)",
  published: "게시됨 (published)",
};

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  published: "bg-blue-100 text-blue-700",
};

const WP_METADATA_STATUS_LABEL: Record<WordPressMetadataStatus, string> = {
  not_ready: "준비 안 됨",
  generated: "생성됨",
  reviewed: "검토 완료",
  failed: "생성 실패",
};

const WP_METADATA_STATUS_STYLE: Record<WordPressMetadataStatus, string> = {
  not_ready: "bg-zinc-100 text-zinc-500",
  generated: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const SEO_PLUGIN_PROVIDER_OPTIONS = [
  { value: "none", label: "없음 (none)" },
  { value: "yoast", label: "Yoast SEO" },
  { value: "rank_math", label: "Rank Math" },
  { value: "aioseo", label: "All in One SEO" },
] as const;

const SEO_PLUGIN_METADATA_STATUS_LABEL: Record<SeoPluginMetadataStatus, string> = {
  not_ready: "준비 안 됨",
  generated: "생성됨",
  reviewed: "검토 완료",
  failed: "생성 실패",
};

const SEO_PLUGIN_METADATA_STATUS_STYLE: Record<SeoPluginMetadataStatus, string> = {
  not_ready: "bg-zinc-100 text-zinc-500",
  generated: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const SEO_PLUGIN_WRITE_STATUS_LABEL: Record<SeoPluginWriteStatus, string> = {
  not_attempted: "시도 안 함",
  skipped_dry_run: "건너뜀 (dry-run)",
  skipped_provider_none: "건너뜀 (provider 없음)",
  success: "성공",
  failed: "실패",
};

const FEATURED_IMAGE_STATUS_LABEL: Record<FeaturedImageStatus, string> = {
  not_ready: "준비 안 됨",
  prepared: "준비됨",
  reviewed: "검토 완료",
  failed: "준비 실패",
  uploaded: "업로드됨",
};

const FEATURED_IMAGE_STATUS_STYLE: Record<FeaturedImageStatus, string> = {
  not_ready: "bg-zinc-100 text-zinc-500",
  prepared: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  uploaded: "bg-blue-100 text-blue-700",
};

const FEATURED_IMAGE_SOURCE_STATUS_LABEL: Record<FeaturedImageSourceStatus, string> = {
  none: "설정 안 됨",
  prepared: "준비됨",
  invalid: "유효하지 않음",
  failed: "저장 실패",
};

const FEATURED_IMAGE_SOURCE_STATUS_STYLE: Record<FeaturedImageSourceStatus, string> = {
  none: "bg-zinc-100 text-zinc-500",
  prepared: "bg-green-100 text-green-700",
  invalid: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const MEDIA_UPLOAD_STATUS_LABEL: Record<WordPressMediaUploadStatus, string> = {
  not_ready: "준비 안 됨",
  prepared: "준비됨",
  dry_run: "dry-run 확인됨",
  uploaded: "업로드됨",
  failed: "실패",
  skipped: "건너뜀 (비활성화)",
};

const MEDIA_UPLOAD_STATUS_STYLE: Record<WordPressMediaUploadStatus, string> = {
  not_ready: "bg-zinc-100 text-zinc-500",
  prepared: "bg-amber-100 text-amber-700",
  dry_run: "bg-blue-100 text-blue-700",
  uploaded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-zinc-100 text-zinc-500",
};

const FEATURED_MEDIA_ATTACH_STATUS_LABEL: Record<WordPressFeaturedMediaAttachStatus, string> = {
  not_attached: "연결 안 됨",
  attached: "연결됨",
  skipped_no_media_id: "건너뜀 (media id 없음)",
  failed: "연결 실패",
};

const FEATURED_MEDIA_ATTACH_STATUS_STYLE: Record<WordPressFeaturedMediaAttachStatus, string> = {
  not_attached: "bg-zinc-100 text-zinc-500",
  attached: "bg-green-100 text-green-700",
  skipped_no_media_id: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const SEO_PLUGIN_ACTUAL_WRITE_STATUS_LABEL: Record<SeoPluginActualWriteStatus, string> = {
  not_attempted: "시도 안 함",
  skipped_disabled: "건너뜀 (비활성화)",
  skipped_provider_none: "건너뜀 (provider 없음)",
  skipped_no_wordpress_post: "건너뜀 (draft 없음)",
  skipped_missing_target_keyword: "건너뜀 (focus keyword 없음)",
  success: "반영 확인됨",
  failed: "실패",
  needs_custom_endpoint: "custom endpoint 필요",
};

const SEO_PLUGIN_ACTUAL_WRITE_STATUS_STYLE: Record<SeoPluginActualWriteStatus, string> = {
  not_attempted: "bg-zinc-100 text-zinc-500",
  skipped_disabled: "bg-zinc-100 text-zinc-500",
  skipped_provider_none: "bg-zinc-100 text-zinc-500",
  skipped_no_wordpress_post: "bg-amber-100 text-amber-700",
  skipped_missing_target_keyword: "bg-amber-100 text-amber-700",
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  needs_custom_endpoint: "bg-amber-100 text-amber-700",
};

const SEO_PLUGIN_CUSTOM_ENDPOINT_STATUS_LABEL: Record<SeoPluginCustomEndpointStatus, string> = {
  not_attempted: "시도 안 함",
  skipped_disabled: "건너뜀 (비활성화)",
  skipped_provider_not_supported: "건너뜀 (rank_math 아님)",
  skipped_no_wordpress_post: "건너뜀 (draft 없음)",
  skipped_missing_target_keyword: "건너뜀 (focus keyword 없음)",
  success: "반영 확인됨",
  failed: "실패",
};

const SEO_PLUGIN_CUSTOM_ENDPOINT_STATUS_STYLE: Record<SeoPluginCustomEndpointStatus, string> = {
  not_attempted: "bg-zinc-100 text-zinc-500",
  skipped_disabled: "bg-zinc-100 text-zinc-500",
  skipped_provider_not_supported: "bg-zinc-100 text-zinc-500",
  skipped_no_wordpress_post: "bg-amber-100 text-amber-700",
  skipped_missing_target_keyword: "bg-amber-100 text-amber-700",
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const FINAL_DRAFT_REVIEW_STATUS_LABEL: Record<WordPressFinalDraftReviewStatus, string> = {
  not_reviewed: "검토 안 함",
  reviewed: "검토 완료",
  missing_wordpress_draft: "건너뜀 (draft 없음)",
  failed: "검토 실패",
};

const FINAL_DRAFT_REVIEW_STATUS_STYLE: Record<WordPressFinalDraftReviewStatus, string> = {
  not_reviewed: "bg-zinc-100 text-zinc-500",
  reviewed: "bg-green-100 text-green-700",
  missing_wordpress_draft: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const CHECKLIST_ITEM_STYLE: Record<string, string> = {
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
};

const PUBLISH_QUALITY_GATE_STATUS_LABEL: Record<PublishQualityGateStatus, string> = {
  not_checked: "검사 안 함",
  ready_to_publish: "공개 준비 완료",
  needs_revision: "수정 필요",
  blocked: "차단됨",
  failed: "검사 실패",
};

const PUBLISH_QUALITY_GATE_STATUS_STYLE: Record<PublishQualityGateStatus, string> = {
  not_checked: "bg-zinc-100 text-zinc-500",
  ready_to_publish: "bg-green-100 text-green-700",
  needs_revision: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const QUALITY_GATE_ITEM_STYLE: Record<string, string> = {
  pass: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  fail: "bg-orange-100 text-orange-700",
  blocked: "bg-red-100 text-red-700",
};

const PUBLIC_PUBLISH_APPROVAL_STATUS_LABEL: Record<PublicPublishApprovalStatus, string> = {
  not_requested: "승인 요청 안 함",
  approved: "승인 완료",
  revoked: "승인 취소됨",
  blocked: "승인 차단됨",
  failed: "승인 처리 실패",
};

const PUBLIC_PUBLISH_APPROVAL_STATUS_STYLE: Record<PublicPublishApprovalStatus, string> = {
  not_requested: "bg-zinc-100 text-zinc-500",
  approved: "bg-green-100 text-green-700",
  revoked: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const PUBLIC_PUBLISH_STATUS_LABEL: Record<PublicPublishStatus, string> = {
  not_published: "공개 게시 안 함",
  published: "공개 게시됨",
  blocked: "공개 게시 차단됨",
  failed: "공개 게시 실패",
  skipped_already_published: "이미 공개됨 (건너뜀)",
};

const PUBLIC_PUBLISH_STATUS_STYLE: Record<PublicPublishStatus, string> = {
  not_published: "bg-zinc-100 text-zinc-500",
  published: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  skipped_already_published: "bg-amber-100 text-amber-700",
};

const SOCIAL_QUALITY_STATUS_STYLE: Record<string, string> = {
  not_checked: "bg-zinc-100 text-zinc-500",
  ready: "bg-green-100 text-green-700",
  needs_revision: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const SOCIAL_APPROVAL_STATUS_STYLE: Record<string, string> = {
  not_requested: "bg-zinc-100 text-zinc-500",
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revoked: "bg-amber-100 text-amber-700",
};

const SOCIAL_PUBLISH_STATUS_STYLE: Record<string, string> = {
  not_published: "bg-zinc-100 text-zinc-500",
  dry_run: "bg-blue-100 text-blue-700",
  exported: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  blocked: "bg-red-100 text-red-700",
};

const GENERATED_IMAGE_STATUS_LABEL: Record<GeneratedImageStatus, string> = {
  not_generated: "생성 안 됨",
  queued: "대기중",
  generating: "생성중",
  generated: "생성됨",
  reviewed: "검토 완료",
  failed: "생성 실패",
};

const GENERATED_IMAGE_STATUS_STYLE: Record<GeneratedImageStatus, string> = {
  not_generated: "bg-zinc-100 text-zinc-500",
  queued: "bg-zinc-100 text-zinc-500",
  generating: "bg-blue-100 text-blue-700",
  generated: "bg-amber-100 text-amber-700",
  reviewed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; publishMessage?: string; socialPostId?: string }>;
}) {
  const { id } = await params;
  const { error, publishMessage, socialPostId: highlightedSocialPostId } = await searchParams;

  const article = await getArticleById(id);

  if (!article) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Link href="/articles" className="text-sm text-zinc-500 hover:underline">
            ← 기사 목록으로
          </Link>
          <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            기사를 찾을 수 없습니다 (id: {id}).
          </section>
        </div>
      </div>
    );
  }

  const [theme, sources, latestEval, logs, wordpressLogs, socialPosts, articlePerformanceSummary] = await Promise.all([
    getThemeById(article.themeId),
    getSourcesByArticleId(article.id),
    getLatestEvalByArticleId(article.id),
    getLogsByArticleId(article.id, 10),
    // target을 지정하지 않고 최신 N개만 보면 다른 target(quality gate/human
    // approval/public publish 등)의 로그에 밀려 오래된 wordpress 성공 기록을
    // 놓칠 수 있으므로, wordpress target은 항상 별도로 조회한다.
    getPublishLogsByArticleId(article.id, 5, WORDPRESS_TARGET),
    listSocialPostsByArticle(article.id),
    buildArticleSocialPerformanceSummary(article.id),
  ]);

  const socialPostMetricsHistories = await Promise.all(socialPosts.map((post) => listMetricsBySocialPost(post.id)));
  const socialPostMetricsHistoryById = new Map(socialPosts.map((post, i) => [post.id, socialPostMetricsHistories[i]]));

  const socialPostRewriteSuggestionLists = await Promise.all(socialPosts.map((post) => listRewriteSuggestionsBySocialPost(post.id)));
  const socialPostRewriteSuggestionsById = new Map(socialPosts.map((post, i) => [post.id, socialPostRewriteSuggestionLists[i]]));

  const allSuggestions = socialPostRewriteSuggestionLists.flat();
  const previewableSuggestions = allSuggestions.filter(
    (s) => s.applicationStatus !== "applied" && (s.suggestionStatus === "approved" || s.suggestionStatus === "needs_review" || s.suggestionStatus === "ready")
  );
  const previewEntries = await Promise.all(
    previewableSuggestions.map(async (s) => [s.id, await buildRewriteApplicationPreview(s.id)] as const)
  );
  const rewriteApplicationPreviewById = new Map(previewEntries);

  const versionChains = await Promise.all(socialPosts.map((post) => listRewriteVersionsByRoot(post.rootSocialPostId ?? post.id)));
  const versionChainByPostId = new Map(socialPosts.map((post, i) => [post.id, versionChains[i]]));

  const rewriteVersionPosts = socialPosts.filter((post) => post.isRewriteVersion && (post.rewriteAppliedFromSocialPostId || post.parentSocialPostId));
  const comparisonPreviewEntries = await Promise.all(
    rewriteVersionPosts.map(async (post) => [post.id, await buildRewriteVersionComparisonPreview(post.id)] as const)
  );
  const comparisonPreviewByPostId = new Map(comparisonPreviewEntries);

  const postsWithSavedComparison = socialPosts.filter((post) => post.latestVersionComparisonId);
  const savedComparisonEntries = await Promise.all(
    postsWithSavedComparison.map(async (post) => [post.id, await getVersionComparisonById(post.latestVersionComparisonId!)] as const)
  );
  const savedComparisonByPostId = new Map(savedComparisonEntries);

  const rewritePerformancePreviewEntries = await Promise.all(
    rewriteVersionPosts.map(async (post) => [post.id, await buildRewritePerformanceComparisonPreview(post.id)] as const)
  );
  const rewritePerformancePreviewByPostId = new Map(rewritePerformancePreviewEntries);

  const postsWithSavedRewritePerformanceComparison = socialPosts.filter((post) => post.latestRewritePerformanceComparisonId);
  const savedRewritePerformanceComparisonEntries = await Promise.all(
    postsWithSavedRewritePerformanceComparison.map(
      async (post) => [post.id, await getRewritePerformanceComparisonById(post.latestRewritePerformanceComparisonId!)] as const
    )
  );
  const savedRewritePerformanceComparisonByPostId = new Map(savedRewritePerformanceComparisonEntries);

  const articleRewritePerformanceSummary = await buildArticleRewritePerformanceSummary(article.id);

  const isDraft = article.status === "draft";
  const isReviewed = article.status === "reviewed";
  const latestWordPressLog = wordpressLogs[0];
  const hasWordPressSuccess = wordpressLogs.some((log) => log.status === "success");
  const hasFocusKeyword = Boolean(article.targetKeyword && article.targetKeyword.trim());
  const seoPluginPayload = article.seoPluginPayload as unknown as Partial<SeoPluginPayload>;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link href="/articles" className="text-sm text-zinc-500 hover:underline">
          ← 기사 목록으로
        </Link>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {publishMessage && (
          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {publishMessage}
          </div>
        )}

        {latestEval && !latestEval.passed && (
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="font-semibold">품질 검토 필요</div>
            <div className="mt-1 text-xs">
              이 기사는 AI 품질 평가를 통과하지 못했습니다 (종합 점수:{" "}
              {latestEval.aggregateScore != null ? latestEval.aggregateScore.toFixed(2) : "-"}).{" "}
              {latestEval.notes && latestEval.notes}
            </div>
          </div>
        )}

        <header className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <div className="flex shrink-0 gap-2">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {ARTICLE_MODE_CONFIGS[article.articleMode]?.label ?? article.articleMode}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[article.status]}`}
            >
              {STATUS_LABEL[article.status]}
            </span>
          </div>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>
              테마:{" "}
              {theme ? (
                <Link href={`/dashboard?themeId=${theme.id}`} className="text-zinc-700 hover:underline">
                  {theme.title}
                </Link>
              ) : (
                "(알 수 없음)"
              )}
            </span>
            <span>생성일: {new Date(article.createdAt).toLocaleString("ko-KR")}</span>
            <span>수정일: {new Date(article.updatedAt).toLocaleString("ko-KR")}</span>
            {article.reviewedAt && (
              <span>승인일: {new Date(article.reviewedAt).toLocaleString("ko-KR")}</span>
            )}
            {article.reviewedBy && <span>승인자: {article.reviewedBy}</span>}
          </div>
        </section>

        {/* Phase 2-1: 모드별 수익화 지표 (SEO/카테고리/태그는 아래 WordPress Metadata 섹션에서 확인) */}
        {(article.monetizationScore != null || article.policyRiskScore != null || article.searchIntent || article.readerPersona) && (
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700">
              수익형 블로그 지표 ({ARTICLE_MODE_CONFIGS[article.articleMode]?.label})
            </h2>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-600">검색 의도</dt>
                <dd className="text-zinc-500">{article.searchIntent || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">독자 페르소나</dt>
                <dd className="text-zinc-500">{article.readerPersona || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">수익화 적합도 (monetization_score)</dt>
                <dd className="text-zinc-500">
                  {article.monetizationScore != null ? `${article.monetizationScore} / 100` : "해당 없음"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">정책 위험도 (policy_risk_score)</dt>
                <dd className="text-zinc-500">
                  {article.policyRiskScore != null ? `${article.policyRiskScore} / 100 (높을수록 위험)` : "해당 없음"}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* 기사 본문 / 수정 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">기사 본문</h2>

          {isDraft ? (
            <form action={updateArticleAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="articleId" value={article.id} />
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                제목
                <input
                  name="title"
                  defaultValue={article.title}
                  required
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                본문
                <textarea
                  name="content"
                  defaultValue={article.content}
                  rows={16}
                  required
                  className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs leading-relaxed"
                />
              </label>
              <div>
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  수정 내용 저장
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-2 text-xs text-zinc-500">
                {STATUS_LABEL[article.status]} 상태인 기사는 수정할 수 없습니다.
              </p>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                {article.content}
              </pre>
            </>
          )}
        </section>

        {/* 승인 */}
        {isDraft && (
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700">승인</h2>
            <p className="mt-1 text-xs text-zinc-500">
              승인하면 기사 상태가 reviewed로 변경되고 더 이상 수정할 수 없습니다.
            </p>
            <form action={approveArticleAction} className="mt-3">
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
              >
                승인하기
              </button>
            </form>
          </section>
        )}

        {/* Phase 2-3: WordPress Metadata (카테고리/태그/SEO) */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">WordPress Metadata</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${WP_METADATA_STATUS_STYLE[article.wpMetadataStatus]}`}
            >
              {WP_METADATA_STATUS_LABEL[article.wpMetadataStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            article이 존재하면 승인(reviewed) 여부와 무관하게 metadata를 생성할 수 있습니다.
            실제 WordPress API는 호출하지 않으며, 이름 기반으로만 카테고리/태그를 추천합니다.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={generateWordPressMetadataAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
              >
                {article.wpMetadataStatus === "not_ready" ? "WordPress metadata 생성" : "metadata 다시 생성"}
              </button>
            </form>
            {(article.wpMetadataStatus === "generated" || article.wpMetadataStatus === "failed") && (
              <form action={reviewWordPressMetadataAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button
                  type="submit"
                  className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  metadata 검토 완료
                </button>
              </form>
            )}
          </div>

          {article.wpMetadataStatus !== "not_ready" && (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-600">SEO 제목</dt>
                <dd className="text-zinc-500">{article.seoTitle || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">메타 설명</dt>
                <dd className="text-zinc-500">{article.metaDescription || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">slug</dt>
                <dd className="text-zinc-500 font-mono">{article.slug || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">타깃 키워드</dt>
                <dd className="text-zinc-500">{article.targetKeyword || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">보조 키워드</dt>
                <dd className="text-zinc-500">
                  {article.secondaryKeywords.length > 0 ? article.secondaryKeywords.join(", ") : "해당 없음"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">카테고리</dt>
                <dd className="flex flex-wrap gap-1 text-zinc-500">
                  {article.wpCategoryNames.length > 0
                    ? article.wpCategoryNames.map((name) => (
                        <span key={name} className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                          {name}
                        </span>
                      ))
                    : "해당 없음"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-600">태그</dt>
                <dd className="flex flex-wrap gap-1 text-zinc-500">
                  {article.wpTagNames.length > 0
                    ? article.wpTagNames.map((name) => (
                        <span key={name} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
                          #{name}
                        </span>
                      ))
                    : "해당 없음"}
                </dd>
              </div>
              {article.internalLinkSuggestions.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">내부 링크 추천</dt>
                  <dd className="mt-1">
                    <ul className="list-inside list-disc text-zinc-500">
                      {article.internalLinkSuggestions.map((link, index) => (
                        <li key={index}>
                          {link.title} — {link.reason}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {article.adSlots.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">광고 슬롯 marker (실제 광고 코드 아님)</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {article.adSlots.map((slot) => (
                      <span
                        key={slot.position}
                        className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-600"
                      >
                        {slot.marker}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Phase 2-4: SEO Plugin Metadata (Yoast/Rank Math/AIOSEO) */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">SEO Plugin Metadata</h2>
            <div className="flex gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEO_PLUGIN_METADATA_STATUS_STYLE[article.seoPluginMetadataStatus]}`}
              >
                {SEO_PLUGIN_METADATA_STATUS_LABEL[article.seoPluginMetadataStatus]}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                write: {SEO_PLUGIN_WRITE_STATUS_LABEL[article.seoPluginWriteStatus]}
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Yoast/Rank Math/AIOSEO 등 WordPress SEO plugin에 전달할 metadata payload를
            준비합니다. 실제 plugin write는 아직 구현되지 않았습니다 (커스텀 endpoint 필요).
          </p>

          <form action={generateSeoPluginMetadataAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="articleId" value={article.id} />
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              provider
              <select
                name="provider"
                defaultValue={article.seoPluginProvider}
                className="rounded border border-zinc-300 px-2 py-1 text-xs"
              >
                {SEO_PLUGIN_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              {article.seoPluginMetadataStatus === "not_ready" ? "SEO plugin metadata 생성" : "다시 생성"}
            </button>
            {(article.seoPluginMetadataStatus === "generated" || article.seoPluginMetadataStatus === "failed") && (
              <button
                type="submit"
                formAction={reviewSeoPluginMetadataAction}
                className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                검토 완료
              </button>
            )}
          </form>

          {article.seoPluginMetadataStatus !== "not_ready" && (
            <>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-zinc-600">SEO title</dt>
                  <dd className="text-zinc-500">
                    {seoPluginPayload?.seoTitle || "해당 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">meta description</dt>
                  <dd className="text-zinc-500">
                    {seoPluginPayload?.metaDescription || "해당 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">focus keyword</dt>
                  <dd className="text-zinc-500">
                    {seoPluginPayload?.focusKeyword || "해당 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">secondary keywords</dt>
                  <dd className="text-zinc-500">
                    {seoPluginPayload?.secondaryKeywords?.join(", ") || "해당 없음"}
                  </dd>
                </div>
              </dl>

              {Object.keys(seoPluginPayload?.rawPluginMeta ?? {}).length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="font-medium text-zinc-600">
                    rawPluginMeta 후보 (실제 정답으로 단정하지 않음 — 사이트별 확인 필요)
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5 font-mono text-zinc-500">
                    {Object.entries(seoPluginPayload.rawPluginMeta ?? {}).map(
                      ([key, value]) => (
                        <li key={key}>
                          {key}: {String(value)}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {article.seoPluginProvider !== "none" && article.seoPluginMetadataStatus !== "reviewed" && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  ⚠ SEO plugin metadata가 아직 검토 완료되지 않았습니다 (선택 사항이며 게시를 막지는 않습니다).
                </div>
              )}

              {article.seoPluginWriteError && (
                <p className="mt-3 text-xs text-red-600">write 오류: {article.seoPluginWriteError}</p>
              )}
            </>
          )}
        </section>

        {/* Phase 2-5: Featured Image Preparation */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Featured Image Preparation</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEATURED_IMAGE_STATUS_STYLE[article.featuredImageStatus]}`}
            >
              {FEATURED_IMAGE_STATUS_LABEL[article.featuredImageStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            실제 이미지를 생성하거나 WordPress에 업로드하지 않습니다. 대표 이미지
            prompt/alt text/caption/style만 준비합니다. 이미지 안에는 텍스트를
            넣지 않도록 안내합니다.
          </p>

          <form action={prepareFeaturedImageAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="articleId" value={article.id} />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              {article.featuredImageStatus === "not_ready" ? "대표 이미지 정보 준비" : "다시 생성"}
            </button>
            {(article.featuredImageStatus === "prepared" || article.featuredImageStatus === "failed") && (
              <button
                type="submit"
                formAction={reviewFeaturedImageAction}
                className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                검토 완료
              </button>
            )}
          </form>

          {article.featuredImageStatus !== "not_ready" && (
            <>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">prompt</dt>
                  <dd className="text-zinc-500">{article.featuredImagePrompt || "해당 없음"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">alt text</dt>
                  <dd className="text-zinc-500">{article.featuredImageAltText || "해당 없음"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">caption</dt>
                  <dd className="text-zinc-500">{article.featuredImageCaption || "해당 없음"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">style</dt>
                  <dd className="text-zinc-500">{article.featuredImageStyle || "해당 없음"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">aspect ratio</dt>
                  <dd className="text-zinc-500 font-mono">{article.featuredImageAspectRatio}</dd>
                </div>
              </dl>

              {article.featuredImageStatus !== "reviewed" && article.featuredImageStatus !== "failed" && (
                <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  ⚠ 대표 이미지 정보가 아직 검토 완료되지 않았습니다 (선택 사항이며 게시를 막지는 않습니다).
                </div>
              )}

              {article.featuredImageError && (
                <p className="mt-3 text-xs text-red-600">오류: {article.featuredImageError}</p>
              )}
            </>
          )}
        </section>

        {/* Phase 2-7: Image Generation */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Image Generation</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${GENERATED_IMAGE_STATUS_STYLE[article.generatedImageStatus]}`}
            >
              {GENERATED_IMAGE_STATUS_LABEL[article.generatedImageStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Featured Image Preparation에서 준비한 prompt/alt text/caption/style을
            바탕으로 실제 또는 mock 이미지를 생성합니다. 실제 WordPress media
            upload는 아직 수행하지 않습니다.
          </p>
          {!isImageGenerationEnabled() && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              ⚠ 실제 이미지 생성 provider는 비활성화되어 있어 mock 결과로 대체됩니다 (IMAGE_GENERATION_ENABLED=false)
            </p>
          )}

          {article.featuredImageStatus === "not_ready" || !article.featuredImagePrompt ? (
            <p className="mt-3 text-xs text-zinc-500">
              먼저 위의 Featured Image Preparation에서 대표 이미지 정보를 준비하세요.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={generateFeaturedImageAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  {article.generatedImageStatus === "not_generated" ? "이미지 생성" : "다시 생성"}
                </button>
              </form>
              {(article.generatedImageStatus === "generated" || article.generatedImageStatus === "failed") && (
                <form action={reviewGeneratedImageAction}>
                  <input type="hidden" name="articleId" value={article.id} />
                  <button
                    type="submit"
                    className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    생성 결과 검토 완료
                  </button>
                </form>
              )}
            </div>
          )}

          {article.generatedImageStatus !== "not_generated" && (
            <>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-zinc-600">provider</dt>
                  <dd className="text-zinc-500">{article.generatedImageProvider}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">model</dt>
                  <dd className="text-zinc-500">{article.generatedImageModel || "해당 없음"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">width × height</dt>
                  <dd className="text-zinc-500 font-mono">
                    {article.generatedImageWidth && article.generatedImageHeight
                      ? `${article.generatedImageWidth} × ${article.generatedImageHeight}`
                      : "해당 없음"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-zinc-600">format</dt>
                  <dd className="text-zinc-500 font-mono">{article.generatedImageFormat || "해당 없음"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">image url</dt>
                  <dd className="text-zinc-500 break-all">{article.generatedImageUrl || "해당 없음"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">prompt</dt>
                  <dd className="text-zinc-500">{article.generatedImagePrompt || "해당 없음"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-600">negative prompt</dt>
                  <dd className="text-zinc-500">{article.generatedImageNegativePrompt || "해당 없음"}</dd>
                </div>
              </dl>

              {article.generatedImageUrl && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-zinc-600">미리보기</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.generatedImageUrl}
                    alt={article.featuredImageAltText || article.title}
                    className="mt-1 max-h-64 rounded border border-zinc-200 object-cover"
                  />
                </div>
              )}

              {article.generatedImageError && (
                <p className="mt-3 text-xs text-red-600">오류: {article.generatedImageError}</p>
              )}
            </>
          )}
        </section>

        {/* Featured Image Workflow Step 1: Source Setup */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Step 1. 대표 이미지 Source 설정</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEATURED_IMAGE_SOURCE_STATUS_STYLE[article.featuredImageSourceStatus]}`}
            >
              {FEATURED_IMAGE_SOURCE_STATUS_LABEL[article.featuredImageSourceStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            AI 이미지 생성 기능을 연결하기 전까지는 로컬 이미지 업로드 또는
            인터넷 이미지 URL을 사용하세요. 사용 권한이 있는 이미지만
            사용해야 합니다.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* A. 로컬 이미지 업로드 */}
            <div className="rounded border border-zinc-200 p-3">
              <h3 className="text-xs font-semibold text-zinc-700">A. 로컬 이미지 업로드</h3>
              <form action={saveLocalFeaturedImageAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="articleId" value={article.id} />
                <input
                  type="file"
                  name="imageFile"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  required
                  className="text-xs"
                />
                <p className="text-[11px] text-zinc-400">허용 확장자: jpg/jpeg/png/webp, 최대 5MB.</p>
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                >
                  대표 이미지 파일 저장
                </button>
              </form>
            </div>

            {/* B. 인터넷 이미지 URL 입력 */}
            <div className="rounded border border-zinc-200 p-3">
              <h3 className="text-xs font-semibold text-zinc-700">B. 인터넷 이미지 URL 입력</h3>
              <form action={saveExternalImageUrlSourceAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="articleId" value={article.id} />
                <input
                  type="url"
                  name="imageUrl"
                  placeholder="https://example.com/image.jpg"
                  required
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  name="filename"
                  placeholder="파일명 (선택)"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  name="mimeType"
                  placeholder="MIME type (선택, 예: image/jpeg)"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <p className="text-[11px] font-medium text-amber-700">
                  뉴스 기사, 포털, 타인의 블로그 이미지 등 권한이 불분명한
                  이미지는 사용하지 마세요.
                </p>
                <button
                  type="submit"
                  className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  이미지 URL 저장
                </button>
              </form>
            </div>

            {/* C. 기존 WordPress media_id 직접 입력 */}
            <div className="rounded border border-zinc-200 p-3">
              <h3 className="text-xs font-semibold text-zinc-700">C. 기존 WordPress Media 지정</h3>
              <form action={saveExistingWordPressMediaSourceAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="articleId" value={article.id} />
                <input
                  type="number"
                  name="mediaId"
                  placeholder="WordPress media id"
                  required
                  min={1}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <input
                  type="url"
                  name="mediaUrl"
                  placeholder="media URL (선택)"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <p className="text-[11px] text-zinc-400">
                  이미 WordPress Media Library에 있는 이미지의 media id를
                  입력하면 업로드 없이 바로 사용합니다.
                </p>
                <button
                  type="submit"
                  className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  기존 media id 저장
                </button>
              </form>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">현재 source type</dt>
              <dd className="text-zinc-500">{article.featuredImageSourceType}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">현재 source status</dt>
              <dd className="text-zinc-500">{article.featuredImageSourceStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">현재 upload status</dt>
              <dd className="text-zinc-500">{article.featuredImageUploadStatus}</dd>
            </div>
          </dl>
          {article.featuredImageSourceError && (
            <p className="mt-3 text-xs text-red-600">source 오류: {article.featuredImageSourceError}</p>
          )}
          {article.featuredImageUploadError && (
            <p className="mt-3 text-xs text-red-600">업로드 오류: {article.featuredImageUploadError}</p>
          )}
        </section>

        {/* Featured Image Workflow Step 2: WordPress Media Upload */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Step 2. WordPress Media Upload</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${MEDIA_UPLOAD_STATUS_STYLE[article.featuredImageUploadStatus]}`}
            >
              {MEDIA_UPLOAD_STATUS_LABEL[article.featuredImageUploadStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Phase 2-5에서 준비한 대표 이미지 정보를 바탕으로 WordPress media
            업로드 payload를 준비하고, WORDPRESS_MEDIA_UPLOAD_ENABLED=true일 때
            실제 WordPress Media Library에 이미지 1개를 업로드하는 테스트를
            수행합니다. mock URL이나 상대경로 이미지는 실제 업로드되지 않습니다.
          </p>
          <p className="mt-1 text-xs font-medium">
            WORDPRESS_MEDIA_UPLOAD_ENABLED:{" "}
            {isWordPressMediaUploadEnabled() ? (
              <span className="text-green-700">true (실제 업로드 시도)</span>
            ) : (
              <span className="text-amber-700">false (실제 업로드 건너뜀)</span>
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={prepareWordPressMediaUploadAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
              >
                {article.featuredImageUploadStatus === "not_ready" ? "WordPress 이미지 업로드 준비" : "다시 준비"}
              </button>
            </form>
            {article.featuredImageUploadStatus !== "not_ready" && (
              <form action={confirmWordPressMediaUploadDryRunAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button
                  type="submit"
                  className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  업로드 dry-run 확인
                </button>
              </form>
            )}
            <form action={uploadFeaturedImageToWordPressAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                WordPress 이미지 업로드 테스트
              </button>
            </form>
            <form action={checkWordPressMediaUploadStatusAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                업로드 상태 확인
              </button>
            </form>
          </div>

          {article.featuredImageUploadStatus !== "not_ready" && (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-600">source type</dt>
                <dd className="text-zinc-500">{article.featuredImageSourceType}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">source url</dt>
                <dd className="text-zinc-500 break-all">{article.featuredImageSourceUrl || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">local path</dt>
                <dd className="text-zinc-500 break-all">{article.featuredImageLocalPath || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">filename</dt>
                <dd className="text-zinc-500 font-mono">{article.featuredImageFilename || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">mime type</dt>
                <dd className="text-zinc-500 font-mono">{article.featuredImageMimeType || "해당 없음"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">WordPress media id</dt>
                <dd className="text-zinc-500">{article.featuredImageWordpressMediaId ?? "해당 없음 (아직 없음)"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-600">WordPress media url</dt>
                <dd className="text-zinc-500 break-all">{article.featuredImageWordpressUrl || "해당 없음"}</dd>
              </div>
              {article.featuredImageUploadAttemptedAt && (
                <div>
                  <dt className="font-medium text-zinc-600">마지막 시도 시간</dt>
                  <dd className="text-zinc-500">
                    {new Date(article.featuredImageUploadAttemptedAt).toLocaleString("ko-KR")}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {article.featuredImageUploadStatus !== "not_ready" &&
            Object.keys(article.featuredImageUploadPayload).length > 0 && (
              <div className="mt-3 text-xs">
                <div className="font-medium text-zinc-600">upload payload 미리보기</div>
                <ul className="mt-1 flex flex-col gap-0.5 font-mono text-zinc-500">
                  {Object.entries(article.featuredImageUploadPayload)
                    .filter(([key]) => key !== "articleId")
                    .map(([key, value]) => (
                      <li key={key}>
                        {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </li>
                    ))}
                </ul>
              </div>
            )}

          {article.featuredImageUploadError && (
            <p className="mt-3 text-xs text-red-600">오류: {article.featuredImageUploadError}</p>
          )}
        </section>

        {/* Phase 2-8: WordPress Connection Test */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">WordPress Connection Test</h2>
          <p className="mt-1 text-xs text-zinc-500">
            실제 WordPress 사이트에 안전하게 연결할 수 있는지 확인합니다
            (draft 생성 권한 확인용이며, 공개 게시는 절대 수행하지 않습니다).
            Application Password나 Authorization header는 표시되지 않습니다.
          </p>

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">base URL</dt>
              <dd className="text-zinc-500 font-mono break-all">
                {process.env.WORDPRESS_BASE_URL || "설정되지 않음"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">publish enabled</dt>
              <dd className="text-zinc-500">
                {isWordPressPublishEnabled() ? "true (실제 draft 생성)" : "false (dry-run)"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">media upload enabled</dt>
              <dd className="text-zinc-500">
                {isWordPressMediaUploadEnabled() ? "true" : "false (비활성화)"}
              </dd>
            </div>
          </dl>

          <form action={testWordPressConnectionAction} className="mt-3">
            <input type="hidden" name="articleId" value={article.id} />
            <button
              type="submit"
              className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              WordPress 연결 테스트
            </button>
          </form>

          <p className="mt-2 text-xs text-zinc-400">
            연결 테스트 결과는 위쪽 알림 영역에 표시됩니다 (성공/실패 및 원인 후보 포함).
          </p>
        </section>

        {/* Phase 2-2 / 2-9: WordPress 초안 생성 (안정화) */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">WordPress 게시</h2>
          <p className="mt-1 text-xs text-zinc-500">
            승인(reviewed)된 기사만 WordPress에 draft(초안) post로 생성할 수 있습니다.
            자동 공개(publish)는 절대 수행하지 않으며, post status는 항상 draft로
            강제됩니다.
          </p>

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">WORDPRESS_PUBLISH_ENABLED</dt>
              <dd className="text-zinc-500">{isWordPressPublishEnabled() ? "true" : "false"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">현재 모드</dt>
              <dd className="text-zinc-500">
                {isWordPressPublishEnabled() ? "actual draft (실제 WordPress API 호출)" : "dry-run (실제 호출 없음)"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">media upload</dt>
              <dd className="text-zinc-500">deferred (다음 단계 예정)</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">SEO plugin write</dt>
              <dd className="text-zinc-500">deferred (다음 단계 예정)</dd>
            </div>
          </dl>

          {isReviewed && article.wpMetadataStatus !== "reviewed" && !hasWordPressSuccess && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ WordPress metadata가 아직 검토 완료되지 않았습니다 (선택 사항이며 게시를 막지는 않습니다).
            </div>
          )}

          {!isReviewed ? (
            <p className="mt-3 text-xs text-zinc-500">
              기사가 승인(reviewed)되어야 WordPress 초안 생성 버튼이 활성화됩니다.
            </p>
          ) : hasWordPressSuccess ? (
            <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              ✓ 이미 WordPress 초안이 생성되어 있어 중복 생성을 건너뜁니다 (duplicate skip)
              {latestWordPressLog?.postUrl && (
                <>
                  {" — "}
                  <a
                    href={latestWordPressLog.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {latestWordPressLog.postUrl}
                  </a>
                </>
              )}
            </div>
          ) : (
            <form action={publishToWordPressDraftAction} className="mt-3">
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                WordPress 초안 생성
              </button>
            </form>
          )}

          {latestWordPressLog && (
            <div className="mt-3 text-xs text-zinc-500">
              <div className="font-medium text-zinc-600">최근 게시 상태</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    latestWordPressLog.status === "success"
                      ? "bg-green-100 text-green-700"
                      : latestWordPressLog.status === "dry_run"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {latestWordPressLog.status === "success"
                    ? "성공"
                    : latestWordPressLog.status === "dry_run"
                      ? "dry-run 완료 (실제 WordPress에는 생성되지 않음)"
                      : "실패"}
                </span>
                <span>{new Date(latestWordPressLog.createdAt).toLocaleString("ko-KR")}</span>
              </div>
              {latestWordPressLog.externalPostId && (
                <p className="mt-1">external_post_id: {latestWordPressLog.externalPostId}</p>
              )}
              {latestWordPressLog.postUrl && (
                <p className="mt-1 break-all">
                  post_url:{" "}
                  <a
                    href={latestWordPressLog.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {latestWordPressLog.postUrl}
                  </a>
                </p>
              )}
              {latestWordPressLog.errorMessage && (
                <p className="mt-1 text-red-600">오류: {latestWordPressLog.errorMessage}</p>
              )}
            </div>
          )}
        </section>

        {/* Featured Image Workflow Step 3: Featured Media Attach */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Step 3. Featured Media Attach</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEATURED_MEDIA_ATTACH_STATUS_STYLE[article.wordpressFeaturedMediaAttachStatus]}`}
            >
              {FEATURED_MEDIA_ATTACH_STATUS_LABEL[article.wordpressFeaturedMediaAttachStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Phase 2-10에서 업로드된 WordPress media id를 기존 WordPress draft
            post의 featured_media로 연결합니다. 공개 게시는 수행하지 않으며
            post status는 항상 draft로 유지됩니다.
          </p>
          {!article.featuredImageWordpressMediaId && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              ⚠ 연결할 WordPress media id가 없습니다 (먼저 WordPress 이미지 업로드 테스트를 완료하세요).
            </p>
          )}
          {!hasWordPressSuccess && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              ⚠ 아직 생성된 WordPress draft가 없습니다 (WordPress 초안 생성 시 media id가 있으면 자동으로 포함됩니다).
            </p>
          )}

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">featured_image_wordpress_media_id</dt>
              <dd className="text-zinc-500">{article.featuredImageWordpressMediaId ?? "해당 없음"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">featured_image_wordpress_url</dt>
              <dd className="text-zinc-500 break-all">{article.featuredImageWordpressUrl || "해당 없음"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">기존 WordPress post id</dt>
              <dd className="text-zinc-500">{latestWordPressLog?.externalPostId ?? "해당 없음"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">기존 WordPress post_url</dt>
              <dd className="text-zinc-500 break-all">{latestWordPressLog?.postUrl || "해당 없음"}</dd>
            </div>
            {article.wordpressFeaturedMediaAttachedAt && (
              <div>
                <dt className="font-medium text-zinc-600">마지막 시도 시간</dt>
                <dd className="text-zinc-500">
                  {new Date(article.wordpressFeaturedMediaAttachedAt).toLocaleString("ko-KR")}
                </dd>
              </div>
            )}
          </dl>

          {article.wordpressFeaturedMediaAttachError && (
            <p className="mt-3 text-xs text-red-600">오류: {article.wordpressFeaturedMediaAttachError}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={attachFeaturedMediaToDraftAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                disabled={!article.featuredImageWordpressMediaId}
                className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                대표 이미지 초안 글에 연결
              </button>
            </form>
            <form action={checkWordPressFeaturedMediaAttachStatusAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                상태 다시 확인
              </button>
            </form>
          </div>
        </section>

        {/* Phase 2-12: SEO Plugin Actual Metadata Test */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">SEO Plugin Actual Write</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEO_PLUGIN_ACTUAL_WRITE_STATUS_STYLE[article.seoPluginActualWriteStatus]}`}
            >
              {SEO_PLUGIN_ACTUAL_WRITE_STATUS_LABEL[article.seoPluginActualWriteStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Phase 2-4에서 준비한 SEO plugin metadata를 실제 WordPress draft
            post에 반영하는 테스트를 합니다. 공개 게시는 수행하지 않으며 post
            status는 항상 draft로 유지됩니다. provider 하나만 선택해서
            테스트합니다.
          </p>

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">SEO_PLUGIN_PROVIDER</dt>
              <dd className="text-zinc-500">{getSeoPluginProvider()}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">SEO_PLUGIN_WRITE_ENABLED</dt>
              <dd className="text-zinc-500">{isSeoPluginWriteEnabled() ? "true" : "false"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">write provider (마지막 시도)</dt>
              <dd className="text-zinc-500">{article.seoPluginActualWriteProvider ?? "해당 없음"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">target_keyword (focus keyword)</dt>
              <dd className={hasFocusKeyword ? "text-zinc-500" : "font-medium text-amber-700"}>
                {article.targetKeyword || "없음"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">WordPress post id</dt>
              <dd className="text-zinc-500">
                {article.seoPluginActualWritePostId ?? latestWordPressLog?.externalPostId ?? "해당 없음"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">반영 확인(verified)</dt>
              <dd className="text-zinc-500">{article.seoPluginActualWriteVerified ? "예" : "아니오"}</dd>
            </div>
            {article.seoPluginActualWriteAttemptedAt && (
              <div>
                <dt className="font-medium text-zinc-600">마지막 시도 시간</dt>
                <dd className="text-zinc-500">
                  {new Date(article.seoPluginActualWriteAttemptedAt).toLocaleString("ko-KR")}
                </dd>
              </div>
            )}
          </dl>

          {getSeoPluginProvider() === "none" && (
            <p className="mt-3 text-xs font-medium text-amber-700">
              ⚠ SEO_PLUGIN_PROVIDER=none이어서 실제 write를 시도할 수 없습니다.
            </p>
          )}
          {!hasWordPressSuccess && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              ⚠ 아직 생성된 WordPress draft가 없습니다 (먼저 WordPress 초안 생성을 실행하세요).
            </p>
          )}
          {!hasFocusKeyword && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              ⚠ Focus keyword가 없어 Rank Math에 반영할 수 없습니다. SEO metadata를 다시 생성하거나 target_keyword를 입력하세요.
            </p>
          )}
          {article.seoPluginActualWriteWarning && (
            <p className="mt-3 text-xs text-amber-700">⚠ {article.seoPluginActualWriteWarning}</p>
          )}
          {article.seoPluginActualWriteError && (
            <p className="mt-3 text-xs text-red-600">오류: {article.seoPluginActualWriteError}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={writeSeoPluginMetadataToWordPressAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                disabled={getSeoPluginProvider() === "none" || !hasFocusKeyword}
                className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                SEO plugin metadata 실제 반영 테스트
              </button>
            </form>
            <form action={checkSeoPluginActualWriteStatusAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                반영 상태 확인
              </button>
            </form>
          </div>

          {/* Phase 2-13: Custom WordPress SEO Metadata Endpoint (Rank Math 전용) */}
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-zinc-700">Custom Endpoint (Rank Math 전용)</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEO_PLUGIN_CUSTOM_ENDPOINT_STATUS_STYLE[article.seoPluginCustomEndpointStatus]}`}
              >
                {SEO_PLUGIN_CUSTOM_ENDPOINT_STATUS_LABEL[article.seoPluginCustomEndpointStatus]}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              표준 WordPress posts REST API로 Rank Math SEO metadata 반영이
              확인되지 않을 때, WordPress 쪽 custom REST endpoint를 통해
              update_post_meta로 직접 저장합니다. Rank Math 전용이며 Yoast/
              AIOSEO는 지원하지 않습니다.
            </p>

            <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-600">WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED</dt>
                <dd className="text-zinc-500">{isSeoCustomEndpointEnabled() ? "true" : "false"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">custom endpoint path</dt>
                <dd className="text-zinc-500 font-mono break-all">{getSeoCustomEndpointPath()}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-600">반영 확인(verified)</dt>
                <dd className="text-zinc-500">{article.seoPluginCustomEndpointVerified ? "예" : "아니오"}</dd>
              </div>
              {article.seoPluginCustomEndpointAttemptedAt && (
                <div>
                  <dt className="font-medium text-zinc-600">마지막 시도 시간</dt>
                  <dd className="text-zinc-500">
                    {new Date(article.seoPluginCustomEndpointAttemptedAt).toLocaleString("ko-KR")}
                  </dd>
                </div>
              )}
            </dl>

            {getSeoPluginProvider() !== "rank_math" && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                ⚠ SEO_PLUGIN_PROVIDER가 rank_math가 아니어서 custom endpoint를 사용할 수 없습니다.
              </p>
            )}
            {!isSeoCustomEndpointEnabled() && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                ⚠ WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=false이어서 custom endpoint write를 건너뜁니다.
              </p>
            )}
            {!hasWordPressSuccess && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                ⚠ 아직 생성된 WordPress draft가 없습니다.
              </p>
            )}
            {!hasFocusKeyword && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                ⚠ Focus keyword가 없어 Rank Math에 반영할 수 없습니다. SEO metadata를 다시 생성하거나 target_keyword를 입력하세요.
              </p>
            )}
            {article.seoPluginCustomEndpointError && (
              <p className="mt-2 text-xs text-red-600">오류: {article.seoPluginCustomEndpointError}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <form action={writeRankMathSeoViaCustomEndpointAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button
                  type="submit"
                  disabled={getSeoPluginProvider() !== "rank_math" || !hasFocusKeyword}
                  className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Rank Math custom endpoint로 SEO 반영
                </button>
              </form>
              <form action={checkSeoPluginActualWriteStatusAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  반영 상태 확인
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Phase 2-14: WordPress Final Draft Payload Review */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">WordPress Final Draft Payload Review</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${FINAL_DRAFT_REVIEW_STATUS_STYLE[article.wordpressFinalDraftReviewStatus]}`}
            >
              {FINAL_DRAFT_REVIEW_STATUS_LABEL[article.wordpressFinalDraftReviewStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            WordPress draft post/featured media/Rank Math SEO metadata/
            category·tag/출처 인용/AD_SLOT marker가 하나의 draft에 정상
            반영되었는지 checklist로 점검합니다. 실제 WordPress API를 다시
            호출하지 않으며, 공개 게시는 절대 수행하지 않습니다.
          </p>

          {!hasWordPressSuccess && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              ⚠ 아직 생성된 WordPress draft가 없습니다 (먼저 WordPress 초안 생성을 실행하세요).
            </p>
          )}

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">score</dt>
              <dd className="text-zinc-500">
                {article.wordpressFinalDraftReviewScore != null ? `${article.wordpressFinalDraftReviewScore} / 100` : "해당 없음"}
              </dd>
            </div>
            {article.wordpressFinalDraftReviewedAt && (
              <div>
                <dt className="font-medium text-zinc-600">마지막 검토 시간</dt>
                <dd className="text-zinc-500">
                  {new Date(article.wordpressFinalDraftReviewedAt).toLocaleString("ko-KR")}
                </dd>
              </div>
            )}
          </dl>

          {article.wordpressFinalDraftReviewError && (
            <p className="mt-3 text-xs text-red-600">오류: {article.wordpressFinalDraftReviewError}</p>
          )}

          {Array.isArray((article.wordpressFinalDraftReviewSummary as { checklist?: unknown })?.checklist) && (
            <ul className="mt-3 flex flex-col gap-1">
              {(
                (article.wordpressFinalDraftReviewSummary as {
                  checklist: Array<{ key: string; label: string; status: string; detail: string }>;
                }).checklist
              ).map((item) => (
                <li key={item.key} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                  <span
                    className={`mt-0.5 inline-block shrink-0 rounded-full px-1.5 py-0.5 font-medium ${CHECKLIST_ITEM_STYLE[item.status] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {item.label}
                  </span>
                  <span className="text-zinc-600">{item.detail}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={reviewWordPressFinalDraftAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                disabled={!hasWordPressSuccess}
                className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Final draft payload 검토 실행
              </button>
            </form>
            <form action={checkWordPressFinalDraftReviewStatusAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                검토 상태 확인
              </button>
            </form>
          </div>
        </section>

        {/* Phase 2-15: Publish Quality Gate */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Publish Quality Gate</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PUBLISH_QUALITY_GATE_STATUS_STYLE[article.publishQualityGateStatus]}`}
            >
              {PUBLISH_QUALITY_GATE_STATUS_LABEL[article.publishQualityGateStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            WordPress 공개 게시 전에 반드시 통과해야 하는 품질검사 게이트입니다.
            article/WordPress draft/SEO metadata/featured image/출처 인용/AD_SLOT
            marker/콘텐츠 안전성/로깅 안전성을 종합 점검하며, 이 단계는 검증만
            수행하고 실제 공개 게시는 절대 수행하지 않습니다.
          </p>

          {!hasWordPressSuccess && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              ⚠ 아직 생성된 WordPress draft가 없습니다 (먼저 WordPress 초안 생성을 실행하세요).
            </p>
          )}

          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-zinc-600">score</dt>
              <dd className="text-zinc-500">
                {article.publishQualityGateScore != null ? `${article.publishQualityGateScore} / 100` : "해당 없음"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">publish_ready</dt>
              <dd className={article.publishReady ? "font-medium text-green-700" : "text-zinc-500"}>
                {article.publishReady ? "예" : "아니오"}
              </dd>
            </div>
            {article.publishQualityGateCheckedAt && (
              <div>
                <dt className="font-medium text-zinc-600">마지막 검사 시간</dt>
                <dd className="text-zinc-500">
                  {new Date(article.publishQualityGateCheckedAt).toLocaleString("ko-KR")}
                </dd>
              </div>
            )}
            {article.publishBlockedReason && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-600">차단 사유</dt>
                <dd className="text-red-600">{article.publishBlockedReason}</dd>
              </div>
            )}
          </dl>

          {article.publishQualityGateError && (
            <p className="mt-3 text-xs text-red-600">오류: {article.publishQualityGateError}</p>
          )}

          {article.publishReady && (
            <p className="mt-3 text-xs font-medium text-indigo-700">
              ℹ 이 결과는 검증 완료를 의미할 뿐입니다. 다음 단계에서 사용자 승인을 거쳐야
              공개 게시가 가능합니다 (이 화면에서는 공개 게시를 수행하지 않습니다).
            </p>
          )}

          {Array.isArray((article.publishQualityGateSummary as { checklist?: unknown })?.checklist) && (
            <ul className="mt-3 flex flex-col gap-1">
              {(
                (article.publishQualityGateSummary as {
                  checklist: Array<{ key: string; label: string; status: string; message: string; severity: string }>;
                }).checklist
              ).map((item) => (
                <li key={item.key} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                  <span
                    className={`mt-0.5 inline-block shrink-0 rounded-full px-1.5 py-0.5 font-medium ${QUALITY_GATE_ITEM_STYLE[item.status] ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {item.label}
                  </span>
                  <span className="text-zinc-600">{item.message}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={runPublishQualityGateAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                disabled={!hasWordPressSuccess}
                className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish Quality Gate 실행
              </button>
            </form>
            <form action={checkPublishQualityGateStatusAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <button
                type="submit"
                className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                결과 새로고침
              </button>
            </form>
          </div>
        </section>

        {/* Phase 2-16: Human Approval Before Public Publish */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">Human Approval Before Public Publish</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PUBLIC_PUBLISH_APPROVAL_STATUS_STYLE[article.publicPublishApprovalStatus]}`}
            >
              {PUBLIC_PUBLISH_APPROVAL_STATUS_LABEL[article.publicPublishApprovalStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Publish Quality Gate를 통과한 기사에 대해 사람이 최종 승인해야만
            다음 단계에서 WordPress 공개 게시(public publish)를 진행할 수
            있습니다. 이 화면에서는 승인 상태만 저장하며 실제 공개 게시는
            수행하지 않습니다.
          </p>

          {(() => {
            const canApprove =
              article.publishReady &&
              article.publishQualityGateStatus === "ready_to_publish" &&
              hasWordPressSuccess &&
              !(article.publicPublishApprovalStatus === "approved" && article.publicPublishApproved);
            const alreadyApproved =
              article.publicPublishApprovalStatus === "approved" && article.publicPublishApproved;

            return (
              <>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">publish_quality_gate_status</dt>
                    <dd className="text-zinc-500">{article.publishQualityGateStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">publish_ready</dt>
                    <dd className={article.publishReady ? "font-medium text-green-700" : "text-zinc-500"}>
                      {article.publishReady ? "예" : "아니오"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">public_publish_approved</dt>
                    <dd className={article.publicPublishApproved ? "font-medium text-green-700" : "text-zinc-500"}>
                      {article.publicPublishApproved ? "예" : "아니오"}
                    </dd>
                  </div>
                  {article.publicPublishApprovedAt && (
                    <div>
                      <dt className="font-medium text-zinc-600">승인 시각</dt>
                      <dd className="text-zinc-500">
                        {new Date(article.publicPublishApprovedAt).toLocaleString("ko-KR")}
                      </dd>
                    </div>
                  )}
                  {article.publicPublishApprovedBy && (
                    <div>
                      <dt className="font-medium text-zinc-600">승인자</dt>
                      <dd className="text-zinc-500">{article.publicPublishApprovedBy}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium text-zinc-600">WordPress draft post id</dt>
                    <dd className="text-zinc-500">{latestWordPressLog?.externalPostId ?? "해당 없음"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">WordPress draft post URL</dt>
                    <dd className="text-zinc-500 break-all">{latestWordPressLog?.postUrl || "해당 없음"}</dd>
                  </div>
                  {article.publicPublishApprovalNotes && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-zinc-600">메모</dt>
                      <dd className="text-zinc-500">{article.publicPublishApprovalNotes}</dd>
                    </div>
                  )}
                </dl>

                {article.publicPublishApprovalError && (
                  <p className="mt-3 text-xs text-red-600">오류: {article.publicPublishApprovalError}</p>
                )}

                {alreadyApproved && (
                  <p className="mt-3 text-xs font-medium text-indigo-700">
                    ℹ 승인이 완료되었습니다. 다음 단계에서 공개 게시가 가능합니다
                    (이 화면에서는 실제 공개 게시를 수행하지 않습니다).
                  </p>
                )}

                {!canApprove && !alreadyApproved && (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    ⚠ 아직 승인할 수 없습니다. publish_ready=true, publish_quality_gate_status=
                    ready_to_publish, WordPress draft post 존재 조건을 모두 만족해야 합니다.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approvePublicPublishAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <button
                      type="submit"
                      disabled={!canApprove}
                      className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      공개 게시 승인
                    </button>
                  </form>
                  <form action={revokePublicPublishApprovalAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <button
                      type="submit"
                      disabled={!alreadyApproved}
                      className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      공개 게시 승인 취소
                    </button>
                  </form>
                  <form action={checkPublicPublishApprovalStatusAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      승인 상태 새로고침
                    </button>
                  </form>
                </div>
              </>
            );
          })()}
        </section>

        {/* Phase 2-17: WordPress Public Publish Test */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">WordPress Public Publish Test</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PUBLIC_PUBLISH_STATUS_STYLE[article.publicPublishStatus]}`}
            >
              {PUBLIC_PUBLISH_STATUS_LABEL[article.publicPublishStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Publish Quality Gate와 Human Approval을 모두 통과한 기사 1개에
            한해, WordPress draft post를 <strong>실제 공개(publish) 상태로
            변경</strong>하는 테스트입니다. 자동 공개가 아니며, 아래 버튼을
            직접 눌러야만 실행됩니다. 여러 기사를 한 번에 공개하는 기능은
            제공하지 않습니다.
          </p>

          {(() => {
            const canPublishNow =
              article.publishReady &&
              article.publishQualityGateStatus === "ready_to_publish" &&
              article.publicPublishApprovalStatus === "approved" &&
              article.publicPublishApproved &&
              hasWordPressSuccess &&
              !article.publicPublished;

            return (
              <>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-600">publish_ready</dt>
                    <dd className={article.publishReady ? "font-medium text-green-700" : "text-zinc-500"}>
                      {article.publishReady ? "예" : "아니오"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">publish_quality_gate_status</dt>
                    <dd className="text-zinc-500">{article.publishQualityGateStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">public_publish_approval_status</dt>
                    <dd className="text-zinc-500">{article.publicPublishApprovalStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">public_publish_approved</dt>
                    <dd className={article.publicPublishApproved ? "font-medium text-green-700" : "text-zinc-500"}>
                      {article.publicPublishApproved ? "예" : "아니오"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">WordPress draft post id</dt>
                    <dd className="text-zinc-500">{latestWordPressLog?.externalPostId ?? "해당 없음"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-600">public_published</dt>
                    <dd className={article.publicPublished ? "font-medium text-green-700" : "text-zinc-500"}>
                      {article.publicPublished ? "예" : "아니오"}
                    </dd>
                  </div>
                  {article.publicPublishedAt && (
                    <div>
                      <dt className="font-medium text-zinc-600">공개 게시 시각</dt>
                      <dd className="text-zinc-500">
                        {new Date(article.publicPublishedAt).toLocaleString("ko-KR")}
                      </dd>
                    </div>
                  )}
                  {article.publicPublishUrl && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-zinc-600">공개된 글 URL</dt>
                      <dd className="text-zinc-500 break-all">
                        <a
                          href={article.publicPublishUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 underline"
                        >
                          {article.publicPublishUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>

                {article.publicPublishError && (
                  <p className="mt-3 text-xs text-red-600">오류: {article.publicPublishError}</p>
                )}

                {article.publicPublished && (
                  <p className="mt-3 text-xs font-medium text-green-700">
                    ✓ 이 기사는 이미 WordPress에 실제 공개(publish)되어 있습니다.
                    다시 공개 게시를 실행해도 중복 공개되지 않습니다.
                  </p>
                )}

                {!canPublishNow && !article.publicPublished && (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    ⚠ 아직 공개 게시할 수 없습니다. publish_ready=true,
                    publish_quality_gate_status=ready_to_publish,
                    public_publish_approval_status=approved,
                    public_publish_approved=true, WordPress draft post 존재
                    조건을 모두 만족해야 합니다.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={publishApprovedArticleToWordPressAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <ConfirmSubmitButton
                      disabled={!canPublishNow}
                      confirmMessage="이 작업은 WordPress 글을 실제 공개 상태로 변경합니다. 계속할까요?"
                      className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      WordPress 공개 게시 테스트 실행 (실제 공개 게시)
                    </ConfirmSubmitButton>
                  </form>
                  <form action={checkPublicPublishStatusAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      공개 게시 상태 새로고침
                    </button>
                  </form>
                </div>
              </>
            );
          })()}
        </section>

        {/* Phase 3-1: Multi-platform Writing */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Multi-platform Writing</h2>
          <p className="mt-1 text-xs text-zinc-500">
            이 기사를 WordPress 외 다른 플랫폼(네이버 블로그/카페, X,
            Threads, Instagram)용 글로 변환하는 기능입니다. &ldquo;플랫폼
            글 초안 생성&rdquo;은 platform/tone별 prompt·context·출력
            계약(contract) 구조를 조립해 결과를 생성하고 자동으로 quality
            gate까지 실행합니다. &ldquo;새 플랫폼 글 초안 생성 준비&rdquo;는
            구조 테스트용 placeholder draft만 만드는 더 단순한 버전입니다.
          </p>
          {isSocialAiGenerationEnabled() ? (
            <p className="mt-1 text-xs font-medium text-indigo-700">
              AI 생성 모드입니다 (SOCIAL_AI_GENERATION_ENABLED=true). 실제
              Claude API로 초안을 생성합니다 — 게시 전 반드시 사람의 승인이
              필요하며, 생성된 글은 아직 어디에도 실제로 게시되지 않습니다.
            </p>
          ) : (
            <p className="mt-1 text-xs font-medium text-amber-700">
              현재 mock/dry-run 생성 모드입니다 (SOCIAL_AI_GENERATION_ENABLED=false).
              실제 AI 호출 없이 구조 검증용 mock 결과만 생성합니다. 생성된
              글은 아직 어디에도 실제로 게시되지 않습니다.
            </p>
          )}

          <form action={generatePlaceholderSocialPostAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="articleId" value={article.id} />
            <label className="flex flex-col text-xs text-zinc-600">
              platform
              <select name="platform" className="mt-1 rounded border border-zinc-300 px-2 py-1 text-xs" required>
                {SOCIAL_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-zinc-600">
              tone_style
              <select name="toneStyle" className="mt-1 rounded border border-zinc-300 px-2 py-1 text-xs" required>
                {TONE_STYLES.map((toneStyle) => (
                  <option key={toneStyle} value={toneStyle}>
                    {toneStyle}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              formAction={generateSocialDraftAction}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              플랫폼 글 초안 생성
            </button>
            <button
              type="submit"
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              새 플랫폼 글 초안 생성 준비
            </button>
          </form>
          <form action={refreshSocialPostsAction} className="mt-2">
            <input type="hidden" name="articleId" value={article.id} />
            <button
              type="submit"
              className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              목록 새로고침
            </button>
          </form>

          {/* Phase 3-9: article-level 성과 요약 */}
          {socialPosts.length > 0 && (
            <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
              <p className="font-medium text-zinc-600">성과 요약 (내부 비교용, 외부 API 미연동)</p>
              <p className="mt-1 text-zinc-500">
                측정됨: {articlePerformanceSummary.postsMeasuredCount}개 · 미측정:{" "}
                {articlePerformanceSummary.postsNotMeasuredCount}개 · best platform:{" "}
                {articlePerformanceSummary.bestPlatform ?? "-"} · best tone_style:{" "}
                {articlePerformanceSummary.bestToneStyle ?? "-"}
              </p>
              {Object.keys(articlePerformanceSummary.byPlatform).length > 0 && (
                <p className="mt-1 text-zinc-500">
                  플랫폼별 최고 점수:{" "}
                  {Object.entries(articlePerformanceSummary.byPlatform)
                    .map(([platform, score]) => `${platform}=${score ?? "-"}`)
                    .join(", ")}
                </p>
              )}
              {Object.keys(articlePerformanceSummary.byToneStyle).length > 0 && (
                <p className="mt-1 text-zinc-500">
                  문체별 최고 점수:{" "}
                  {Object.entries(articlePerformanceSummary.byToneStyle)
                    .map(([tone, score]) => `${tone}=${score ?? "-"}`)
                    .join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Phase 3-14: Rewrite 성과 비교 요약 */}
          {articleRewritePerformanceSummary.totalComparisons > 0 && (
            <div className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-2 text-xs">
              <p className="font-medium text-indigo-700">Rewrite 성과 비교 요약</p>
              <p className="mt-1 text-indigo-700">
                전체 비교 {articleRewritePerformanceSummary.totalComparisons}건 · Rewrite 승리{" "}
                {articleRewritePerformanceSummary.rewriteWonCount}개 · 원본 승리 {articleRewritePerformanceSummary.originalWonCount}
                개 · 비슷함 {articleRewritePerformanceSummary.similarCount}개 · 데이터 부족{" "}
                {articleRewritePerformanceSummary.needsMoreDataCount}개
              </p>
              <p className="mt-1 text-indigo-700">
                평균 performance_score delta: {articleRewritePerformanceSummary.averagePerformanceScoreDelta?.toFixed(2) ?? "-"} · 평균
                개선율:{" "}
                {articleRewritePerformanceSummary.averageImprovementRate !== null
                  ? `${(articleRewritePerformanceSummary.averageImprovementRate * 100).toFixed(1)}%`
                  : "-"}
              </p>
              {articleRewritePerformanceSummary.bestRewriteSocialPostId && (
                <p className="mt-1 text-indigo-700">
                  최고 rewrite version:{" "}
                  <a
                    href={`#social-post-${articleRewritePerformanceSummary.bestRewriteSocialPostId}`}
                    className="underline hover:no-underline"
                  >
                    {articleRewritePerformanceSummary.bestRewriteSocialPostId}
                  </a>{" "}
                  ({articleRewritePerformanceSummary.bestPlatform} / {articleRewritePerformanceSummary.bestToneStyle} · delta{" "}
                  {articleRewritePerformanceSummary.bestPerformanceScoreDelta?.toFixed(2) ?? "-"})
                </p>
              )}
              <p className="mt-1 text-indigo-400">
                이 요약은 수동 입력된 metrics를 기반으로 한 참고 지표이며, 자동 재게시나 자동 수정으로 이어지지 않습니다.
              </p>
            </div>
          )}

          {socialPosts.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">아직 생성된 social post가 없습니다.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {socialPosts.map((post) => (
                <li
                  key={post.id}
                  id={`social-post-${post.id}`}
                  className={`rounded border p-3 text-xs ${
                    highlightedSocialPostId === post.id ? "border-indigo-400 ring-2 ring-indigo-300" : "border-zinc-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{post.platform}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600">{post.toneStyle}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${SOCIAL_QUALITY_STATUS_STYLE[post.qualityStatus] ?? "bg-zinc-100 text-zinc-500"}`}
                    >
                      quality: {post.qualityStatus}
                      {post.qualityScore != null ? ` (${post.qualityScore})` : ""}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${SOCIAL_APPROVAL_STATUS_STYLE[post.approvalStatus] ?? "bg-zinc-100 text-zinc-500"}`}
                    >
                      approval: {post.approvalStatus}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${SOCIAL_PUBLISH_STATUS_STYLE[post.publishStatus] ?? "bg-zinc-100 text-zinc-500"}`}
                    >
                      publish: {post.publishStatus}
                    </span>
                  </div>

                  <p className="mt-1 text-zinc-700">
                    {post.postTitle || post.caption || "(제목/캡션 없음)"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    생성: {post.generatedAt ? new Date(post.generatedAt).toLocaleString("ko-KR") : "-"} · 수정:{" "}
                    {post.editedAt ? new Date(post.editedAt).toLocaleString("ko-KR") : "-"} · 수정횟수:{" "}
                    {post.revisionCount} · 승인:{" "}
                    {post.approvedAt ? new Date(post.approvedAt).toLocaleString("ko-KR") : "-"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    버전: v{post.versionNumber} ({post.versionStatus}){post.isRewriteVersion ? " · rewrite 버전" : " · 원본"}
                    {post.rewriteAppliedAt
                      ? ` · rewrite 적용: ${new Date(post.rewriteAppliedAt).toLocaleString("ko-KR")} by ${post.rewriteAppliedBy ?? "-"}`
                      : ""}
                    {post.isRewriteVersion
                      ? ` · 비교: ${post.versionComparisonStatus}${post.versionComparisonScore != null ? ` (${post.versionComparisonScore}점)` : ""}`
                      : ""}
                    {post.recommendedForRepost && (
                      <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-700">재게시 후보</span>
                    )}
                  </p>

                  {/* Phase 3-11/3-12/3-13: Version History (+ 비교/재승인/재export 상태) */}
                  {(() => {
                    const chain = versionChainByPostId.get(post.id) ?? [];
                    if (chain.length <= 1) return null;
                    return (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-zinc-400">버전 이력 보기 ({chain.length}개)</summary>
                        <ul className="mt-1 flex flex-col gap-1 text-[11px] text-zinc-500">
                          {chain.map((v) => (
                            <li key={v.id} className={v.id === post.id ? "font-medium text-zinc-700" : ""}>
                              v{v.versionNumber} ({v.versionStatus}) — {v.postTitle || v.caption || "(제목 없음)"}
                              {v.isRewriteVersion
                                ? ` · quality: ${v.qualityStatus === "not_checked" ? "재검사 필요" : v.qualityStatus} · 비교: ${
                                    v.versionComparisonStatus === "not_compared" ? "비교 필요" : v.versionComparisonStatus
                                  } · 재승인: ${v.rewriteReapprovalStatus} · 재export: ${v.rewriteReexportStatus} · workflow: ${v.rewriteRepublishWorkflowStatus}`
                                : ""}
                              {v.recommendedForRepost ? " · 재게시 후보" : ""}
                              {v.rewriteReapprovalStatus === "pending_review" ? " · 재승인 대기" : ""}
                              {v.rewriteReexportStatus === "exported" ? " · 재Export 완료" : ""}
                              {v.handoffStatus === "completed" ? " · Handoff 완료" : ""}
                              {v.manualPostStatus === "posted" ? " · 수동 재게시 기록 완료" : ""}
                              {v.postUrl ? ` · URL: ${v.postUrl}` : ""}
                              {v.latestPerformanceScore != null ? ` · 성과: ${v.latestPerformanceScore}점` : ""}
                              {v.id === post.id ? " ← 현재 카드" : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  })()}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-zinc-500">상세 보기 / 수정</summary>
                    <div className="mt-2 flex flex-col gap-1 rounded bg-zinc-50 p-2">
                      <div>
                        <p className="font-medium text-zinc-600">플랫폼 미리보기 ({post.platform})</p>
                        {(() => {
                          const preview = formatSocialPostPreview(post);
                          return (
                            <div className="mt-1 flex flex-col gap-1 rounded border border-zinc-200 bg-white p-2">
                              <p className="font-medium text-zinc-700">{preview.heading}</p>
                              {preview.lines.map((line, i) => (
                                <p key={i} className="whitespace-pre-wrap text-zinc-600">
                                  <span className="font-medium text-zinc-500">{line.label}: </span>
                                  {line.value || "(없음)"}
                                </p>
                              ))}
                              {preview.highlights.length > 0 && (
                                <div className="text-blue-600">
                                  <p className="font-medium">질문/토론 유도 문장:</p>
                                  <ul className="list-inside list-disc">
                                    {preview.highlights.map((h, i) => (
                                      <li key={i}>{h}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      {post.postBody && <p className="whitespace-pre-wrap text-zinc-600">{post.postBody}</p>}
                      {post.threadItems.length > 0 && (
                        <ul className="list-inside list-decimal text-zinc-600">
                          {post.threadItems.map((item) => (
                            <li key={item.order}>{item.text}</li>
                          ))}
                        </ul>
                      )}
                      {post.cardItems.length > 0 && (
                        <ul className="flex flex-col gap-1 text-zinc-600">
                          {post.cardItems.map((item) => (
                            <li key={item.order}>
                              <strong>{item.heading}</strong>: {item.body}
                            </li>
                          ))}
                        </ul>
                      )}
                      {post.hashtags.length > 0 && (
                        <p className="text-zinc-500">해시태그: {post.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
                      )}
                      {post.reviewNotes && <p className="text-zinc-500">검토 메모: {post.reviewNotes}</p>}
                      {post.rejectionReason && <p className="text-red-600">반려 사유: {post.rejectionReason}</p>}
                      {post.revokedReason && <p className="text-amber-700">승인 취소 사유: {post.revokedReason}</p>}
                      {typeof post.generationContext.contractName === "string" && (
                        <p className="text-zinc-400">
                          출력 계약: {post.generationContext.contractName}
                          {post.generationContext.mock ? " (mock 생성)" : " (AI 생성)"}
                        </p>
                      )}
                      {Array.isArray((post.qualitySummary as { blockedReasons?: unknown }).blockedReasons) &&
                        ((post.qualitySummary as { blockedReasons: string[] }).blockedReasons.length > 0) && (
                          <div className="text-red-600">
                            <p className="font-medium">차단 사유:</p>
                            <ul className="list-inside list-disc">
                              {(post.qualitySummary as { blockedReasons: string[] }).blockedReasons.map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {Array.isArray((post.qualitySummary as { warnings?: unknown }).warnings) &&
                        ((post.qualitySummary as { warnings: string[] }).warnings.length > 0) && (
                          <div className="text-amber-700">
                            <p className="font-medium">경고:</p>
                            <ul className="list-inside list-disc">
                              {(post.qualitySummary as { warnings: string[] }).warnings.map((warning, i) => (
                                <li key={i}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {Object.keys(post.exportPayload).length > 0 && (
                        <div className="text-zinc-500">
                          <p className="font-medium text-zinc-600">export payload ({post.exportFormat}):</p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-zinc-100 p-1 text-[10px]">
                            {JSON.stringify(post.exportPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {post.errorMessage && <p className="text-red-600">오류: {post.errorMessage}</p>}

                      {/* Phase 3-4: 편집 폼. platform은 변경할 수 없다. */}
                      <form action={editSocialPostAction} className="mt-2 flex flex-col gap-1 rounded border border-zinc-200 bg-white p-2">
                        <input type="hidden" name="articleId" value={article.id} />
                        <input type="hidden" name="socialPostId" value={post.id} />
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          post_title
                          <input
                            name="postTitle"
                            defaultValue={post.postTitle ?? ""}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          post_body
                          <textarea
                            name="postBody"
                            defaultValue={post.postBody ?? ""}
                            rows={4}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          caption
                          <textarea
                            name="caption"
                            defaultValue={post.caption ?? ""}
                            rows={2}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          excerpt
                          <textarea
                            name="excerpt"
                            defaultValue={post.excerpt ?? ""}
                            rows={2}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          hashtags (comma-separated)
                          <input
                            name="hashtags"
                            defaultValue={post.hashtags.join(", ")}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          thread_items (JSON: [{"{"}&quot;order&quot;:1,&quot;text&quot;:&quot;...&quot;{"}"}])
                          <textarea
                            name="threadItems"
                            defaultValue={post.threadItems.length > 0 ? JSON.stringify(post.threadItems) : ""}
                            rows={2}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          card_items (JSON: [{"{"}&quot;order&quot;:1,&quot;heading&quot;:&quot;...&quot;,&quot;body&quot;:&quot;...&quot;{"}"}])
                          <textarea
                            name="cardItems"
                            defaultValue={post.cardItems.length > 0 ? JSON.stringify(post.cardItems) : ""}
                            rows={2}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
                          />
                        </label>
                        <label className="flex flex-col text-[11px] text-zinc-500">
                          review_notes
                          <textarea
                            name="reviewNotes"
                            defaultValue={post.reviewNotes ?? ""}
                            rows={1}
                            className="mt-0.5 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        {post.approvalStatus === "approved" && (
                          <p className="text-amber-700">
                            이미 승인된 글입니다. 수정하면 승인이 초기화되어(not_requested) 재승인이
                            필요합니다.
                          </p>
                        )}
                        {post.publishStatus === "published" && (
                          <p className="text-red-600">이미 게시된 글은 수정할 수 없습니다.</p>
                        )}
                        <button
                          type="submit"
                          disabled={post.publishStatus === "published"}
                          className="mt-1 w-fit rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          수정 저장
                        </button>
                      </form>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <form action={runSocialPostQualityGateAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Quality Gate 재실행
                          </button>
                        </form>
                        <form action={requestSocialPostApprovalAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            disabled={post.approvalStatus === "approved"}
                            className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            승인 요청
                          </button>
                        </form>
                        <form action={approveSocialPostAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            disabled={
                              post.qualityStatus !== "ready" ||
                              post.approvalStatus === "approved" ||
                              post.publishStatus === "blocked" ||
                              post.publishStatus === "published"
                            }
                            className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            승인
                          </button>
                        </form>
                        <form action={rejectSocialPostAction} className="flex items-center gap-1">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input
                            name="reason"
                            placeholder="반려 사유"
                            required
                            className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                          />
                          <button
                            type="submit"
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                          >
                            반려
                          </button>
                        </form>
                        <form action={revokeSocialPostApprovalAction} className="flex items-center gap-1">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <input
                            name="reason"
                            placeholder="승인 취소 사유"
                            required
                            className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                          />
                          <button
                            type="submit"
                            disabled={post.approvalStatus !== "approved"}
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            승인 취소
                          </button>
                        </form>
                        <form action={generateManualExportAction}>
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            disabled={post.qualityStatus !== "ready" || post.approvalStatus !== "approved"}
                            className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Manual Export 생성
                          </button>
                        </form>
                      </div>

                      {/* Phase 3-5: Manual Export & Copy */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Manual Export &amp; Copy</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 단계는 실제 게시가 아니라 수동 게시용 복사 기능입니다. 각 플랫폼에
                          게시하기 전 최종 내용, 이미지, 링크, 정책 위반 가능성을 확인하세요.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          export_status: <span className="font-mono">{post.exportStatus}</span>
                          {post.exportFormat ? ` · format: ${post.exportFormat}` : ""} · 복사 횟수:{" "}
                          {post.exportCopyCount}
                          {post.exportedAt ? ` · export: ${new Date(post.exportedAt).toLocaleString("ko-KR")}` : ""}
                          {post.lastCopiedAt
                            ? ` · 마지막 복사: ${new Date(post.lastCopiedAt).toLocaleString("ko-KR")}`
                            : ""}
                        </p>
                        {post.exportError && <p className="mt-1 text-red-600">export 오류: {post.exportError}</p>}

                        {(() => {
                          const exportPreview = buildManualExportPayload(post);
                          const canCopy = post.exportStatus === "exported" && exportPreview.ok;
                          const platformNotices: Partial<Record<typeof post.platform, string>> = {
                            naver_cafe: "카페 규칙과 홍보성 게시 제한을 반드시 확인하세요.",
                            instagram: "이미지 또는 카드뉴스 디자인이 필요합니다.",
                            x: "각 스레드의 글자 수를 확인하세요.",
                          };
                          const notice = platformNotices[post.platform];

                          return (
                            <div className="mt-2 flex flex-col gap-1">
                              {notice && <p className="text-amber-700">⚠ {notice}</p>}
                              {exportPreview.instructions?.map((line, i) => (
                                <p key={i} className="text-zinc-500">
                                  안내: {line}
                                </p>
                              ))}
                              {exportPreview.warnings?.map((line, i) => (
                                <p key={i} className="text-amber-700">
                                  경고: {line}
                                </p>
                              ))}
                              {!exportPreview.ok && <p className="text-red-600">{exportPreview.error}</p>}

                              <div className="mt-1 flex flex-wrap gap-2">
                                {exportPreview.exportText && (
                                  <form action={recordSocialPostCopiedAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="copyTarget" value="all" />
                                    <CopyToClipboardButton
                                      text={exportPreview.exportText}
                                      disabled={!canCopy}
                                      className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      전체 복사
                                    </CopyToClipboardButton>
                                  </form>
                                )}
                                {exportPreview.exportTitle && (
                                  <form action={recordSocialPostCopiedAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="copyTarget" value="title" />
                                    <CopyToClipboardButton
                                      text={exportPreview.exportTitle}
                                      disabled={!canCopy}
                                      className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      제목 복사
                                    </CopyToClipboardButton>
                                  </form>
                                )}
                                {exportPreview.exportBody && (
                                  <form action={recordSocialPostCopiedAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="copyTarget" value="body" />
                                    <CopyToClipboardButton
                                      text={exportPreview.exportBody}
                                      disabled={!canCopy}
                                      className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      본문 복사
                                    </CopyToClipboardButton>
                                  </form>
                                )}
                                {exportPreview.exportCaption && (
                                  <form action={recordSocialPostCopiedAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="copyTarget" value="caption" />
                                    <CopyToClipboardButton
                                      text={exportPreview.exportCaption}
                                      disabled={!canCopy}
                                      className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      캡션 복사
                                    </CopyToClipboardButton>
                                  </form>
                                )}
                                {exportPreview.exportHashtags && exportPreview.exportHashtags.length > 0 && (
                                  <form action={recordSocialPostCopiedAction}>
                                    <input type="hidden" name="articleId" value={article.id} />
                                    <input type="hidden" name="socialPostId" value={post.id} />
                                    <input type="hidden" name="copyTarget" value="hashtags" />
                                    <CopyToClipboardButton
                                      text={exportPreview.exportHashtags.map((tag) => `#${tag}`).join(" ")}
                                      disabled={!canCopy}
                                      className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      해시태그 복사
                                    </CopyToClipboardButton>
                                  </form>
                                )}
                              </div>

                              {exportPreview.exportThreadItems && exportPreview.exportThreadItems.length > 0 && (
                                <div className="mt-1 flex flex-col gap-1">
                                  <p className="text-zinc-500">스레드별 복사:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {exportPreview.exportThreadItems.map((text, i) => (
                                      <form key={i} action={recordSocialPostCopiedAction}>
                                        <input type="hidden" name="articleId" value={article.id} />
                                        <input type="hidden" name="socialPostId" value={post.id} />
                                        <input type="hidden" name="copyTarget" value={`thread_${i + 1}`} />
                                        <CopyToClipboardButton
                                          text={text}
                                          disabled={!canCopy}
                                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          #{i + 1} 복사 ({text.length}자)
                                        </CopyToClipboardButton>
                                      </form>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {exportPreview.exportCardItems && exportPreview.exportCardItems.length > 0 && (
                                <div className="mt-1 flex flex-col gap-1">
                                  <p className="text-zinc-500">카드뉴스 문구 복사:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {exportPreview.exportCardItems.map((item, i) => (
                                      <form key={i} action={recordSocialPostCopiedAction}>
                                        <input type="hidden" name="articleId" value={article.id} />
                                        <input type="hidden" name="socialPostId" value={post.id} />
                                        <input type="hidden" name="copyTarget" value={`card_${i + 1}`} />
                                        <CopyToClipboardButton
                                          text={`${item.heading}\n${item.body}`}
                                          disabled={!canCopy}
                                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          slide {item.order} 복사
                                        </CopyToClipboardButton>
                                      </form>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Phase 3-6: Platform Publishing Guard */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Platform Publishing Guard</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 검사는 실제 게시가 아니라 게시 가능 조건 검사입니다. 통과해도 실제
                          게시 API는 호출되지 않습니다. 플랫폼별 정책과 최종 내용은 사람이 다시
                          확인해야 합니다.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          guard: <span className="font-mono">{post.platformPublishGuardStatus}</span>
                          {post.platformPublishGuardScore != null ? ` (${post.platformPublishGuardScore}점)` : ""} ·
                          게시 가능: {post.platformPublishReady ? "예" : "아니오"}
                          {post.platformPublishGuardCheckedAt
                            ? ` · 검사: ${new Date(post.platformPublishGuardCheckedAt).toLocaleString("ko-KR")}`
                            : ""}
                        </p>
                        {post.platformPublishBlockedReason && (
                          <p className="mt-1 text-red-600">차단 사유: {post.platformPublishBlockedReason}</p>
                        )}
                        {post.platformPublishGuardError && (
                          <p className="mt-1 text-red-600">오류: {post.platformPublishGuardError}</p>
                        )}
                        {(post.approvalStatus !== "approved" ||
                          post.qualityStatus !== "ready" ||
                          (post.exportStatus !== "ready" && post.exportStatus !== "exported")) && (
                          <p className="mt-1 text-amber-700">
                            ⚠ approval/quality/export 상태가 아직 게시 가능 조건을 만족하지 않습니다.
                          </p>
                        )}
                        {Array.isArray((post.platformPublishGuardSummary as { blockedReasons?: unknown }).blockedReasons) &&
                          (post.platformPublishGuardSummary as { blockedReasons: string[] }).blockedReasons.length > 0 && (
                            <div className="mt-1 text-red-600">
                              <p className="font-medium">차단 사유 목록:</p>
                              <ul className="list-inside list-disc">
                                {(post.platformPublishGuardSummary as { blockedReasons: string[] }).blockedReasons.map((reason, i) => (
                                  <li key={i}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {Array.isArray((post.platformPublishGuardSummary as { failures?: unknown }).failures) &&
                          (post.platformPublishGuardSummary as { failures: string[] }).failures.length > 0 && (
                            <div className="mt-1 text-orange-600">
                              <p className="font-medium">수정 필요:</p>
                              <ul className="list-inside list-disc">
                                {(post.platformPublishGuardSummary as { failures: string[] }).failures.map((reason, i) => (
                                  <li key={i}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {Array.isArray((post.platformPublishGuardSummary as { warnings?: unknown }).warnings) &&
                          (post.platformPublishGuardSummary as { warnings: string[] }).warnings.length > 0 && (
                            <div className="mt-1 text-amber-700">
                              <p className="font-medium">경고:</p>
                              <ul className="list-inside list-disc">
                                {(post.platformPublishGuardSummary as { warnings: string[] }).warnings.map((warning, i) => (
                                  <li key={i}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        <form action={runPlatformPublishingGuardAction} className="mt-2">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            {post.platformPublishGuardStatus === "not_checked" ? "게시 가능성 검사 실행" : "Guard 재실행"}
                          </button>
                        </form>
                      </div>

                      {/* Phase 3-7: Platform Publish Dry-run & Export Handoff */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Platform Publish Dry-run &amp; Handoff</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 단계는 실제 게시가 아니라 게시 직전 dry-run payload 생성입니다. Handoff
                          완료는 실제 게시 완료가 아니라, 사람이 수동 게시할 준비가 끝났다는
                          의미입니다. 각 플랫폼에 게시하기 전 최종 내용, 이미지, 링크, 정책 위반
                          가능성을 확인하세요.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          dry-run: <span className="font-mono">{post.platformPublishDryRunStatus}</span>
                          {post.platformPublishDryRunCreatedAt
                            ? ` (${new Date(post.platformPublishDryRunCreatedAt).toLocaleString("ko-KR")})`
                            : ""}{" "}
                          · handoff: <span className="font-mono">{post.handoffStatus}</span>
                          {post.handoffCompletedAt
                            ? ` (${new Date(post.handoffCompletedAt).toLocaleString("ko-KR")} by ${post.handoffCompletedBy ?? "-"})`
                            : ""}
                        </p>
                        {post.handoffNotes && <p className="mt-1 text-zinc-500">handoff 메모: {post.handoffNotes}</p>}
                        {post.platformPublishDryRunError && (
                          <p className="mt-1 text-red-600">dry-run 오류: {post.platformPublishDryRunError}</p>
                        )}
                        {post.handoffError && <p className="mt-1 text-red-600">handoff 오류: {post.handoffError}</p>}

                        {post.platformPublishDryRunStatus === "ready" &&
                          (() => {
                            const preview = formatPlatformPublishDryRunPreview(post);
                            return (
                              <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                                <p className="font-medium text-zinc-600">{preview.heading}</p>
                                {preview.lines.map((line, i) => (
                                  <p key={i} className="mt-1 whitespace-pre-wrap text-zinc-600">
                                    <span className="font-medium text-zinc-500">{line.label}: </span>
                                    {line.value || "(없음)"}
                                  </p>
                                ))}
                              </div>
                            );
                          })()}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <form action={createPlatformPublishDryRunAction}>
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <button
                              type="submit"
                              disabled={
                                !post.platformPublishReady ||
                                post.platformPublishGuardStatus !== "ready" ||
                                post.approvalStatus !== "approved" ||
                                (post.exportStatus !== "ready" && post.exportStatus !== "exported") ||
                                post.publishStatus === "published"
                              }
                              className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {post.platformPublishDryRunStatus === "not_created" ? "Publish Dry-run 생성" : "Dry-run 재생성"}
                            </button>
                          </form>
                          <form action={completePlatformExportHandoffAction} className="flex items-center gap-1">
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <input
                              name="notes"
                              placeholder="handoff 메모 (선택)"
                              className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                            <button
                              type="submit"
                              disabled={post.platformPublishDryRunStatus !== "ready" || post.publishStatus === "published"}
                              className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Handoff 완료 처리
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Phase 3-8: Manual Posting Result */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Manual Posting Result</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 단계는 자동 게시가 아니라, 사람이 수동으로 게시한 결과를 기록하는
                          기능입니다. 게시 URL을 입력하면 시스템에서 해당 플랫폼 게시 완료 상태로
                          관리합니다. 잘못 기록한 경우 이후 수정/취소 기능을 별도 단계에서 구현할
                          수 있습니다.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          manual_post: <span className="font-mono">{post.manualPostStatus}</span> · publish_status:{" "}
                          <span className="font-mono">{post.publishStatus}</span>
                          {post.manualPostedAt
                            ? ` · 게시: ${new Date(post.manualPostedAt).toLocaleString("ko-KR")} by ${post.manualPostedBy ?? "-"}`
                            : ""}
                        </p>
                        {post.manualPostUrl && (
                          <p className="mt-1 break-all text-zinc-600">
                            게시 URL:{" "}
                            <a href={post.manualPostUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                              {post.manualPostUrl}
                            </a>
                          </p>
                        )}
                        {post.manualPostResultNotes && <p className="mt-1 text-zinc-500">메모: {post.manualPostResultNotes}</p>}
                        {post.manualPostError && <p className="mt-1 text-red-600">오류: {post.manualPostError}</p>}
                        {post.manualPostStatus === "posted" && (
                          <p className="mt-1 text-amber-700">
                            ⚠ 이미 게시 완료로 기록되어 있습니다. 다시 기록하면 중복 기록이 됩니다.
                          </p>
                        )}
                        {post.handoffStatus !== "completed" && (
                          <p className="mt-1 text-amber-700">⚠ handoff가 완료되지 않아 기록 버튼이 비활성화됩니다.</p>
                        )}
                        {post.manualPostChecklist.length > 0 && (
                          <ul className="mt-1 list-inside list-disc text-zinc-500">
                            {post.manualPostChecklist.map((item, i) => (
                              <li key={i}>{String((item as { label?: unknown }).label ?? "")}</li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <form action={prepareManualPostingRecordAction}>
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <button
                              type="submit"
                              disabled={post.handoffStatus !== "completed"}
                              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              수동 게시 체크리스트 준비
                            </button>
                          </form>
                        </div>

                        <form action={recordManualPostingResultAction} className="mt-2 flex flex-col gap-1">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <div className="flex flex-wrap gap-2">
                            <input
                              name="manualPostUrl"
                              placeholder="게시 URL (https://...)"
                              className="min-w-[220px] flex-1 rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                            <input
                              name="manualPostedAt"
                              type="datetime-local"
                              className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                            <input
                              name="manualPostedBy"
                              placeholder="게시자"
                              className="w-24 rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                          </div>
                          <input
                            name="notes"
                            placeholder="메모 (선택)"
                            className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                          />
                          <button
                            type="submit"
                            disabled={post.handoffStatus !== "completed"}
                            className="w-fit rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            수동 게시 완료 기록
                          </button>
                        </form>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <form action={markManualPostingFailedAction} className="flex items-center gap-1">
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <input
                              name="reason"
                              placeholder="실패 사유"
                              className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                            <button
                              type="submit"
                              disabled={post.handoffStatus !== "completed"}
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              수동 게시 실패 기록
                            </button>
                          </form>
                          <form action={markManualPostingSkippedAction} className="flex items-center gap-1">
                            <input type="hidden" name="articleId" value={article.id} />
                            <input type="hidden" name="socialPostId" value={post.id} />
                            <input
                              name="reason"
                              placeholder="스킵 사유"
                              className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                            />
                            <button
                              type="submit"
                              disabled={post.handoffStatus !== "completed"}
                              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              수동 게시 스킵 기록
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Phase 3-9: Performance Metrics */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Performance Metrics</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 단계는 외부 API 자동 수집이 아니라 수동 입력입니다. 플랫폼에서
                          확인한 수치를 입력하면 내부 비교용 성과 점수를 계산합니다. 성과
                          점수는 절대적인 마케팅 지표가 아니라 플랫폼/문체 비교를 위한 내부
                          기준입니다.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          performance_status: <span className="font-mono">{post.performanceStatus}</span>
                          {post.latestPerformanceScore != null ? ` (${post.latestPerformanceScore}점)` : ""}
                          {post.latestMetricsRecordedAt
                            ? ` · 측정: ${new Date(post.latestMetricsRecordedAt).toLocaleString("ko-KR")}`
                            : ""}
                        </p>
                        {post.latestMetricsRecordedAt && (
                          <p className="mt-1 text-zinc-500">
                            views {post.latestViews} · impressions {post.latestImpressions} · likes {post.latestLikes} ·
                            comments {post.latestComments} · shares {post.latestShares} · saves {post.latestSaves} ·
                            clicks {post.latestClicks} · engagement{" "}
                            {post.latestEngagementRate != null ? `${(post.latestEngagementRate * 100).toFixed(1)}%` : "-"} · CTR{" "}
                            {post.latestClickThroughRate != null ? `${(post.latestClickThroughRate * 100).toFixed(1)}%` : "-"}
                          </p>
                        )}
                        {post.manualPostStatus !== "posted" && (
                          <p className="mt-1 text-amber-700">
                            ⚠ manual_post_status가 &apos;posted&apos;가 아닙니다. 아직 게시되지 않았을 수 있습니다.
                          </p>
                        )}

                        <form action={recordSocialPostMetricsAction} className="mt-2 flex flex-col gap-1">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <div className="flex flex-wrap gap-2">
                            <input name="measuredAt" type="datetime-local" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                            <input name="recordedBy" placeholder="입력자" className="w-24 rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[
                              ["views", "조회수"],
                              ["impressions", "노출수"],
                              ["reach", "도달"],
                              ["likes", "좋아요"],
                              ["comments", "댓글"],
                              ["shares", "공유"],
                              ["saves", "저장"],
                              ["clicks", "클릭"],
                              ["profileVisits", "프로필방문"],
                              ["follows", "팔로우"],
                              ["conversionCount", "전환"],
                            ].map(([name, label]) => (
                              <label key={name} className="flex flex-col text-[10px] text-zinc-500">
                                {label}
                                <input
                                  name={name}
                                  type="number"
                                  min={0}
                                  className="mt-0.5 w-16 rounded border border-zinc-300 px-1 py-1 text-[11px]"
                                />
                              </label>
                            ))}
                          </div>
                          <input name="notes" placeholder="메모 (선택)" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                          <button
                            type="submit"
                            className="mt-1 w-fit rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Metrics 저장
                          </button>
                        </form>

                        <form action={refreshSocialPostMetricsAction} className="mt-2">
                          <input type="hidden" name="articleId" value={article.id} />
                          <button
                            type="submit"
                            className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            최신 Metrics 새로고침
                          </button>
                        </form>

                        {(() => {
                          const history = socialPostMetricsHistoryById.get(post.id) ?? [];
                          if (history.length === 0) return null;
                          return (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-zinc-500">Metrics 이력 보기 ({history.length}건)</summary>
                              <div className="mt-1 overflow-x-auto">
                                <table className="w-full text-left text-[10px]">
                                  <thead>
                                    <tr className="text-zinc-500">
                                      <th className="pr-2">measured_at</th>
                                      <th className="pr-2">views</th>
                                      <th className="pr-2">impressions</th>
                                      <th className="pr-2">likes</th>
                                      <th className="pr-2">comments</th>
                                      <th className="pr-2">shares</th>
                                      <th className="pr-2">saves</th>
                                      <th className="pr-2">clicks</th>
                                      <th className="pr-2">engagement</th>
                                      <th className="pr-2">score</th>
                                      <th className="pr-2">recorded_by</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.map((m) => (
                                      <tr key={m.id} className="text-zinc-600">
                                        <td className="pr-2">{new Date(m.measuredAt).toLocaleString("ko-KR")}</td>
                                        <td className="pr-2">{m.views}</td>
                                        <td className="pr-2">{m.impressions}</td>
                                        <td className="pr-2">{m.likes}</td>
                                        <td className="pr-2">{m.comments}</td>
                                        <td className="pr-2">{m.shares}</td>
                                        <td className="pr-2">{m.saves}</td>
                                        <td className="pr-2">{m.clicks}</td>
                                        <td className="pr-2">{m.engagementRate != null ? `${(m.engagementRate * 100).toFixed(1)}%` : "-"}</td>
                                        <td className="pr-2">{m.performanceScore ?? "-"}</td>
                                        <td className="pr-2">{m.recordedBy ?? "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          );
                        })()}
                      </div>

                      {/* Phase 3-10: Performance Rewrite Suggestion */}
                      <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                        <p className="font-medium text-zinc-600">Performance Rewrite Suggestion</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          이 제안은 자동으로 적용되지 않습니다. 기존 글은 그대로 유지되며, 사람이
                          승인하기 전까지 어떤 내용도 바뀌지 않습니다. 실제 재게시도 이 단계에서
                          수행하지 않습니다.
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          rewrite_suggestion: <span className="font-mono">{post.rewriteSuggestionStatus}</span> · 생성 횟수:{" "}
                          {post.rewriteSuggestionCount}
                          {post.latestRewriteSuggestedAt
                            ? ` · 최근 생성: ${new Date(post.latestRewriteSuggestedAt).toLocaleString("ko-KR")}`
                            : ""}
                        </p>
                        {(post.performanceStatus === "good" || post.performanceStatus === "excellent") && (
                          <p className="mt-1 text-zinc-500">
                            성과가 나쁘지 않지만, 추가 개선을 원하시면 제안을 생성할 수 있습니다.
                          </p>
                        )}
                        {post.performanceStatus === "not_measured" && (
                          <p className="mt-1 text-amber-700">
                            ⚠ 아직 성과 지표가 입력되지 않았습니다 — metrics 없이도 구조적 개선
                            제안은 생성되지만 정확도가 낮을 수 있습니다.
                          </p>
                        )}

                        <form action={generatePerformanceRewriteSuggestionAction} className="mt-2">
                          <input type="hidden" name="articleId" value={article.id} />
                          <input type="hidden" name="socialPostId" value={post.id} />
                          <button
                            type="submit"
                            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            개선 제안 생성
                          </button>
                        </form>

                        {(() => {
                          const suggestions = socialPostRewriteSuggestionsById.get(post.id) ?? [];
                          if (suggestions.length === 0) return null;
                          return (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-zinc-500">개선 제안 목록 보기 ({suggestions.length}건)</summary>
                              <ul className="mt-1 flex flex-col gap-2">
                                {suggestions.map((s) => (
                                  <li key={s.id} className="rounded border border-zinc-200 bg-zinc-50 p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                                        status: {s.suggestionStatus}
                                      </span>
                                      <span className="text-zinc-400">
                                        원래 성과: {s.originalPerformanceStatus ?? "-"}
                                        {s.originalPerformanceScore != null ? ` (${s.originalPerformanceScore}점)` : ""}
                                      </span>
                                      <span className="text-zinc-400">{new Date(s.generatedAt).toLocaleString("ko-KR")}</span>
                                    </div>
                                    {s.suggestedTitle && <p className="mt-1 text-zinc-700">제목 제안: {s.suggestedTitle}</p>}
                                    {s.suggestedHook && <p className="mt-1 text-zinc-600">hook 제안: {s.suggestedHook}</p>}
                                    {s.suggestedCta && <p className="mt-1 text-zinc-600">CTA 제안: {s.suggestedCta}</p>}
                                    {s.suggestedHashtags.length > 0 && (
                                      <p className="mt-1 text-zinc-500">
                                        해시태그 제안: {s.suggestedHashtags.map((tag) => `#${tag}`).join(" ")}
                                      </p>
                                    )}
                                    {s.suggestedThreadItems.length > 0 && (
                                      <ul className="mt-1 list-inside list-decimal text-zinc-600">
                                        {s.suggestedThreadItems.map((item) => (
                                          <li key={item.order}>{item.text}</li>
                                        ))}
                                      </ul>
                                    )}
                                    {s.suggestedCardItems.length > 0 && (
                                      <ul className="mt-1 flex flex-col gap-1 text-zinc-600">
                                        {s.suggestedCardItems.map((item) => (
                                          <li key={item.order}>
                                            <strong>{item.heading}</strong>: {item.body}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {Array.isArray((s.suggestedChanges as { improvementTargets?: unknown }).improvementTargets) && (
                                      <p className="mt-1 text-zinc-500">
                                        개선 대상: {(s.suggestedChanges as { improvementTargets: string[] }).improvementTargets.join(", ")}
                                      </p>
                                    )}
                                    {s.expectedImprovementReason && (
                                      <p className="mt-1 text-zinc-500">기대 효과: {s.expectedImprovementReason}</p>
                                    )}
                                    {s.riskNotes.length > 0 && (
                                      <div className="mt-1 text-amber-700">
                                        <p className="font-medium">주의:</p>
                                        <ul className="list-inside list-disc">
                                          {s.riskNotes.map((note, i) => (
                                            <li key={i}>{note}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {s.qualityNotes.length > 0 && (
                                      <p className="mt-1 text-zinc-500">참고 개선 영역: {s.qualityNotes.join(", ")}</p>
                                    )}
                                    {s.rejectedReason && <p className="mt-1 text-red-600">반려 사유: {s.rejectedReason}</p>}
                                    {s.applicationStatus === "applied" && (
                                      <p className="mt-1 text-green-700">
                                        ✔ 적용 완료 — 새 social post: {s.appliedSocialPostId} (이 목록에서 새 버전으로
                                        표시됩니다). 이 버전은 다시 Quality Gate와 Approval을 거쳐야 합니다.
                                      </p>
                                    )}

                                    {(() => {
                                      const preview = rewriteApplicationPreviewById.get(s.id);
                                      if (!preview || !preview.ok || !preview.original || !preview.proposed) return null;
                                      return (
                                        <details className="mt-2 rounded border border-zinc-200 bg-white p-2">
                                          <summary className="cursor-pointer text-zinc-500">적용 Preview 보기</summary>
                                          <div className="mt-1 text-zinc-600">
                                            <p>
                                              원본: v{preview.original.versionNumber} · 제목:{" "}
                                              {preview.original.postTitlePreview ?? "(없음)"} · 본문 {preview.original.postBodyLength}자 ·
                                              해시태그 {preview.original.hashtagCount}개
                                            </p>
                                            <p className="mt-1">
                                              제안: 제목 {preview.proposed.suggestedTitle ?? "(변경 없음)"} · hook{" "}
                                              {preview.proposed.suggestedHook ?? "(없음)"} · CTA {preview.proposed.suggestedCta ?? "(없음)"}
                                            </p>
                                            {preview.changes.length > 0 && (
                                              <ul className="mt-1 list-inside list-disc text-zinc-500">
                                                {preview.changes.map((c, i) => (
                                                  <li key={i}>{c}</li>
                                                ))}
                                              </ul>
                                            )}
                                            {preview.warnings.map((w, i) => (
                                              <p key={i} className="mt-1 text-amber-700">
                                                ⚠ {w}
                                              </p>
                                            ))}
                                          </div>
                                        </details>
                                      );
                                    })()}

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <form action={approveRewriteSuggestionAction}>
                                        <input type="hidden" name="articleId" value={article.id} />
                                        <input type="hidden" name="suggestionId" value={s.id} />
                                        <button
                                          type="submit"
                                          disabled={s.suggestionStatus !== "ready" && s.suggestionStatus !== "needs_review"}
                                          className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          제안 승인
                                        </button>
                                      </form>
                                      <form action={rejectRewriteSuggestionAction} className="flex items-center gap-1">
                                        <input type="hidden" name="articleId" value={article.id} />
                                        <input type="hidden" name="suggestionId" value={s.id} />
                                        <input
                                          name="reason"
                                          placeholder="반려 사유 (선택)"
                                          className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                                        />
                                        <button
                                          type="submit"
                                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                                        >
                                          제안 반려
                                        </button>
                                      </form>
                                      <form action={applyRewriteSuggestionAction} className="flex items-center gap-1">
                                        <input type="hidden" name="articleId" value={article.id} />
                                        <input type="hidden" name="suggestionId" value={s.id} />
                                        <input
                                          name="notes"
                                          placeholder="적용 메모 (선택)"
                                          className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]"
                                        />
                                        <button
                                          type="submit"
                                          disabled={s.suggestionStatus !== "approved" || s.applicationStatus === "applied"}
                                          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          개선안 적용
                                        </button>
                                      </form>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          );
                        })()}
                      </div>

                      {/* Phase 3-12: Rewrite Version Quality Recheck & Comparison */}
                      {post.isRewriteVersion && (
                        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                          <p className="font-medium text-zinc-600">Rewrite Version Comparison</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            비교 결과는 자동 게시가 아니라 사람이 판단하기 위한 보조 지표입니다. 추천
                            버전도 다시 Approval, Export, Guard, Handoff 과정을 거쳐야 합니다. 성과
                            데이터가 없는 rewrite version은 품질 기준 중심으로 비교합니다.
                          </p>
                          {post.qualityStatus === "not_checked" && (
                            <p className="mt-1 text-amber-700">⚠ 아직 quality gate를 실행하지 않았습니다 — 먼저 Quality Recheck를 실행하세요.</p>
                          )}
                          {post.versionComparisonStatus === "blocked" && (
                            <p className="mt-1 text-red-600">이 버전은 비교 결과 blocked 상태여서 추천할 수 없습니다.</p>
                          )}

                          {/* 저장된 비교 결과 요약 + 추천 버전 열기 */}
                          {(() => {
                            const saved = savedComparisonByPostId.get(post.id);
                            if (!saved) return null;
                            return (
                              <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
                                <p className="text-zinc-600">
                                  comparison_status: <span className="font-medium">{saved.comparisonStatus}</span>
                                  {saved.comparisonScore != null ? ` · comparison_score: ${saved.comparisonScore}` : ""}
                                  {post.recommendedForRepost && (
                                    <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-700">재게시 후보</span>
                                  )}
                                </p>
                                {saved.recommendationReason && (
                                  <p className="mt-1 text-zinc-500">recommendation_reason: {saved.recommendationReason}</p>
                                )}
                                <p className="mt-1 text-zinc-500">
                                  recommended_social_post_id: {saved.recommendedSocialPostId ?? "없음"}
                                </p>

                                {saved.recommendedSocialPostId ? (
                                  <div className="mt-2">
                                    <a
                                      href={`/articles/${article.id}?socialPostId=${saved.recommendedSocialPostId}#social-post-${saved.recommendedSocialPostId}`}
                                      className="inline-block rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                                    >
                                      추천 버전 열기
                                    </a>
                                    <p className="mt-1 text-[11px] text-zinc-400">
                                      추천 버전 열기는 자동 게시가 아닙니다 — 추천된 social post를 확인하기 위한 이동
                                      버튼입니다. 추천 버전도 다시 Approval, Export, Guard, Handoff 과정을 거쳐야
                                      합니다.
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-1 font-medium text-zinc-500">추천 버전 없음 / 검토 필요</p>
                                )}
                              </div>
                            );
                          })()}

                          {(() => {
                            const preview = comparisonPreviewByPostId.get(post.id);
                            if (!preview || !preview.ok || !preview.original || !preview.rewrite) return null;
                            return (
                              <div className="mt-2 overflow-x-auto">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="text-zinc-500">
                                      <th className="pr-2"> </th>
                                      <th className="pr-2">원본 (v{preview.original.versionNumber})</th>
                                      <th className="pr-2">rewrite (v{preview.rewrite.versionNumber})</th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-zinc-700">
                                    <tr>
                                      <td className="pr-2 text-zinc-500">quality</td>
                                      <td className="pr-2">{preview.original.qualityStatus} ({preview.original.qualityScore ?? "-"})</td>
                                      <td className="pr-2">{preview.rewrite.qualityStatus} ({preview.rewrite.qualityScore ?? "-"})</td>
                                    </tr>
                                    <tr>
                                      <td className="pr-2 text-zinc-500">performance</td>
                                      <td className="pr-2">{preview.original.performanceStatus} ({preview.original.performanceScore ?? "-"})</td>
                                      <td className="pr-2">{preview.rewrite.performanceStatus} ({preview.rewrite.performanceScore ?? "-"})</td>
                                    </tr>
                                    <tr>
                                      <td className="pr-2 text-zinc-500">제목</td>
                                      <td className="pr-2">{preview.original.postTitlePreview ?? "-"}</td>
                                      <td className="pr-2">{preview.rewrite.postTitlePreview ?? "-"}</td>
                                    </tr>
                                    <tr>
                                      <td className="pr-2 text-zinc-500">해시태그/스레드/카드</td>
                                      <td className="pr-2">
                                        {preview.original.hashtagCount}/{preview.original.threadItemCount}/{preview.original.cardItemCount}
                                      </td>
                                      <td className="pr-2">
                                        {preview.rewrite.hashtagCount}/{preview.rewrite.threadItemCount}/{preview.rewrite.cardItemCount}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                {preview.differences.length > 0 && (
                                  <ul className="mt-1 list-inside list-disc text-zinc-500">
                                    {preview.differences.map((d, i) => (
                                      <li key={i}>{d}</li>
                                    ))}
                                  </ul>
                                )}
                                {preview.warnings.map((w, i) => (
                                  <p key={i} className="mt-1 text-amber-700">
                                    ⚠ {w}
                                  </p>
                                ))}
                                {preview.recommendationPreview && (
                                  <p className="mt-1 text-zinc-600">
                                    예상 추천: <span className="font-medium">{preview.recommendationPreview.comparisonStatus}</span> —{" "}
                                    {preview.recommendationPreview.recommendationReason}
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={recheckRewriteVersionQualityAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                              >
                                Rewrite Version Quality Recheck 실행
                              </button>
                            </form>
                            <form action={compareRewriteVersionAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                disabled={!post.parentSocialPostId && !post.rewriteAppliedFromSocialPostId}
                                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                원본과 비교 실행
                              </button>
                            </form>
                          </div>
                        </div>
                      )}

                      {/* Phase 3-13: Rewrite Re-approval & Re-export Workflow */}
                      {post.isRewriteVersion && (
                        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                          <p className="font-medium text-zinc-600">
                            Rewrite Republish Workflow
                            {post.recommendedForRepost && (
                              <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">재게시 후보</span>
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            추천된 rewrite version도 자동 게시되지 않습니다. 재승인 후 다시 Export,
                            Guard, Dry-run, Handoff 과정을 거쳐야 합니다. 원본 게시글과 성과 기록은
                            보존됩니다.
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            workflow: <span className="font-mono">{post.rewriteRepublishWorkflowStatus}</span> · 재승인:{" "}
                            <span className="font-mono">{post.rewriteReapprovalStatus}</span> · 재export:{" "}
                            <span className="font-mono">{post.rewriteReexportStatus}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            approval: {post.approvalStatus} · quality: {post.qualityStatus} · export: {post.exportStatus} · guard:{" "}
                            {post.platformPublishGuardStatus} · dry-run: {post.platformPublishDryRunStatus} · handoff: {post.handoffStatus} ·
                            manual_post: {post.manualPostStatus}
                          </p>
                          {post.qualityStatus !== "ready" && (
                            <p className="mt-1 text-amber-700">⚠ quality_status가 ready가 아닙니다 — 재승인 요청 전 Quality Recheck를 먼저 실행하세요.</p>
                          )}
                          {post.rewriteReapprovalError && <p className="mt-1 text-red-600">재승인 오류: {post.rewriteReapprovalError}</p>}
                          {post.rewriteReexportError && <p className="mt-1 text-red-600">재export 오류: {post.rewriteReexportError}</p>}

                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={requestRewriteReapprovalAction} className="flex items-center gap-1">
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <input name="notes" placeholder="메모 (선택)" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "not_requested"}
                                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재승인 요청
                              </button>
                            </form>
                            <form action={approveRewriteReapprovalAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "pending_review"}
                                className="rounded border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재승인 승인
                              </button>
                            </form>
                            <form action={rejectRewriteReapprovalAction} className="flex items-center gap-1">
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <input name="reason" placeholder="반려 사유" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "pending_review"}
                                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재승인 반려
                              </button>
                            </form>
                            <form action={revokeRewriteReapprovalAction} className="flex items-center gap-1">
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <input name="reason" placeholder="취소 사유" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px]" />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "approved"}
                                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재승인 취소
                              </button>
                            </form>
                            <form action={prepareRewriteReexportAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "approved"}
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재Export 준비
                              </button>
                            </form>
                            <form action={generateRewriteReexportPayloadAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                disabled={post.rewriteReapprovalStatus !== "approved"}
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                재Export 생성
                              </button>
                            </form>
                            <form action={refreshRewriteRepublishWorkflowStatusAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                              >
                                Workflow 상태 새로고침
                              </button>
                            </form>
                          </div>
                          {post.rewriteReexportStatus === "exported" && (
                            <p className="mt-2 text-zinc-500">
                              재export가 완료되었습니다 — 위 &quot;Platform Publishing Guard&quot;/&quot;Platform
                              Publish Dry-run &amp; Handoff&quot;/&quot;Manual Posting Result&quot; 섹션의 기존
                              버튼을 이어서 사용하세요.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Phase 3-14: Rewrite Performance Tracking & Original-vs-Rewrite Result Comparison */}
                      {post.isRewriteVersion && (post.rewriteAppliedFromSocialPostId || post.parentSocialPostId) && (
                        <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
                          <p className="font-medium text-zinc-600">
                            Rewrite Performance Comparison
                            {post.rewritePerformanceWinner && (
                              <span
                                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  post.rewritePerformanceWinner === "rewrite"
                                    ? "bg-green-100 text-green-700"
                                    : post.rewritePerformanceWinner === "original"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                winner: {post.rewritePerformanceWinner}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            이 비교는 수동 입력된 metrics를 기반으로 합니다. 성과 비교 결과는 자동
                            재게시나 자동 수정으로 이어지지 않습니다. 플랫폼별 알고리즘, 게시 시간,
                            이미지, 외부 이슈에 따라 결과가 달라질 수 있습니다. 동일 조건의 A/B
                            테스트가 아니므로 참고 지표로만 사용하세요.
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            comparison_status: <span className="font-mono">{post.rewritePerformanceComparisonStatus}</span> · score
                            delta: {post.rewritePerformanceScoreDelta?.toFixed(2) ?? "-"} · 개선율:{" "}
                            {post.rewritePerformanceImprovementRate !== null
                              ? `${(post.rewritePerformanceImprovementRate * 100).toFixed(1)}%`
                              : "-"}{" "}
                            · 마지막 비교: {post.rewritePerformanceCheckedAt ?? "-"}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                            <a
                              href={`#social-post-${post.rewriteAppliedFromSocialPostId ?? post.parentSocialPostId}`}
                              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                            >
                              원본 게시글 열기
                            </a>
                            <a
                              href={`#social-post-${post.id}`}
                              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                            >
                              rewrite 게시글 열기
                            </a>
                            <a
                              href={`#social-post-${post.id}`}
                              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                            >
                              metrics 입력으로 이동
                            </a>
                          </div>

                          {(() => {
                            const preview = rewritePerformancePreviewByPostId.get(post.id);
                            if (!preview) return null;
                            return (
                              <details className="mt-2 text-[11px]">
                                <summary className="cursor-pointer text-zinc-500">성과 비교 Preview</summary>
                                {!preview.original || !preview.rewrite ? (
                                  <p className="mt-1 text-zinc-500">원본 social post를 찾을 수 없어 preview를 만들 수 없습니다.</p>
                                ) : (
                                  <div className="mt-1 overflow-x-auto">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="text-zinc-500">
                                          <th className="pr-2"> </th>
                                          <th className="pr-2">원본 (v{preview.original.versionNumber})</th>
                                          <th className="pr-2">rewrite (v{preview.rewrite.versionNumber})</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-zinc-700">
                                        <tr>
                                          <td className="pr-2 text-zinc-500">performance</td>
                                          <td className="pr-2">
                                            {preview.original.performanceStatus} ({preview.original.performanceScore ?? "-"})
                                          </td>
                                          <td className="pr-2">
                                            {preview.rewrite.performanceStatus} ({preview.rewrite.performanceScore ?? "-"})
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">views/impressions</td>
                                          <td className="pr-2">
                                            {preview.original.views}/{preview.original.impressions}
                                          </td>
                                          <td className="pr-2">
                                            {preview.rewrite.views}/{preview.rewrite.impressions}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">likes/comments/shares/saves</td>
                                          <td className="pr-2">
                                            {preview.original.likes}/{preview.original.comments}/{preview.original.shares}/
                                            {preview.original.saves}
                                          </td>
                                          <td className="pr-2">
                                            {preview.rewrite.likes}/{preview.rewrite.comments}/{preview.rewrite.shares}/
                                            {preview.rewrite.saves}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">metrics 입력 시각</td>
                                          <td className="pr-2">{preview.original.latestMetricsRecordedAt ?? "미입력"}</td>
                                          <td className="pr-2">{preview.rewrite.latestMetricsRecordedAt ?? "미입력"}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                    <p className="mt-1 text-zinc-500">비교 실행 가능: {preview.canCompare ? "예" : "아니오 (metrics 입력 필요)"}</p>
                                  </div>
                                )}
                                {preview.missingData.length > 0 && (
                                  <p className="mt-1 text-amber-700">⚠ metrics 입력 필요: {JSON.stringify(preview.missingData)}</p>
                                )}
                                {preview.warnings.length > 0 && (
                                  <p className="mt-1 text-amber-700">⚠ {JSON.stringify(preview.warnings)}</p>
                                )}
                              </details>
                            );
                          })()}

                          {post.latestRewritePerformanceComparisonId &&
                            (() => {
                              const saved = savedRewritePerformanceComparisonByPostId.get(post.id);
                              if (!saved) return null;
                              return (
                                <details className="mt-2 text-[11px]">
                                  <summary className="cursor-pointer text-zinc-500">비교 결과 보기</summary>
                                  <div className="mt-1 overflow-x-auto">
                                    <table className="w-full text-left">
                                      <tbody className="text-zinc-700">
                                        <tr>
                                          <td className="pr-2 text-zinc-500">views delta</td>
                                          <td className="pr-2">
                                            {saved.viewsDelta ?? "-"} (
                                            {saved.viewsDeltaRate !== null ? `${(saved.viewsDeltaRate * 100).toFixed(1)}%` : "-"})
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">impressions delta</td>
                                          <td className="pr-2">
                                            {saved.impressionsDelta ?? "-"} (
                                            {saved.impressionsDeltaRate !== null ? `${(saved.impressionsDeltaRate * 100).toFixed(1)}%` : "-"})
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">engagement_rate / CTR delta</td>
                                          <td className="pr-2">
                                            {saved.engagementRateDelta?.toFixed(4) ?? "-"} / {saved.clickThroughRateDelta?.toFixed(4) ?? "-"}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">clicks / comments / shares / saves delta</td>
                                          <td className="pr-2">
                                            {saved.clicksDelta ?? "-"} / {saved.commentsDelta ?? "-"} / {saved.sharesDelta ?? "-"} /{" "}
                                            {saved.savesDelta ?? "-"}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="pr-2 text-zinc-500">comparison_status / winner</td>
                                          <td className="pr-2">
                                            {saved.comparisonStatus} / {saved.winner ?? "-"}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                    {saved.warnings.length > 0 && (
                                      <p className="mt-1 text-amber-700">⚠ {JSON.stringify(saved.warnings)}</p>
                                    )}
                                  </div>
                                </details>
                              );
                            })()}

                          <div className="mt-2">
                            <form action={compareRewritePerformanceAction}>
                              <input type="hidden" name="articleId" value={article.id} />
                              <input type="hidden" name="socialPostId" value={post.id} />
                              <button
                                type="submit"
                                className="rounded border border-purple-300 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100"
                              >
                                원본 vs Rewrite 성과 비교 실행
                              </button>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 인용 출처 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">인용된 출처 ({sources.length}개)</h2>
          {sources.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">연결된 출처가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {sources.map((source, index) => (
                <li key={source.id} className="rounded border border-zinc-200 px-3 py-2 text-sm">
                  <div className="font-medium">
                    {index + 1}.{" "}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {source.title || "(제목 없음)"}
                    </a>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {source.publisher && `${source.publisher}`}
                    {source.publishedAt && ` · ${source.publishedAt}`}
                  </div>
                  {source.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                      {source.summary.length > 150
                        ? `${source.summary.substring(0, 150)}…`
                        : source.summary}
                    </p>
                  )}
                  {source.keyPoints && source.keyPoints.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-xs text-zinc-500">
                      {source.keyPoints.slice(0, 3).map((kp, kpIdx) => (
                        <li key={kpIdx}>{kp}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 평가 결과 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">최신 평가 결과 (AI Evals)</h2>
          {!latestEval ? (
            <p className="mt-2 text-xs text-zinc-500">아직 평가 결과가 없습니다.</p>
          ) : (
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    latestEval.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {latestEval.passed ? "통과" : "미통과"}
                </span>
                <span className="text-xs text-zinc-500">
                  종합 점수:{" "}
                  {latestEval.aggregateScore != null ? latestEval.aggregateScore.toFixed(2) : "-"}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600">
                {Object.entries(latestEval.criteriaScores).map(([criterionId, score]) => (
                  <li key={criterionId}>
                    {criterionId}: {score.score}점 — {score.reason}
                  </li>
                ))}
              </ul>
              {latestEval.notes && <p className="mt-2 text-xs text-zinc-500">{latestEval.notes}</p>}
            </div>
          )}
        </section>

        {/* 파이프라인 로그 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">관련 파이프라인 로그</h2>
          {logs.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">관련 로그가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-2 rounded px-2 py-1 text-xs">
                  <span
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 font-medium ${
                      log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : log.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {log.type}
                  </span>
                  <span className="text-zinc-600">{log.message}</span>
                  <span className="ml-auto shrink-0 text-zinc-400">
                    {new Date(log.createdAt).toLocaleTimeString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
