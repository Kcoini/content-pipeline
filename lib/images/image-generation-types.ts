// Phase 2-7: Image Generation Integration 타입 정의.
// Phase 2-5에서 준비한 prompt/alt text/caption/style/aspect ratio를 바탕으로
// 실제 또는 mock 이미지 생성 결과를 다루기 위한 공통 타입이다.

import type { ArticleMode, GeneratedImageStatus, ImageGenerationProvider } from "@/lib/types/domain";

export type { ImageGenerationProvider, GeneratedImageStatus };

/** 이미지 생성 provider(mock/openai/custom)에 전달할 공통 요청. */
export interface ImageGenerationRequest {
  articleId: string;
  provider: ImageGenerationProvider;
  model?: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  width?: number;
  height?: number;
  style?: string;
  altText?: string;
  caption?: string;
  articleMode: ArticleMode;
  targetKeyword?: string;
  /** true이면 실제 API를 호출하지 않고 mock/skip 경로로 처리한다. */
  dryRun: boolean;
  outputFormat?: string;
}

/** provider가 반환하는 공통 결과. */
export interface ImageGenerationResult {
  status: GeneratedImageStatus;
  provider: ImageGenerationProvider;
  model?: string;
  imageUrl?: string;
  localPath?: string;
  width?: number;
  height?: number;
  format?: string;
  metadata: Record<string, unknown>;
  /** 실패 시에만 채워지며, 안전하게 정리된(비밀정보 미포함) 메시지여야 한다. */
  error?: string;
}

/** provider 구현체 공통 인터페이스. */
export interface ImageGenerationProviderClient {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
