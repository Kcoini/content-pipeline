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
  const authToken = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");

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

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header는 절대 로그로 출력하지 않는다.
        Authorization: `Basic ${authToken}`,
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
