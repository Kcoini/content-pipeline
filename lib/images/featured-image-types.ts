// Phase 2-5: Featured Image Preparation 타입 정의.
// 실제 이미지 생성/업로드는 하지 않으며, 이미지 생성 AI에 전달할 prompt와
// alt text/caption/style 등 "준비 정보"만 다룬다.

import type { ArticleMode, FeaturedImageStatus } from "@/lib/types/domain";

export type { FeaturedImageStatus };

/** article/theme에서 추출한 featured image 준비 결과. */
export interface FeaturedImageMetadata {
  prompt: string;
  altText: string;
  caption: string;
  style: string;
  aspectRatio: string;
  /** 생성 시 피해야 할 요소 (실제 이미지 생성 API 호출 시 사용할 자리) */
  negativePrompt?: string;
  /** 어떤 장면/구도를 표현하는지 (사람이 읽는 요약) */
  visualConcept: string;
  /** 의도한 감정/분위기 */
  targetEmotion: string;
  /** 이미지 안에 텍스트를 넣지 않는다는 정책을 사람이 읽을 수 있는 문장으로 기록 */
  safeTextPolicy: string;
  articleMode: ArticleMode;
  targetKeyword?: string;
  /** 이 이미지 컨셉이 어떤 근거(제목/키워드/요약)에서 나왔는지 기록 */
  sourceBasis: string;
  /** 실제 업로드 구현 후 채워질 필드 (현재는 항상 undefined) */
  wordpressMediaId?: number;
  wordpressUrl?: string;
}
