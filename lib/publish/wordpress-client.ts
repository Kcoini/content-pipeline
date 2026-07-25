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

// ─────────────────────────────────────────────────────────────
// Phase 2-6: WordPress media upload (safe stub — 실제 업로드는 구현하지 않는다)
//
// 실제 이미지 파일 read/download/multipart upload는 이번 단계에서 구현하지
// 않는다. WORDPRESS_MEDIA_UPLOAD_ENABLED/WORDPRESS_PUBLISH_ENABLED 값에 따라
// skipped/dry_run만 반환하며, 나중에 실제 업로드를 구현할 때 이 함수 내부만
// 교체하면 되도록 인터페이스만 준비한다.
// ─────────────────────────────────────────────────────────────

export interface UploadMediaInput {
  filename: string;
  mimeType: string;
  altText: string;
  caption: string;
  title: string;
  description: string;
}

export type UploadMediaStatus = "dry_run" | "skipped" | "uploaded" | "failed";

export interface UploadMediaResult {
  status: UploadMediaStatus;
  wordpressMediaId?: number;
  wordpressUrl?: string;
  error?: string;
}

/**
 * WordPress media endpoint(`/wp-json/wp/v2/media`)에 이미지를 업로드한다 (safe stub).
 *
 * - `WORDPRESS_MEDIA_UPLOAD_ENABLED=false`(기본값)이면 업로드 기능 자체가
 *   꺼져 있으므로 `skipped`를 반환한다.
 * - `WORDPRESS_PUBLISH_ENABLED=true`가 아니면(dry-run 모드) `dry_run`을 반환한다.
 * - 두 조건이 모두 충족되어도 실제 파일 처리/multipart 업로드는 아직 구현되지
 *   않았으므로 `failed`를 반환한다 (커스텀 구현 전까지의 안전장치).
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

  // 실제 파일 read/download/multipart upload는 이번 단계에서 구현하지 않는다.
  void input;
  return {
    status: "failed",
    error: "실제 WordPress media upload는 아직 구현되지 않았습니다 (파일 처리 로직이 필요합니다).",
  };
}
