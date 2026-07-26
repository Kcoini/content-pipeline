// Phase 2-13: Custom WordPress SEO Metadata Endpoint (Rank Math 전용) client.
// 표준 WordPress posts REST API(POST /wp-json/wp/v2/posts/{id})로는 Rank Math
// SEO metadata 반영 여부가 확인되지 않아(Phase 2-12), WordPress 쪽에 배포한
// custom REST endpoint(wordpress-plugin/ai-pipeline-seo-endpoint)를 통해
// update_post_meta로 직접 저장한다. 이 파일은 서버 전용이며 client component
// 에서 import하지 않는다. Authorization header/password는 어떤 경우에도
// 반환값이나 로그에 포함하지 않는다.

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

function buildAuthHeader(config: WordPressConfig): string {
  const authToken = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
  return `Basic ${authToken}`;
}

/** WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=true일 때만 custom endpoint를 사용한다 (기본값 false). */
export function isSeoCustomEndpointEnabled(): boolean {
  return process.env.WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED === "true";
}

const DEFAULT_ENDPOINT_PATH = "/wp-json/ai-pipeline/v1/seo-meta";

/** custom endpoint 경로. 기본값은 wordpress-plugin/ai-pipeline-seo-endpoint가 등록하는 경로와 같다. */
export function getSeoCustomEndpointPath(): string {
  return process.env.WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH || DEFAULT_ENDPOINT_PATH;
}

function getLikelyCausesForStatus(status: number): string[] {
  if (status === 401) {
    return [
      "username 또는 Application Password 오류",
      "Application Password 복사 오류",
      "보안 플러그인에서 REST API 인증 차단 가능성",
    ];
  }
  if (status === 403) {
    return [
      "사용자 권한 부족 (edit_post 권한 필요)",
      "REST API 쓰기 권한 제한",
      "보안 플러그인 차단 가능성",
    ];
  }
  if (status === 404) {
    return [
      "WORDPRESS_SEO_CUSTOM_ENDPOINT_PATH이 올바른지 확인하세요",
      "wordpress-plugin/ai-pipeline-seo-endpoint 플러그인이 활성화되지 않았을 수 있습니다",
      "REST API 차단 가능성",
    ];
  }
  if (status >= 500) {
    return ["WordPress 서버 오류입니다.", "custom plugin 코드 오류 가능성이 있습니다."];
  }
  return [`알 수 없는 오류입니다 (HTTP ${status}).`];
}

export interface UpdateRankMathSeoInput {
  postId: number;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
}

export interface UpdateRankMathSeoSuccess {
  success: true;
  postId: number;
  updatedKeys: string[];
  verified: boolean;
}

export interface UpdateRankMathSeoFailure {
  success: false;
  statusCode?: number;
  errorMessage: string;
  reasonCandidate: string[];
}

export type UpdateRankMathSeoResult = UpdateRankMathSeoSuccess | UpdateRankMathSeoFailure;

/**
 * WordPress custom REST endpoint(`ai-pipeline/v1/seo-meta`)를 호출해 Rank Math
 * SEO metadata를 `update_post_meta`로 직접 저장한다 (Phase 2-13). 이 함수는
 * `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`/provider 확인을 하지 않는다 —
 * 호출자(lib/seo/seo-plugin-actual-write-service.ts)가 먼저 확인한다.
 */
export async function updateRankMathSeoViaCustomEndpoint(
  input: UpdateRankMathSeoInput
): Promise<UpdateRankMathSeoResult> {
  const config = getWordPressConfig();
  if (!config) {
    return {
      success: false,
      errorMessage: "WORDPRESS_BASE_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD가 설정되지 않았습니다.",
      reasonCandidate: ["Application Password가 설정되지 않았습니다."],
    };
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const path = getSeoCustomEndpointPath();
  const endpoint = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const body = {
    postId: input.postId,
    provider: "rank_math",
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    focusKeyword: input.focusKeyword,
    secondaryKeywords: input.secondaryKeywords ?? [],
  };

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
    return {
      success: false,
      errorMessage: `custom endpoint 네트워크 오류: ${message}`,
      reasonCandidate: ["사이트 접근 불가", "SSL 문제", "방화벽 또는 보안 플러그인 문제"],
    };
  }

  if (!response.ok) {
    return {
      success: false,
      statusCode: response.status,
      errorMessage: `custom endpoint 호출 실패 (HTTP ${response.status} ${response.statusText})`,
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
      errorMessage: `custom endpoint 응답 파싱 실패: ${message}`,
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  if (data.success !== true) {
    return {
      success: false,
      errorMessage: "custom endpoint가 실패를 반환했습니다.",
      reasonCandidate: ["WordPress plugin이 활성화되어 있지 않거나 오류가 발생했을 수 있습니다."],
    };
  }

  const postId = typeof data.postId === "number" ? data.postId : Number(data.postId);
  if (!postId || Number.isNaN(postId)) {
    return {
      success: false,
      errorMessage: "custom endpoint 응답에 post id가 없습니다.",
      reasonCandidate: ["원인을 특정할 수 없는 오류입니다."],
    };
  }

  const updatedKeys = Array.isArray(data.updatedKeys)
    ? data.updatedKeys.filter((key): key is string => typeof key === "string")
    : [];
  const verified = data.verified === true;

  return { success: true, postId, updatedKeys, verified };
}
