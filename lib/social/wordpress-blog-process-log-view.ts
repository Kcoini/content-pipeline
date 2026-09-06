// /articles/[id]/blog 페이지 하단 "프로세스 로그 / 실행 이력" 섹션과
// wordpress_blog 카드 안의 "최근 WordPress 반영 결과"에서 공통으로 쓰는
// 순수 로직. pipeline_logs 원본(PipelineLogEntry[])을 받아 wordpress_blog와
// 관련된 로그만 골라내고, 카테고리/요약을 계산한다. 어떤 데이터도
// 변경하지 않는다.

import type { PipelineLogEntry, LogStatus } from "@/lib/repositories/log-repository";

export type WordPressBlogLogCategory = "wordpress" | "seo" | "image" | "publish_guard" | "handoff" | "other";

export const WORDPRESS_BLOG_LOG_CATEGORY_LABELS: Record<WordPressBlogLogCategory, string> = {
  wordpress: "WordPress",
  seo: "SEO",
  image: "대표 이미지",
  publish_guard: "게시 준비",
  handoff: "Handoff",
  other: "기타",
};

/** 카드 안 "상세 로그 보기" 필터 옵션 + 하단 로그 섹션 필터. "failed_only"는 카테고리가 아니라 status 기준 별도 필터다. */
export type WordPressBlogLogFilter = "all" | WordPressBlogLogCategory | "failed_only";

export interface WordPressBlogProcessLogEntry {
  id: string;
  eventName: string;
  status: LogStatus;
  message: string;
  createdAt: string;
  socialPostId: string | null;
  category: WordPressBlogLogCategory;
  /** raw JSON 대신 카드/로그 목록에 바로 보여줄 한 줄 요약. */
  detailsSummary: string;
  rawDetails: Record<string, unknown>;
}

export interface WordPressBlogProcessLogSummary {
  count: number;
  lastRunAt: string | null;
  lastStatus: LogStatus | null;
}

/** 이 로그가 wordpress_blog와 관련 있는지 판단한다 — details.socialPostId가 이 article의 wordpress_blog post 중 하나이거나, details.platform이 wordpress_blog면 포함한다. */
export function isWordPressBlogRelevantLog(entry: PipelineLogEntry, wordpressBlogPostIds: ReadonlySet<string>): boolean {
  const socialPostId = typeof entry.details?.socialPostId === "string" ? (entry.details.socialPostId as string) : null;
  if (socialPostId && wordpressBlogPostIds.has(socialPostId)) return true;
  if (entry.details?.platform === "wordpress_blog") return true;
  return false;
}

function categorizeLogEvent(type: string): WordPressBlogLogCategory {
  if (type.includes("draft")) return "wordpress";
  if (type.includes("seo")) return "seo";
  if (type.includes("featured_image") || type.includes("image")) return "image";
  if (type.includes("guard")) return "publish_guard";
  if (type.includes("handoff") || type.includes("checklist") || type.includes("manual_posting") || type.includes("dry_run")) {
    return "handoff";
  }
  return "other";
}

/** raw JSON을 그대로 보여주지 않고, 주요 key=value만 짧게 한 줄로 요약한다. */
function summarizeDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details).filter(([key]) => key !== "socialPostId" && key !== "platform");
  if (entries.length === 0) return "-";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === "object" && value !== null ? JSON.stringify(value).slice(0, 40) : String(value)}`)
    .join(", ");
}

/** pipeline_logs 원본 목록에서 wordpress_blog 관련 로그만 골라 표시용 형태로 변환한다(입력 순서 유지 — 최신순 정렬은 호출자가 이미 했다고 가정). */
export function buildWordPressBlogProcessLogEntries(
  logs: PipelineLogEntry[],
  wordpressBlogPostIds: ReadonlySet<string>
): WordPressBlogProcessLogEntry[] {
  return logs
    .filter((entry) => isWordPressBlogRelevantLog(entry, wordpressBlogPostIds))
    .map((entry) => ({
      id: entry.id,
      eventName: entry.type,
      status: entry.status,
      message: entry.message,
      createdAt: entry.createdAt,
      socialPostId: typeof entry.details?.socialPostId === "string" ? (entry.details.socialPostId as string) : null,
      category: categorizeLogEvent(entry.type),
      detailsSummary: summarizeDetails(entry.details),
      rawDetails: entry.details,
    }));
}

/** 필터(전체/카테고리/실패만)에 맞는 로그만 남긴다. */
export function filterWordPressBlogProcessLogEntries(
  entries: WordPressBlogProcessLogEntry[],
  filter: WordPressBlogLogFilter
): WordPressBlogProcessLogEntry[] {
  if (filter === "all") return entries;
  if (filter === "failed_only") return entries.filter((entry) => entry.status === "failed");
  return entries.filter((entry) => entry.category === filter);
}

/** 카드 안 "최근 WordPress 반영 결과" 요약(로그 개수/마지막 실행 시간/마지막 상태)을 계산한다. entries는 최신순 정렬을 가정한다. */
export function summarizeWordPressBlogProcessLog(entries: WordPressBlogProcessLogEntry[]): WordPressBlogProcessLogSummary {
  if (entries.length === 0) {
    return { count: 0, lastRunAt: null, lastStatus: null };
  }
  return { count: entries.length, lastRunAt: entries[0].createdAt, lastStatus: entries[0].status };
}

/**
 * 하단 로그 목록에 보여줄 순서를 정한다 — "실패 로그가 있으면 실패
 * 로그를 우선 표시"(요구사항)하기 위해, 실패 로그를 앞으로 모으고
 * 나머지는 원래 순서(최신순)를 그대로 유지한다. 실패 로그가 없으면
 * 입력 순서 그대로 반환한다.
 */
export function sortWordPressBlogProcessLogEntriesForDisplay(
  entries: WordPressBlogProcessLogEntry[]
): WordPressBlogProcessLogEntry[] {
  const failed = entries.filter((entry) => entry.status === "failed");
  if (failed.length === 0) return entries;
  const others = entries.filter((entry) => entry.status !== "failed");
  return [...failed, ...others];
}

/** 특정 socialPostId(카드 하나)에 속한 로그만 남긴다 — 하단 섹션을 카드별로 나눠 보여줄 때 쓴다. */
export function filterWordPressBlogProcessLogEntriesByPost(
  entries: WordPressBlogProcessLogEntry[],
  socialPostId: string
): WordPressBlogProcessLogEntry[] {
  return entries.filter((entry) => entry.socialPostId === socialPostId);
}
