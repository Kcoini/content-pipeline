// Phase 1-13: 테마 키워드 기반 기사 URL 후보 수집 서비스.
// ARTICLE_SEARCH_ENABLED=false이면 mock provider를 사용한다.
// ARTICLE_SEARCH_ENABLED=true이면 네이버/다음 API를 실제로 호출한다.

import { buildSearchQueries } from "./search-query-builder";
import { generateMockArticleCandidates } from "./mock-article-search-provider";
import { searchNaverNews } from "@/lib/trends/naver-client";
import { searchDaumNews } from "@/lib/trends/daum-client";
import { isNaverKeySet, isDaumKeySet } from "@/lib/trends/trend-service";
import {
  upsertArticleUrlCandidates,
  getArticleUrlCandidatesByThemeId,
  updateArticleUrlCandidateStatus,
} from "@/lib/repositories/article-url-candidate-repository";
import { logEvent } from "@/lib/repositories/log-repository";
import type { Theme, ArticleUrlCandidate } from "@/lib/types/domain";
import type { TrendSearchResult } from "@/lib/trends/types";

function isArticleSearchEnabled(): boolean {
  return process.env.ARTICLE_SEARCH_ENABLED === "true";
}

/**
 * Phase 3-27: 수집 결과 화면(성공/부분 성공/결과 없음/실패)을 정확히
 * 계산할 수 있도록, 그냥 저장된 후보 배열이 아니라 이번 실행에서 무엇을
 * 찾았고 무엇이 이미 있었는지까지 함께 반환한다.
 */
export interface ArticleUrlCollectionResult {
  /** 이번 실행에서 새로 저장된 후보(이미 존재하던 URL은 제외됨). */
  saved: ArticleUrlCandidate[];
  /** 이번 검색으로 찾은 전체 후보 수(저장 여부와 무관, 중복 제거 후). */
  totalFound: number;
  /** 찾았지만 이미 후보로 등록되어 있어 새로 저장하지 않은 개수. */
  duplicateCount: number;
  /** 실제 API 검색을 시도한 (플랫폼×검색어) 작업 수. mock 모드/키 미설정이면 0. */
  attemptedTaskCount: number;
  /** 그중 실패한 작업 수. */
  failedTaskCount: number;
}

/**
 * theme의 keywords를 바탕으로 관련 기사 URL 후보를 수집해 article_url_candidates에 저장한다.
 */
export async function collectArticleUrlCandidates(
  theme: Theme
): Promise<ArticleUrlCollectionResult> {
  await logEvent({
    type: "article_url_collection_started",
    status: "info",
    message: isArticleSearchEnabled()
      ? `실제 API로 기사 URL 수집 시작: ${theme.title}`
      : `mock 모드로 기사 URL 수집 시작: ${theme.title}`,
    themeId: theme.id,
    details: { themeId: theme.id, themeTitle: theme.title, mode: isArticleSearchEnabled() ? "api" : "mock" },
  });

  try {
    const queries = buildSearchQueries(theme);
    const now = new Date().toISOString();
    let candidateDrafts: Omit<ArticleUrlCandidate, "id">[];
    let attemptedTaskCount = 0;
    let failedTaskCount = 0;

    if (!isArticleSearchEnabled()) {
      candidateDrafts = [];
      const platforms: Array<"naver" | "daum"> = ["naver", "daum"];
      let rankBase = 0;

      for (const query of queries.slice(0, 2)) {
        for (const platform of platforms) {
          const mocks = generateMockArticleCandidates({
            themeId: theme.id,
            themeTitle: theme.title,
            keywords: theme.keywords,
            query,
            platform,
            count: 4,
            baseRank: rankBase,
          }, now);
          candidateDrafts.push(...mocks);
          rankBase += 4;
        }
      }
    } else {
      // 실제 네이버/다음 API로 검색 (최대 3개 쿼리 × 2 플랫폼)
      const searchQueries = queries.slice(0, 3);
      const allResults: TrendSearchResult[] = [];

      await Promise.allSettled(
        searchQueries.flatMap((query) => {
          const tasks: Promise<void>[] = [];

          if (isNaverKeySet()) {
            attemptedTaskCount++;
            tasks.push(
              searchNaverNews(query, 5)
                .then((results) => { allResults.push(...results); })
                .catch(() => { failedTaskCount++; /* 개별 query 실패는 기록만 하고 계속 */ })
            );
          }

          if (isDaumKeySet()) {
            attemptedTaskCount++;
            tasks.push(
              searchDaumNews(query, 5)
                .then((results) => { allResults.push(...results); })
                .catch(() => { failedTaskCount++; /* 개별 query 실패는 기록만 하고 계속 */ })
            );
          }

          return tasks;
        })
      );

      // URL 중복 제거
      const seen = new Set<string>();
      const unique = allResults.filter((r) => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      // Phase 3-27: 검색어를 시도조차 못했거나(키 미설정) 시도한 작업이
      // 전부 실패했으면 "실패"로 취급한다. 일부/전체 작업이 성공했는데
      // 단지 결과가 0건이면(정상적으로 검색은 됐지만 관련 기사가 없는
      // 경우) 예외를 던지지 않고 "결과 없음"으로 넘어간다 — 호출자가
      // 이 차이로 "오류" 문구와 "결과 없음" 문구를 다르게 보여준다.
      if (unique.length === 0 && (attemptedTaskCount === 0 || failedTaskCount >= attemptedTaskCount)) {
        throw new Error(
          "기사 URL을 수집하지 못했습니다. NAVER_CLIENT_ID/NAVER_CLIENT_SECRET 또는 KAKAO_REST_API_KEY를 확인하세요."
        );
      }

      candidateDrafts = unique.map((r, index) => ({
        themeId: theme.id,
        themeClusterId: null,
        platform: r.platform,
        query: r.keyword,
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        publisher: null,
        publishedAt: r.publishedAt,
        rankPosition: index + 1,
        status: "candidate" as const,
        metadata: {},
        collectedAt: now,
        createdAt: now,
        updatedAt: now,
      }));
    }

    const saved = await upsertArticleUrlCandidates(candidateDrafts);

    await logEvent({
      type: "article_url_collection_completed",
      status: "success",
      message: `기사 URL 후보 ${saved.length}건 수집 완료`,
      themeId: theme.id,
      details: {
        count: saved.length,
        totalFound: candidateDrafts.length,
        duplicateCount: candidateDrafts.length - saved.length,
        themeId: theme.id,
      },
    });

    return {
      saved,
      totalFound: candidateDrafts.length,
      duplicateCount: candidateDrafts.length - saved.length,
      attemptedTaskCount,
      failedTaskCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({
      type: "article_url_collection_failed",
      status: "failed",
      message: `기사 URL 수집 실패: ${message}`,
      themeId: theme.id,
      details: { error: message, themeId: theme.id },
    });
    throw err;
  }
}

/** 특정 테마의 URL 후보 목록을 반환한다. */
export async function getArticleUrlCandidates(
  themeId: string
): Promise<ArticleUrlCandidate[]> {
  return getArticleUrlCandidatesByThemeId(themeId);
}

/** 후보를 제외(dismissed) 처리한다. */
export async function dismissArticleUrlCandidate(candidateId: string): Promise<void> {
  await updateArticleUrlCandidateStatus(candidateId, "dismissed");

  await logEvent({
    type: "article_url_candidate_dismissed",
    status: "info",
    message: "기사 URL 후보 제외",
    details: { candidateId },
  });
}
