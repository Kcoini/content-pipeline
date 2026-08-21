// wordpress_blog 카드의 "WordPress 게시 미리보기" / "WordPress 반영 데이터"
// 섹션에 쓰는 순수 로직. 오직 wordpress_blog 글 자신의 제목/본문/메타데이터
// (post.postTitle/post.postBody, platformMetadata에서 읽은 seoTitle 등)만
// 사용한다 — article 원문 필드를 이 모듈에 전달하거나 여기서 읽으면 안 된다.
// 어떤 데이터도 변경하지 않고, 실제 광고 코드도 삽입하지 않는다(AD_SLOT
// marker 존재 여부만 감지해 "광고 위치 예정" 배지용 정보로 변환한다).

import { AD_SLOT_MARKERS, adSlotMarkerComment } from "@/lib/articles/article-modes";

export interface WordPressBlogPreviewInput {
  postTitle: string | null;
  postBody: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  featuredImageUrl: string | null;
}

export interface AdSlotMarkerPreview {
  marker: string;
  label: string;
}

export interface WordPressBlogPostPreview {
  title: string;
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  featuredImageUrl: string | null;
  bodyPreviewText: string;
  bodyFullLength: number;
  bodyTruncated: boolean;
  /** 본문에서 감지한 FAQ 영역 일부(없으면 null). "실제 FAQ가 있다"를 보장하지 않는 heuristic 추출이다. */
  faqPreviewText: string | null;
  /** 본문에서 감지한 참고자료/출처 영역 일부(없으면 null). */
  sourcesPreviewText: string | null;
  adSlotMarkers: AdSlotMarkerPreview[];
}

/** 본문 미리보기 기본 길이(500~800자 권장 범위의 중간값). */
export const BODY_PREVIEW_LENGTH = 700;

const AD_SLOT_LABELS: Record<string, string> = {
  after_summary: "요약 아래",
  after_intro: "도입부 아래",
  mid_content_1: "본문 중간 1",
  mid_content_2: "본문 중간 2",
  before_faq: "FAQ 앞",
  before_conclusion: "결론 앞",
};

function labelForAdSlot(marker: string): string {
  return AD_SLOT_LABELS[marker] ?? marker;
}

const FAQ_HEADING_PATTERN = /^#{0,6}\s*\*{0,2}\s*(FAQ|자주\s*묻는\s*질문)/i;
const SOURCE_HEADING_PATTERN = /^#{0,6}\s*\*{0,2}\s*(참고자료|출처|References?)/i;

/**
 * markdown 본문에서 특정 heading 패턴과 일치하는 줄을 찾아, 그 다음
 * heading(#으로 시작하는 줄) 전까지의 텍스트를 잘라 반환한다. heading을
 * 찾지 못하면 null. 실제 광고/링크 코드는 만들지 않고 텍스트만 추출한다.
 */
function extractHeadingSection(body: string, headingPattern: RegExp, maxLength = 300): string | null {
  const lines = body.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startIndex === -1) return null;

  const rest = lines.slice(startIndex + 1);
  const nextHeadingIndex = rest.findIndex((line) => /^#{1,6}\s/.test(line.trim()));
  const sectionLines = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);
  const text = sectionLines.join("\n").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function extractAdSlotMarkers(body: string): AdSlotMarkerPreview[] {
  return AD_SLOT_MARKERS.filter((position) => body.includes(adSlotMarkerComment(position))).map((position) => ({
    marker: position,
    label: labelForAdSlot(position),
  }));
}

/**
 * wordpress_blog 글의 "WordPress 게시 미리보기"에 표시할 데이터를 만든다.
 * article 원문이 아니라 이 함수에 전달된 입력(wordpress_blog 자신의 값)만
 * 사용한다.
 */
export function buildWordPressBlogPostPreview(input: WordPressBlogPreviewInput): WordPressBlogPostPreview {
  const title = input.postTitle?.trim() || "(제목 없음 — WordPress Draft 생성 시 빈 제목으로 전송됩니다)";
  const body = input.postBody ?? "";
  const bodyTruncated = body.length > BODY_PREVIEW_LENGTH;
  const bodyPreviewText = bodyTruncated ? body.slice(0, BODY_PREVIEW_LENGTH) : body;

  return {
    title,
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    targetKeyword: input.targetKeyword,
    featuredImageUrl: input.featuredImageUrl,
    bodyPreviewText,
    bodyFullLength: body.length,
    bodyTruncated,
    faqPreviewText: extractHeadingSection(body, FAQ_HEADING_PATTERN),
    sourcesPreviewText: extractHeadingSection(body, SOURCE_HEADING_PATTERN),
    adSlotMarkers: extractAdSlotMarkers(body),
  };
}
