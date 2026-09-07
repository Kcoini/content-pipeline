// Phase 3-21: "테마 → 출처 → 플랫폼별 글 생성" 흐름을 되살리기 위한
// 선택/전체 플랫폼 글 생성 오케스트레이션. 기존 개별 생성(generateSocialDraft,
// Phase 3-2/3-3)을 그대로 재사용하며, 새로운 AI 호출 로직을 추가하지
// 않는다 — 이 파일은 "여러 플랫폼에 대해 개별 생성을 순서대로/안전하게
// 호출하고 결과를 요약"하는 역할만 한다.
//
// 중요 원칙(반드시 지킨다):
// - 자동 public publish는 어떤 경우에도 호출하지 않는다(WordPress Draft
//   반영/공개 게시 관련 함수를 이 파일이 import하지 않는다).
// - 이미 생성된(archived되지 않은) 플랫폼 글이 있으면 기본적으로
//   건너뛴다(조용히 덮어쓰지 않는다) — 재생성은 각 플랫폼 카드의 개별
//   생성 버튼(기존 generateSocialDraftAction)에서 사용자가 명시적으로
//   다시 시도해야 한다.
// - 한 플랫폼이 실패해도 나머지 플랫폼 처리를 중단하지 않는다.
// - 무반응 금지: 항상 플랫폼별 결과(성공/건너뜀/실패)를 구조화된 값으로
//   반환한다.

import { logEvent } from "@/lib/harness/logger";
import { generateSocialDraft } from "./social-draft-generation-service";
import { listSocialPostsByArticle } from "@/lib/repositories/social-posts-repository";
import { getRecommendedToneForPlatform } from "./platform-generation-recommendations";
import { SOCIAL_PLATFORMS, type SocialPlatform, type ToneStyle } from "./social-platform-types";

/** 문체 선택 모드 — UI의 "문체 설정" 라디오 3종과 1:1로 대응한다. */
export type ToneSelectionMode = "auto_recommended" | "same_for_all" | "manual_per_platform";

export interface PlatformGenerationRequest {
  articleId: string;
  platforms: SocialPlatform[];
  toneMode: ToneSelectionMode;
  /** toneMode==="same_for_all"일 때 전체 플랫폼에 적용할 tone_style. */
  uniformToneStyle?: ToneStyle;
  /** toneMode==="manual_per_platform"일 때 플랫폼별 tone_style. 누락된 플랫폼은 추천 문체로 대체한다. */
  toneStylesByPlatform?: Partial<Record<SocialPlatform, ToneStyle>>;
}

export type PlatformGenerationStatus = "generated" | "skipped_existing" | "failed";

export interface PlatformGenerationOutcome {
  platform: SocialPlatform;
  status: PlatformGenerationStatus;
  message: string;
  socialPostId?: string;
}

export interface PlatformGenerationSummary {
  results: PlatformGenerationOutcome[];
  generatedCount: number;
  skippedCount: number;
  failedCount: number;
}

/** toneMode에 따라 이 플랫폼에 실제로 사용할 tone_style을 결정하고, 자동/수동 선택 로그 이벤트 타입을 함께 반환한다. */
function resolveToneStyle(
  platform: SocialPlatform,
  request: Pick<PlatformGenerationRequest, "toneMode" | "uniformToneStyle" | "toneStylesByPlatform">
): { toneStyle: ToneStyle; autoSelected: boolean } {
  if (request.toneMode === "manual_per_platform") {
    const manual = request.toneStylesByPlatform?.[platform];
    if (manual) return { toneStyle: manual, autoSelected: false };
    // 수동 모드인데 이 플랫폼의 선택값이 없으면 조용히 건너뛰지 않고 추천 문체로 안전하게 대체한다.
    return { toneStyle: getRecommendedToneForPlatform(platform), autoSelected: true };
  }
  if (request.toneMode === "same_for_all" && request.uniformToneStyle) {
    return { toneStyle: request.uniformToneStyle, autoSelected: false };
  }
  return { toneStyle: getRecommendedToneForPlatform(platform), autoSelected: true };
}

async function logPlatformGenerationEvent(
  type: Parameters<typeof logEvent>[0]["type"],
  status: "info" | "success" | "failed",
  message: string,
  articleId: string,
  platform: SocialPlatform,
  details?: Record<string, unknown>
): Promise<void> {
  await logEvent({
    type,
    status,
    message,
    articleId,
    targetType: "article",
    targetId: articleId,
    details: { platform, ...details },
  }).catch(() => undefined);
}

/**
 * 지정된 플랫폼 목록에 대해 순서대로 글 생성을 시도한다. 이미 생성된
 * (archived되지 않은) 글이 있는 플랫폼은 건너뛴다. 실패한 플랫폼이 있어도
 * 나머지는 계속 진행한다. 실제 AI 호출은 기존 generateSocialDraft를 그대로
 * 재사용한다(새 프롬프트/모델 로직 없음).
 */
export async function generatePlatformPosts(request: PlatformGenerationRequest): Promise<PlatformGenerationSummary> {
  const { articleId, platforms } = request;

  const existingPosts = await listSocialPostsByArticle(articleId);
  const existingPlatforms = new Set(existingPosts.map((post) => post.platform));

  const results: PlatformGenerationOutcome[] = [];

  for (const platform of platforms) {
    if (existingPlatforms.has(platform)) {
      const message = "이미 생성된 글이 있어 건너뛰었습니다. 재생성하려면 해당 플랫폼 카드에서 다시 시도하세요.";
      await logPlatformGenerationEvent(
        "platform_generation_skipped_existing",
        "info",
        `${platform} 글이 이미 있어 건너뜁니다.`,
        articleId,
        platform
      );
      results.push({ platform, status: "skipped_existing", message });
      continue;
    }

    const { toneStyle, autoSelected } = resolveToneStyle(platform, request);
    await logPlatformGenerationEvent(
      autoSelected ? "platform_generation_tone_auto_selected" : "platform_generation_tone_manual_selected",
      "info",
      `${platform}에 tone_style=${toneStyle} 적용 (${autoSelected ? "자동 추천" : "수동 선택"}).`,
      articleId,
      platform,
      { toneStyle, autoSelected }
    );

    await logPlatformGenerationEvent(
      "platform_generation_started",
      "info",
      `${platform} 글 생성을 시작합니다.`,
      articleId,
      platform,
      { toneStyle }
    );

    try {
      const result = await generateSocialDraft(articleId, platform, toneStyle);
      if (result.success) {
        await logPlatformGenerationEvent(
          "platform_generation_completed",
          "success",
          `${platform} 글 생성을 완료했습니다.`,
          articleId,
          platform,
          { socialPostId: result.socialPost?.id, toneStyle }
        );
        results.push({ platform, status: "generated", message: result.message, socialPostId: result.socialPost?.id });
      } else {
        await logPlatformGenerationEvent(
          "platform_generation_failed",
          "failed",
          `${platform} 글 생성에 실패했습니다: ${result.message}`,
          articleId,
          platform,
          { toneStyle }
        );
        results.push({ platform, status: "failed", message: result.message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      await logPlatformGenerationEvent(
        "platform_generation_failed",
        "failed",
        `${platform} 글 생성 중 예외가 발생했습니다: ${message}`,
        articleId,
        platform
      );
      results.push({ platform, status: "failed", message });
    }
  }

  return summarize(results);
}

function summarize(results: PlatformGenerationOutcome[]): PlatformGenerationSummary {
  return {
    results,
    generatedCount: results.filter((r) => r.status === "generated").length,
    skippedCount: results.filter((r) => r.status === "skipped_existing").length,
    failedCount: results.filter((r) => r.status === "failed").length,
  };
}

/**
 * 선택된 플랫폼만 생성한다("선택한 플랫폼 글 생성" 메인 버튼). platforms가
 * 비어 있으면(사용자가 아무것도 체크하지 않고 눌렀으면) 무반응 대신
 * 명확한 안내를 반환한다.
 */
export async function generateSelectedPlatformPosts(
  request: Omit<PlatformGenerationRequest, "platforms"> & { platforms: SocialPlatform[] }
): Promise<PlatformGenerationSummary | { error: string }> {
  if (request.platforms.length === 0) {
    return { error: "생성할 플랫폼을 1개 이상 선택하세요." };
  }
  await logPlatformGenerationEvent(
    "platform_generation_selected_requested",
    "info",
    `선택한 플랫폼(${request.platforms.join(", ")}) 글 생성을 요청했습니다.`,
    request.articleId,
    request.platforms[0],
    { platforms: request.platforms }
  );
  return generatePlatformPosts(request);
}

/**
 * 전체 플랫폼을 대상으로 생성한다("전체 플랫폼 글 생성" 고급 옵션).
 * 반드시 UI에서 확인 모달을 거친 뒤(confirmed=true) 호출해야 한다 — 이
 * 함수 자체는 confirmed 여부를 검사하지 않으므로, 호출부(action)가 확인
 * 절차를 강제한다.
 */
export async function generateAllPlatformPosts(
  request: Omit<PlatformGenerationRequest, "platforms">
): Promise<PlatformGenerationSummary> {
  const platforms = [...SOCIAL_PLATFORMS];
  await logPlatformGenerationEvent(
    "platform_generation_all_requested",
    "info",
    "전체 플랫폼 글 생성을 요청했습니다(확인 모달 통과 후).",
    request.articleId,
    platforms[0],
    { platforms }
  );
  await logPlatformGenerationEvent(
    "platform_generation_cost_warning_shown",
    "info",
    "전체 플랫폼 글 생성 비용 경고를 표시하고 사용자가 확인했습니다.",
    request.articleId,
    platforms[0]
  );
  return generatePlatformPosts({ ...request, platforms });
}
