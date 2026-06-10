// 도메인 타입 정의 (Phase 1: Supabase 연동 전 메모리 스토어 기준)
// db/schema.sql의 topics/sources/articles와 필드를 최대한 맞춘다.

export type Language = "ko" | "en";

export interface Theme {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  language: Language;
  createdAt: string;
}

export interface Source {
  id: string;
  themeId: string;
  url: string;
  title: string;
  /** 출판사/기관명 */
  publisher: string;
  /** 발행일 (YYYY-MM-DD, 입력하지 않으면 빈 문자열) */
  publishedAt: string;
  summary: string;
  createdAt: string;
}

export type ArticleStatus = "draft" | "reviewed" | "published";

export interface Article {
  id: string;
  themeId: string;
  title: string;
  content: string;
  status: ArticleStatus;
  /** 기사가 인용한 출처 id 목록 (최소 3개) */
  citedSourceIds: string[];
  createdAt: string;
}
