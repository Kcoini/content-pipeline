// wordpress_blog 전용: usable source(요약 또는 key_points가 있는 출처)
// 개수에 따라 생성 모드를 분류한다.
//
// "usable source"의 기준은 lib/ai/article-writer.ts의
// isUsableSourceSummary()와 동일하다 — key_points 또는 summary가 있는
// 출처만 "종합할 사실이 있는 출처"로 센다. 단순히 URL만 등록되고 아직
// 요약/key_points가 없는 출처는 세지 않는다.
//
// 분류:
// - no_source(usable 0개): wordpress_blog 생성을 차단한다.
// - single_source(usable 1개): 생성은 허용하되 single_source_mode로
//   작성한다 — 출처가 하나뿐이라는 한계를 인지하고, 정보를 부풀리거나
//   추측하지 않으며, 확인 필요 사항을 명확히 남긴다.
// - multi_source(usable 2개 이상): 기존 source-grounded reconstruction
//   방식(normal_source_grounded_mode) 그대로 진행한다.

export type WordPressBlogSourceMode = "no_source" | "single_source" | "multi_source";

/** key_points 또는 summary가 있으면 "사용 가능한 출처"로 센다. */
export function isUsableSource(source: { summary: string; keyPoints: string[] }): boolean {
  return source.keyPoints.length > 0 || source.summary.trim().length > 0;
}

export function countUsableSources(sources: readonly { summary: string; keyPoints: string[] }[]): number {
  return sources.filter(isUsableSource).length;
}

export function classifyWordPressBlogSourceMode(usableSourceCount: number): WordPressBlogSourceMode {
  if (usableSourceCount <= 0) return "no_source";
  if (usableSourceCount === 1) return "single_source";
  return "multi_source";
}

/** single_source_mode 글에 항상 남기는 안내 문구 — metadata.sourceLimitWarning에 저장한다. */
export const SINGLE_SOURCE_LIMIT_WARNING =
  "이 글은 사용 가능한 출처 1개를 기반으로 작성되었습니다. 조건과 신청 기간은 공식 안내에서 재확인해야 합니다.";

/** usable source가 0개일 때 생성을 차단하며 보여주는 안내 문구. */
export const NO_SOURCE_BLOCKED_MESSAGE =
  "사용 가능한 출처가 없어 wordpress_blog 글을 생성할 수 없습니다. 출처를 추가(또는 요약이 완료되도록 대기)한 뒤 다시 생성하세요.";
