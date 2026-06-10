// Phase 1: Supabase 연동 전 사용하는 메모리 기반 mock 저장소.
// Next.js 개발 서버의 모듈 재평가(HMR)에도 데이터가 유지되도록
// globalThis에 싱글톤으로 보관한다.

import type { Article, Source, Theme } from "@/lib/types/domain";
import type { CollectionContractResult } from "@/lib/harness/types";

export interface ContractCheckRecord {
  themeId: string;
  target: "source" | "article";
  contractName: string;
  result: CollectionContractResult;
  checkedAt: string;
}

export interface Store {
  themes: Theme[];
  sources: Source[];
  articles: Article[];
  contractChecks: ContractCheckRecord[];
}

const globalForStore = globalThis as unknown as {
  __contentPipelineStore?: Store;
};

export function getStore(): Store {
  if (!globalForStore.__contentPipelineStore) {
    globalForStore.__contentPipelineStore = {
      themes: [],
      sources: [],
      articles: [],
      contractChecks: [],
    };
  }
  return globalForStore.__contentPipelineStore;
}

export function getThemeById(themeId: string): Theme | undefined {
  return getStore().themes.find((theme) => theme.id === themeId);
}

export function getSourcesByThemeId(themeId: string): Source[] {
  return getStore().sources.filter((source) => source.themeId === themeId);
}

export function getArticleByThemeId(themeId: string): Article | undefined {
  return getStore().articles.find((article) => article.themeId === themeId);
}

export function getLatestContractCheck(
  themeId: string,
  target: "source" | "article"
): ContractCheckRecord | undefined {
  const checks = getStore().contractChecks.filter(
    (check) => check.themeId === themeId && check.target === target
  );
  return checks[checks.length - 1];
}
