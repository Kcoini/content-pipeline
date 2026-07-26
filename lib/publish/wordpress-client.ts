// Phase 2-2: WordPress REST API 클라이언트 (서버 전용).
// Application Password 기반 Basic Auth로 draft post를 생성한다.
// 이 파일은 Server Action/Route Handler에서만 import한다 (client component 금지).
// Authorization header/password는 어떤 경우에도 로그에 남기지 않는다.

export interface CreateDraftPostInput {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  categories?: number[];
  tags?: number[];
  meta?: Record<string, unknown>;
  /**
   * Phase 2-5: WordPress media id (featured_media). 실제 이미지 업로드는 아직
   * 구현하지 않았으므로 이 값이 채워지는 경우는 현재 없다 — 나중에 업로드
   * 기능이 구현되면 그 결과를 그대로 전달할 수 있도록 구조만 준비한다.
   */
  featuredMedia?: number;
}

export interface CreateDraftPostSuccess {
  success: true;
  externalPostId: number;
  postUrl: string;
  /** WordPress 응답의 일부만 보관한다 (id/link/status/slug). */
  raw: Record<string, unknown>;
}

export interface CreateDraftPostFailure {
  success: false;
  statusCode?: number;
  statusText?: string;
  errorMessage: string;
  /** 응답 본문 일부 (최대 300자). 디버깅용, 인증 정보는 포함되지 않는다. */
  responseBodyExcerpt?: string;
}

export type CreateDraftPostResult = CreateDraftPostSuccess | CreateDraftPostFailure;

interface WordPressConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

function getWordPressConfig(): WordPressConfig | null {
  const baseUrl = process.env.WORDPRESS_BASE_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const appPassword = process.env.WORDPRESS_APP_PASSWORD;

  if (!baseUrl || !username || !appPassword) return null;

  return { baseUrl, username, appPassword };
}

/** WordPress 연동에 필요한 환경변수 3종이 모두 설정되어 있는지 확인한다 (값은 노출하지 않는다). */
export function isWordPressConfigured(): boolean {
  return getWordPressConfig() !== null;
}

const RESPONSE_BODY_EXCERPT_LENGTH = 300;

function buildAuthHeader(config: WordPressConfig): string {
  const authToken = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
  return `Basic ${authToken}`;
}

/**
 * WordPress REST API(`/wp-json/wp/v2/posts`)에 status="draft"로 post를 생성한다.
 * 자동 공개(publish)는 절대 수행하지 않는다 — status는 항상 "draft"로 고정한다.
 */
export async function createDraftPost(input: CreateDraftPostInput): Promise<CreateDraftPostResult> {
  const config = getWordPressConfig();
  if (!config) {
    return {
      success: false,
      errorMessage:
        "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
    };
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/posts`;

  const body: Record<string, unknown> = {
    title: input.title,
    content: input.content,
    status: "draft",
  };
  if (input.excerpt) body.excerpt = input.excerpt;
  if (input.slug) body.slug = input.slug;
  if (input.categories && input.categories.length > 0) body.categories = input.categories;
  if (input.tags && input.tags.length > 0) body.tags = input.tags;
  if (input.meta) body.meta = input.meta;
  if (input.featuredMedia !== undefined) body.featured_media = input.featuredMedia;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: `WordPress API 네트워크 오류: ${message}` };
  }

  if (!response.ok) {
    let bodyExcerpt: string | undefined;
    try {
      bodyExcerpt = (await response.text()).slice(0, RESPONSE_BODY_EXCERPT_LENGTH);
    } catch {
      bodyExcerpt = undefined;
    }

    return {
      success: false,
      statusCode: response.status,
      statusText: response.statusText,
      errorMessage: `WordPress API 오류 (HTTP ${response.status} ${response.statusText})`,
      responseBodyExcerpt: bodyExcerpt,
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: `WordPress API 응답 파싱 실패: ${message}` };
  }

  const externalPostId = typeof data.id === "number" ? data.id : Number(data.id);
  const postUrl = typeof data.link === "string" ? data.link : "";

  if (!externalPostId || Number.isNaN(externalPostId)) {
    return { success: false, errorMessage: "WordPress 응답에 post id가 없습니다." };
  }

  return {
    success: true,
    externalPostId,
    postUrl,
    raw: {
      id: data.id,
      link: data.link,
      status: data.status,
      slug: data.slug,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-11: 기존 WordPress draft post에 featured_media 연결
//
// POST /wp-json/wp/v2/posts/{postId}에 { status: "draft", featured_media }만
// 전송한다. status는 항상 "draft"로 고정해 실수로 공개되지 않도록 한다.
// ─────────────────────────────────────────────────────────────

export interface UpdateDraftFeaturedMediaSuccess {
  success: true;
  postId: number;
  link: string;
  status: string;
  featuredMedia: number;
}

export interface UpdateDraftFeaturedMediaFailure {
  success: false;
  statusCode?: number;
  errorMessage: string;
  reasonCandidate: string[];
}

export type UpdateDraftFeaturedMediaResult = UpdateDraftFeaturedMediaSuccess | UpdateDraftFeaturedMediaFailure;

/**
 * 기존 WordPress draft post의 featured_media만 갱신한다 (Phase 2-11).
 * status는 입력값과 무관하게 항상 "draft"로 고정해 전송한다 — 공개(publish)는
 * 절대 수행하지 않는다.
 */
export async function updateDraftFeaturedMedia(
  postId: number,
  mediaId: number
): Promise<UpdateDraftFeaturedMediaResult> {
  const config = getWordPressConfig();
  if (!config) {
    return {
      success: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      reasonCandidate: ["Application Password가 설정되지 않았습니다."],
    };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify({ status: "draft", featured_media: mediaId }),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorMessage = `WordPress API 네트워크 오류: ${message}`;
    return {
      success: false,
      errorMessage,
      reasonCandidate: ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"],
    };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `WordPress featured_media 갱신 실패 (HTTP ${response.status} ${response.statusText})`,
      reasonCandidate: getLikelyCausesForStatus(response.status),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorMessage: `WordPress 응답 파싱 실패: ${message}`,
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const resultPostId = typeof data.id === "number" ? data.id : Number(data.id);
  if (!resultPostId || Number.isNaN(resultPostId)) {
    return {
      success: false,
      errorMessage: "WordPress 응답에 post id가 없습니다.",
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const link = typeof data.link === "string" ? data.link : "";
  const status = typeof data.status === "string" ? data.status : "draft";
  const featuredMedia = typeof data.featured_media === "number" ? data.featured_media : mediaId;

  return { success: true, postId: resultPostId, link, status, featuredMedia };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-17: WordPress draft post를 실제 public publish 상태로 변경
//
// POST /wp-json/wp/v2/posts/{postId}에 { status: "publish" }만 전송한다.
// 이 함수는 호출된 즉시 실제 공개(publish)를 수행하므로, 반드시 상위
// 서비스(wordpress-public-publish-service.ts)의 guard(assertCanPublicPublish)를
// 통과한 뒤에만 호출해야 한다.
// ─────────────────────────────────────────────────────────────

export interface PublishWordPressPostSuccess {
  success: true;
  postId: number;
  status: string;
  link: string;
  slug: string;
  modified: string;
  date: string;
}

export interface PublishWordPressPostFailure {
  success: false;
  statusCode?: number;
  errorMessage: string;
  reasonCandidate: string[];
}

export type PublishWordPressPostResult = PublishWordPressPostSuccess | PublishWordPressPostFailure;

/**
 * 기존 WordPress draft post의 status를 "publish"로 변경한다 (Phase 2-17).
 * Authorization header/Application Password는 어떤 경우에도 반환값이나
 * 로그에 포함하지 않으며, WordPress raw response 전체도 보관하지 않는다.
 */
export async function publishWordPressPost(postId: number): Promise<PublishWordPressPostResult> {
  const config = getWordPressConfig();
  if (!config) {
    return {
      success: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      reasonCandidate: ["Application Password가 설정되지 않았습니다."],
    };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify({ status: "publish" }),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorMessage = `WordPress API 네트워크 오류: ${message}`;
    return {
      success: false,
      errorMessage,
      reasonCandidate: ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"],
    };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `WordPress public publish 실패 (HTTP ${response.status} ${response.statusText})`,
      reasonCandidate: getLikelyCausesForStatus(response.status),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorMessage: `WordPress 응답 파싱 실패: ${message}`,
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const resultPostId = typeof data.id === "number" ? data.id : Number(data.id);
  if (!resultPostId || Number.isNaN(resultPostId)) {
    return {
      success: false,
      errorMessage: "WordPress 응답에 post id가 없습니다.",
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const status = typeof data.status === "string" ? data.status : "";
  const link = typeof data.link === "string" ? data.link : "";
  const slug = typeof data.slug === "string" ? data.slug : "";
  const modified = typeof data.modified === "string" ? data.modified : "";
  const date = typeof data.date === "string" ? data.date : "";

  if (status !== "publish") {
    return {
      success: false,
      errorMessage: `WordPress post 상태가 publish로 반영되지 않았습니다 (status=${status || "unknown"}).`,
      reasonCandidate: ["WordPress 측 정책 또는 권한 문제로 상태가 반영되지 않았을 수 있습니다."],
    };
  }

  return { success: true, postId: resultPostId, status, link, slug, modified, date };
}

export interface MediaItemCheckResult {
  exists: boolean;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * featured_media로 연결하기 전 WordPress media item이 실제로 존재하는지 확인한다
 * (Phase 2-11, 선택적 사전 검증). Authorization header/password는 어떤 경우에도
 * 반환값에 포함하지 않는다.
 */
export async function getMediaItem(mediaId: number): Promise<MediaItemCheckResult> {
  const config = getWordPressConfig();
  if (!config) {
    return { exists: false, errorMessage: "WordPress 환경변수가 설정되지 않았습니다." };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/media/${mediaId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: buildAuthHeader(config) },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { exists: false, errorMessage: `WordPress API 네트워크 오류: ${message}` };
  }

  if (response.status === 404) {
    return { exists: false, statusCode: 404, errorMessage: "WordPress media item을 찾을 수 없습니다 (HTTP 404)." };
  }

  if (!response.ok) {
    return {
      exists: false,
      statusCode: response.status,
      errorMessage: `WordPress media item 확인 실패 (HTTP ${response.status})`,
    };
  }

  return { exists: true };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-12: SEO plugin(Yoast/Rank Math/AIOSEO) 실제 post metadata write
//
// 표준 WordPress REST API(POST /wp-json/wp/v2/posts/{id})의 meta 필드로만
// 시도한다. plugin이 protected meta key를 REST에 노출하지 않거나 별도 저장
// 방식을 쓰면 반영되지 않을 수 있다 — 이 경우 호출자가 반영 여부를 다시
// 조회(verifySeoPluginMetadata)해 needs_custom_endpoint로 처리한다.
// ─────────────────────────────────────────────────────────────

export type SeoPluginWriteProvider = "rank_math" | "yoast" | "aioseo";

export interface SeoPluginMetaFields {
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
}

/** provider별 post meta key로 payload를 만든다. 값이 없는 필드는 아예 포함하지 않는다. */
function buildSeoPluginMetaPayload(
  provider: SeoPluginWriteProvider,
  fields: SeoPluginMetaFields
): Record<string, string> {
  const keys: Record<SeoPluginWriteProvider, { title: string; description: string; focusKeyword: string }> = {
    rank_math: { title: "rank_math_title", description: "rank_math_description", focusKeyword: "rank_math_focus_keyword" },
    yoast: { title: "_yoast_wpseo_title", description: "_yoast_wpseo_metadesc", focusKeyword: "_yoast_wpseo_focuskw" },
    aioseo: { title: "_aioseo_title", description: "_aioseo_description", focusKeyword: "_aioseo_keywords" },
  };
  const providerKeys = keys[provider];

  const payload: Record<string, string> = {};
  if (fields.seoTitle) payload[providerKeys.title] = fields.seoTitle;
  if (fields.metaDescription) payload[providerKeys.description] = fields.metaDescription;
  if (fields.focusKeyword) payload[providerKeys.focusKeyword] = fields.focusKeyword;
  return payload;
}

export interface UpdateSeoPluginMetadataSuccess {
  success: true;
  postId: number;
  /** 실제로 전송을 시도한 meta key 목록 (값이 있는 필드만) */
  fieldsAttempted: string[];
}

export interface UpdateSeoPluginMetadataFailure {
  success: false;
  statusCode?: number;
  errorMessage: string;
  reasonCandidate: string[];
}

export type UpdateSeoPluginMetadataResult = UpdateSeoPluginMetadataSuccess | UpdateSeoPluginMetadataFailure;

/**
 * WordPress draft post에 SEO plugin metadata를 실제로 반영 시도한다 (Phase 2-12).
 * status는 입력값과 무관하게 항상 "draft"로 고정해 전송한다 — 공개(publish)는
 * 절대 수행하지 않는다. WordPress REST API에서 meta field가 등록/노출되어
 * 있지 않으면 요청은 성공(HTTP 200)해도 실제로 반영되지 않을 수 있다 —
 * 반영 여부는 verifySeoPluginMetadata로 별도 확인해야 한다.
 */
export async function updateSeoPluginMetadata(
  postId: number,
  provider: SeoPluginWriteProvider,
  fields: SeoPluginMetaFields
): Promise<UpdateSeoPluginMetadataResult> {
  const config = getWordPressConfig();
  if (!config) {
    return {
      success: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      reasonCandidate: ["Application Password가 설정되지 않았습니다."],
    };
  }

  const metaPayload = buildSeoPluginMetaPayload(provider, fields);
  const fieldsAttempted = Object.keys(metaPayload);
  if (fieldsAttempted.length === 0) {
    return {
      success: false,
      errorMessage: "저장할 SEO metadata 필드가 없습니다 (seo_title/meta_description/target_keyword가 모두 비어 있습니다).",
      reasonCandidate: ["article에 seo_title/meta_description/target_keyword 중 하나 이상이 필요합니다."],
    };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify({ status: "draft", meta: metaPayload }),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorMessage = `WordPress API 네트워크 오류: ${message}`;
    return {
      success: false,
      errorMessage,
      reasonCandidate: ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"],
    };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `WordPress SEO metadata 갱신 실패 (HTTP ${response.status} ${response.statusText})`,
      reasonCandidate: getLikelyCausesForStatus(response.status),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorMessage: `WordPress 응답 파싱 실패: ${message}`,
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const resultPostId = typeof data.id === "number" ? data.id : Number(data.id);
  if (!resultPostId || Number.isNaN(resultPostId)) {
    return {
      success: false,
      errorMessage: "WordPress 응답에 post id가 없습니다.",
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  return { success: true, postId: resultPostId, fieldsAttempted };
}

export interface VerifySeoPluginMetadataResult {
  verified: boolean;
  /** 반영이 확인되지 않을 때만 채워지는 안전한 안내 메시지 (custom endpoint 필요 가능성 등) */
  warning?: string;
}

/**
 * SEO plugin metadata가 실제로 반영되었는지 다시 조회해 확인한다 (Phase 2-12).
 * `GET /wp-json/wp/v2/posts/{postId}?context=edit`의 meta 필드에 시도한 key가
 * 모두 존재하면 verified:true, 그렇지 않으면 반영 여부를 단정하지 않고
 * warning으로 안내한다 (SEO plugin이 protected meta를 REST에 노출하지 않을 수 있음).
 */
export async function verifySeoPluginMetadata(
  postId: number,
  fieldsAttempted: string[]
): Promise<VerifySeoPluginMetadataResult> {
  const config = getWordPressConfig();
  if (!config) {
    return { verified: false, warning: "WordPress 환경변수가 설정되지 않아 반영 여부를 확인할 수 없습니다." };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts/${postId}?context=edit`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: buildAuthHeader(config) },
      cache: "no-store",
    });
  } catch {
    return { verified: false, warning: "WordPress 응답을 확인할 수 없어 반영 여부를 검증하지 못했습니다 (네트워크 오류)." };
  }

  if (!response.ok) {
    return {
      verified: false,
      warning: `WordPress 응답 확인 실패 (HTTP ${response.status}) — SEO metadata가 실제로 반영되었는지 확인할 수 없습니다.`,
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return { verified: false, warning: "WordPress 응답 파싱에 실패해 반영 여부를 확인할 수 없습니다." };
  }

  const meta = data.meta && typeof data.meta === "object" ? (data.meta as Record<string, unknown>) : {};
  const allPresent = fieldsAttempted.every((key) => {
    const value = meta[key];
    return value !== undefined && value !== null && value !== "";
  });

  if (allPresent) {
    return { verified: true };
  }

  return {
    verified: false,
    warning:
      "SEO metadata가 저장되었을 수 있지만 REST 응답에 노출되지 않았습니다 (SEO meta may have been accepted but is not exposed in REST response).",
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-3: category/tag 동기화 (구조만 준비 — 실제 연결은 다음 단계)
//
// WORDPRESS_PUBLISH_ENABLED=false이면 이 함수들을 호출하지 않는다
// (dry-run에서는 category/tag 이름만 사용하고 실제 API를 호출하지 않는다).
// ─────────────────────────────────────────────────────────────

export interface WordPressTermSuccess {
  success: true;
  id: number;
  name: string;
}

export interface WordPressTermFailure {
  success: false;
  statusCode?: number;
  errorMessage: string;
}

export type WordPressTermResult = WordPressTermSuccess | WordPressTermFailure;

type TermKind = "categories" | "tags";

async function findTermByName(kind: TermKind, name: string): Promise<WordPressTermResult> {
  const config = getWordPressConfig();
  if (!config) {
    return { success: false, errorMessage: "WordPress 환경변수가 설정되지 않았습니다." };
  }

  const endpoint = new URL(`${config.baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/${kind}`);
  endpoint.searchParams.set("search", name);
  endpoint.searchParams.set("per_page", "10");

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      headers: { Authorization: buildAuthHeader(config) },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: `WordPress API 네트워크 오류: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `WordPress ${kind} 검색 실패 (HTTP ${response.status})`,
    };
  }

  const items = (await response.json()) as Array<{ id: number; name: string }>;
  const exact = items.find((item) => item.name === name);

  if (!exact) {
    return { success: false, errorMessage: `일치하는 ${kind} 항목이 없습니다: ${name}` };
  }

  return { success: true, id: exact.id, name: exact.name };
}

async function createTerm(kind: TermKind, name: string): Promise<WordPressTermResult> {
  const config = getWordPressConfig();
  if (!config) {
    return { success: false, errorMessage: "WordPress 환경변수가 설정되지 않았습니다." };
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2/${kind}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify({ name }),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, errorMessage: `WordPress API 네트워크 오류: ${message}` };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `WordPress ${kind} 생성 실패 (HTTP ${response.status})`,
    };
  }

  const data = (await response.json()) as { id: number; name: string };
  return { success: true, id: data.id, name: data.name };
}

async function findOrCreateTerm(kind: TermKind, name: string): Promise<WordPressTermResult> {
  const found = await findTermByName(kind, name);
  if (found.success) return found;
  return createTerm(kind, name);
}

/** 이름으로 WordPress 카테고리를 검색한다 (없으면 실패를 반환한다). */
export function findCategoryByName(name: string): Promise<WordPressTermResult> {
  return findTermByName("categories", name);
}

/** WordPress 카테고리를 새로 생성한다. */
export function createCategory(name: string): Promise<WordPressTermResult> {
  return createTerm("categories", name);
}

/** 이름으로 카테고리를 찾고, 없으면 생성해 id를 반환한다. */
export function findOrCreateCategory(name: string): Promise<WordPressTermResult> {
  return findOrCreateTerm("categories", name);
}

/** 이름으로 WordPress 태그를 검색한다 (없으면 실패를 반환한다). */
export function findTagByName(name: string): Promise<WordPressTermResult> {
  return findTermByName("tags", name);
}

/** WordPress 태그를 새로 생성한다. */
export function createTag(name: string): Promise<WordPressTermResult> {
  return createTerm("tags", name);
}

/** 이름으로 태그를 찾고, 없으면 생성해 id를 반환한다. */
export function findOrCreateTag(name: string): Promise<WordPressTermResult> {
  return findOrCreateTerm("tags", name);
}

/** findOrCreateCategory의 별칭 (Phase 2-8 네이밍). */
export function getOrCreateCategoryByName(name: string): Promise<WordPressTermResult> {
  return findOrCreateCategory(name);
}

/** findOrCreateTag의 별칭 (Phase 2-8 네이밍). */
export function getOrCreateTagByName(name: string): Promise<WordPressTermResult> {
  return findOrCreateTag(name);
}

// ─────────────────────────────────────────────────────────────
// Phase 2-8: WordPress 연결 테스트 (실제 사이트와 안전하게 연결 확인)
//
// GET /wp-json/wp/v2/users/me로 인증이 되는지만 확인한다. Authorization
// header/password는 어떤 경우에도 반환값에 포함하지 않는다.
// ─────────────────────────────────────────────────────────────

export interface WordPressConnectionTestResult {
  connected: boolean;
  /** slash를 제거해 normalize한 base URL (인증 정보 없음) */
  baseUrl?: string;
  /** WordPress 계정 사용자명 (Application Password 값은 절대 포함하지 않음) */
  username?: string;
  /** WordPress 표시 이름 (성공 시) */
  displayName?: string;
  statusCode?: number;
  errorMessage?: string;
  /** 401/403/404/5xx별 원인 후보 안내 */
  likelyCauses?: string[];
  /** http(비-https) 연결 등 주의가 필요한 경고 */
  warnings?: string[];
  testedAt: string;
}

function getLikelyCausesForStatus(status: number): string[] {
  if (status === 401) {
    return [
      "username 또는 Application Password가 올바르지 않습니다.",
      "Application Password를 복사하는 과정에서 오타가 있을 수 있습니다.",
      "보안 플러그인이 REST API 인증을 차단하고 있을 수 있습니다.",
    ];
  }
  if (status === 403) {
    return [
      "해당 사용자의 권한이 부족합니다.",
      "REST API 쓰기 권한이 제한되어 있을 수 있습니다.",
      "보안 플러그인이 요청을 차단하고 있을 수 있습니다.",
    ];
  }
  if (status === 404) {
    return [
      "WORDPRESS_BASE_URL이 올바른지 확인하세요.",
      "/wp-json 경로에 접근할 수 없습니다.",
      "permalink 설정 또는 REST API가 비활성화/차단되어 있을 수 있습니다.",
    ];
  }
  if (status >= 500) {
    return ["WordPress 서버 오류입니다.", "플러그인 충돌 가능성이 있습니다.", "보안 설정 문제일 수 있습니다."];
  }
  return [`알 수 없는 오류입니다 (HTTP ${status}).`];
}

/**
 * WordPress REST API에 실제로 연결이 되는지 확인한다 (`GET /wp-json/wp/v2/users/me`).
 * Application Password/Authorization header는 어떤 경우에도 반환값에 포함하지 않는다.
 */
export async function testWordPressConnection(): Promise<WordPressConnectionTestResult> {
  const testedAt = new Date().toISOString();
  const config = getWordPressConfig();

  if (!config) {
    return {
      connected: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      testedAt,
    };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const warnings: string[] = [];
  if (baseUrl.startsWith("http://")) {
    warnings.push("http(비-https) 연결입니다. Application Password가 평문으로 전송될 수 있으니 https 사용을 권장합니다.");
  }

  const endpoint = `${baseUrl}/wp-json/wp/v2/users/me`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: buildAuthHeader(config) },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      baseUrl,
      username: config.username,
      errorMessage: `WordPress API 네트워크 오류: ${message}`,
      likelyCauses: ["WORDPRESS_BASE_URL이 올바른지 확인하세요.", "사이트에 네트워크로 접근 가능한지 확인하세요."],
      warnings: warnings.length > 0 ? warnings : undefined,
      testedAt,
    };
  }

  if (!response.ok) {
    return {
      connected: false,
      baseUrl,
      username: config.username,
      statusCode: response.status,
      errorMessage: `WordPress 연결 실패 (HTTP ${response.status} ${response.statusText})`,
      likelyCauses: getLikelyCausesForStatus(response.status),
      warnings: warnings.length > 0 ? warnings : undefined,
      testedAt,
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      baseUrl,
      username: config.username,
      errorMessage: `WordPress 응답 파싱 실패: ${message}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      testedAt,
    };
  }

  const displayName = typeof data.name === "string" ? data.name : undefined;

  return {
    connected: true,
    baseUrl,
    username: config.username,
    displayName,
    warnings: warnings.length > 0 ? warnings : undefined,
    testedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2-6/2-10: WordPress media upload
//
// WORDPRESS_MEDIA_UPLOAD_ENABLED=false(기본값)이면 skipped, WORDPRESS_PUBLISH_
// ENABLED=false이면 dry_run을 반환해 실제 API를 호출하지 않는다. 두 플래그가
// 모두 true이면 Phase 2-10에서 구현한 실제 업로드(POST /wp-json/wp/v2/media)를
// 시도한다. Authorization header/Application Password/image binary는 어떤
// 경우에도 반환값이나 로그에 포함하지 않는다.
// ─────────────────────────────────────────────────────────────

export type UploadMediaSourceType = "generated_url" | "external_url" | "local_file";

export interface UploadMediaInput {
  /** 실제 업로드 시 이미지를 어디서 가져올지. 생략하면(구식 호출) 실제 업로드 단계에서 실패로 처리된다. */
  sourceType?: UploadMediaSourceType;
  /** sourceType이 generated_url/external_url일 때 사용하는 절대 URL (http/https만 허용). */
  sourceUrl?: string;
  /** sourceType이 local_file일 때 사용하는 서버 로컬 파일 경로. */
  localPath?: string;
  filename: string;
  mimeType: string;
  altText: string;
  caption: string;
  title: string;
  description: string;
}

export type UploadMediaStatus = "dry_run" | "skipped" | "uploaded" | "failed";

export type MediaMetadataUpdateStatus = "success" | "failed" | "not_attempted";

export interface UploadMediaResult {
  status: UploadMediaStatus;
  wordpressMediaId?: number;
  wordpressUrl?: string;
  mimeType?: string;
  mediaType?: string;
  titleRendered?: string;
  /** alt_text/caption/description/title 메타데이터 업데이트 시도 결과 (업로드 성공 이후에만 채워짐). */
  metadataUpdateStatus?: MediaMetadataUpdateStatus;
  statusCode?: number;
  error?: string;
  reasonCandidate?: string[];
}

const ALLOWED_MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getMediaUploadReasonCandidates(statusCode: number | undefined, errorMessage: string): string[] {
  if (statusCode !== undefined) {
    return getLikelyCausesForStatus(statusCode);
  }
  if (errorMessage.includes("네트워크 오류")) {
    return ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"];
  }
  return ["원인을 특정할 수 없는 오류입니다."];
}

/** 이미지 source(URL 또는 로컬 파일)에서 binary를 준비한다. mock/상대경로 URL은 차단한다. */
async function prepareImageBinary(
  input: UploadMediaInput
): Promise<{ success: true; data: Buffer } | { success: false; errorMessage: string; reasonCandidate: string[] }> {
  if (input.sourceType === "local_file") {
    if (!input.localPath) {
      return { success: false, errorMessage: "로컬 이미지 경로가 없습니다.", reasonCandidate: ["featured_image_local_path가 비어 있습니다."] };
    }
    try {
      const { readFile } = await import("node:fs/promises");
      const data = await readFile(input.localPath);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: `로컬 이미지 파일을 읽을 수 없습니다: ${message}`, reasonCandidate: ["파일 경로가 올바르지 않거나 접근 권한이 없습니다."] };
    }
  }

  if (input.sourceType === "generated_url" || input.sourceType === "external_url") {
    if (!input.sourceUrl) {
      return { success: false, errorMessage: "이미지 URL이 없습니다.", reasonCandidate: ["source URL이 비어 있습니다."] };
    }
    if (!/^https?:\/\//i.test(input.sourceUrl)) {
      return {
        success: false,
        errorMessage: "mock 또는 상대경로 이미지는 실제 업로드할 수 없습니다.",
        reasonCandidate: ["이미지 URL이 http/https 절대 경로가 아닙니다 (mock 이미지일 수 있습니다)."],
      };
    }

    let response: Response;
    try {
      response = await fetch(input.sourceUrl, { cache: "no-store" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: `이미지 다운로드 네트워크 오류: ${message}`, reasonCandidate: ["이미지 URL에 접근할 수 없습니다."] };
    }
    if (!response.ok) {
      return {
        success: false,
        errorMessage: `이미지 다운로드 실패 (HTTP ${response.status})`,
        reasonCandidate: ["이미지 URL이 유효하지 않거나 접근 권한이 없습니다."],
      };
    }
    const arrayBuffer = await response.arrayBuffer();
    return { success: true, data: Buffer.from(arrayBuffer) };
  }

  return {
    success: false,
    errorMessage: "이미지 source가 지정되지 않았습니다.",
    reasonCandidate: ["sourceType이 generated_url/external_url/local_file 중 하나여야 합니다."],
  };
}

/**
 * 업로드된 media item의 alt_text/caption/description/title을 갱신한다 (best-effort).
 * 실패해도 업로드 성공 자체는 무효화하지 않는다 — 호출자가 warning으로만 처리한다.
 */
async function updateMediaMetadata(
  config: WordPressConfig,
  baseUrl: string,
  mediaId: number,
  input: UploadMediaInput
): Promise<MediaMetadataUpdateStatus> {
  try {
    const response = await fetch(`${baseUrl}/wp-json/wp/v2/media/${mediaId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(config),
      },
      body: JSON.stringify({
        alt_text: input.altText,
        caption: input.caption,
        description: input.description || input.title,
        title: input.title,
      }),
      cache: "no-store",
    });
    return response.ok ? "success" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * WordPress media endpoint(`/wp-json/wp/v2/media`)에 이미지를 실제로 업로드한다 (Phase 2-10).
 *
 * - `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 업로드 기능 자체가
 *   꺼져 있으므로 `skipped`를 반환한다.
 * - `WORDPRESS_PUBLISH_ENABLED=true`가 아니면(dry-run 모드) `dry_run`을 반환한다.
 * - 두 조건이 모두 충족되면 실제로 이미지를 준비해 업로드를 시도한다.
 * - Authorization header/Application Password/image binary는 어떤 경우에도
 *   반환값에 포함하지 않는다.
 */
export async function uploadMediaToWordPress(input: UploadMediaInput): Promise<UploadMediaResult> {
  const mediaUploadEnabled = process.env.WORDPRESS_MEDIA_UPLOAD_ENABLED === "true";
  if (!mediaUploadEnabled) {
    return { status: "skipped" };
  }

  const publishEnabled = process.env.WORDPRESS_PUBLISH_ENABLED === "true";
  if (!publishEnabled) {
    return { status: "dry_run" };
  }

  const config = getWordPressConfig();
  if (!config) {
    return {
      status: "failed",
      error: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      reasonCandidate: ["Application Password가 설정되지 않았습니다."],
    };
  }

  if (!ALLOWED_MEDIA_MIME_TYPES.includes(input.mimeType)) {
    return {
      status: "failed",
      error: `허용되지 않는 이미지 형식입니다 (${input.mimeType}). image/jpeg, image/png, image/webp만 허용됩니다.`,
      reasonCandidate: ["허용되지 않는 MIME 타입입니다."],
    };
  }

  const binaryResult = await prepareImageBinary(input);
  if (!binaryResult.success) {
    return { status: "failed", error: binaryResult.errorMessage, reasonCandidate: binaryResult.reasonCandidate };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": input.mimeType,
        "Content-Disposition": `attachment; filename="${input.filename}"`,
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: buildAuthHeader(config),
      },
      body: new Uint8Array(binaryResult.data),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorMessage = `WordPress API 네트워크 오류: ${message}`;
    return { status: "failed", error: errorMessage, reasonCandidate: getMediaUploadReasonCandidates(undefined, errorMessage) };
  }

  if (!response.ok) {
    const errorMessage = `WordPress media 업로드 실패 (HTTP ${response.status} ${response.statusText})`;
    return {
      status: "failed",
      statusCode: response.status,
      error: errorMessage,
      reasonCandidate: getMediaUploadReasonCandidates(response.status, errorMessage),
    };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", error: `WordPress 응답 파싱 실패: ${message}` };
  }

  const mediaId = typeof data.id === "number" ? data.id : Number(data.id);
  if (!mediaId || Number.isNaN(mediaId)) {
    return { status: "failed", error: "WordPress 응답에 media id가 없습니다." };
  }

  const sourceUrl =
    typeof data.source_url === "string"
      ? data.source_url
      : typeof data.link === "string"
        ? data.link
        : "";
  const mimeType = typeof data.mime_type === "string" ? data.mime_type : input.mimeType;
  const mediaType = typeof data.media_type === "string" ? data.media_type : undefined;
  const titleField = data.title as { rendered?: unknown } | undefined;
  const titleRendered = typeof titleField?.rendered === "string" ? titleField.rendered : undefined;

  const metadataUpdateStatus = await updateMediaMetadata(config, baseUrl, mediaId, input);

  return {
    status: "uploaded",
    wordpressMediaId: mediaId,
    wordpressUrl: sourceUrl,
    mimeType,
    mediaType,
    titleRendered,
    metadataUpdateStatus,
  };
}
