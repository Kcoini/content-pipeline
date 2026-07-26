import Link from "next/link";
import { getArticleById } from "@/lib/repositories/article-repository";
import { getThemeById } from "@/lib/repositories/theme-repository";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";
import { getLogsByArticleId } from "@/lib/harness/logger";
import { getPublishLogsByArticleId } from "@/lib/repositories/publish-repository";
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
  generateFeaturedImageAction,
  reviewGeneratedImageAction,
  testWordPressConnectionAction,
} from "./actions";
import type {
  WordPressMetadataStatus,
  SeoPluginMetadataStatus,
  SeoPluginWriteStatus,
  FeaturedImageStatus,
  WordPressMediaUploadStatus,
  GeneratedImageStatus,
  WordPressFeaturedMediaAttachStatus,
} from "@/lib/types/domain";
import { ARTICLE_MODE_CONFIGS } from "@/lib/articles/article-modes";
import { WORDPRESS_TARGET, isWordPressPublishEnabled } from "@/lib/publish/publish-service";
import { isWordPressMediaUploadEnabled } from "@/lib/publish/wordpress-media-config";
import { isImageGenerationEnabled } from "@/lib/images/image-generation-config";
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
  searchParams: Promise<{ error?: string; publishMessage?: string }>;
}) {
  const { id } = await params;
  const { error, publishMessage } = await searchParams;

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

  const [theme, sources, latestEval, logs, publishLogs] = await Promise.all([
    getThemeById(article.themeId),
    getSourcesByArticleId(article.id),
    getLatestEvalByArticleId(article.id),
    getLogsByArticleId(article.id, 10),
    getPublishLogsByArticleId(article.id, 10),
  ]);

  const isDraft = article.status === "draft";
  const isReviewed = article.status === "reviewed";
  const wordpressLogs = publishLogs.filter((log) => log.target === WORDPRESS_TARGET);
  const latestWordPressLog = wordpressLogs[0];
  const hasWordPressSuccess = wordpressLogs.some((log) => log.status === "success");
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

        {/* Phase 2-6 / 2-10: WordPress Media Upload Preparation + Actual Test */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">WordPress Media Upload</h2>
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

        {/* Phase 2-11: WordPress Featured Media Draft Publish Test */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">WordPress Featured Media</h2>
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
