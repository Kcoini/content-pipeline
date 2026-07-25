// Phase 2-7: mock 이미지 생성 provider.
// 실제 외부 API를 절대 호출하지 않는다. 테스트와 개발 검증용으로 결정적인
// placeholder 결과를 반환한다.

import { getDefaultDimensions } from "../image-generation-config";
import type { ImageGenerationProviderClient, ImageGenerationRequest, ImageGenerationResult } from "../image-generation-types";

const MOCK_FORMAT = "webp";

export const mockImageProvider: ImageGenerationProviderClient = {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const { width, height } = getDefaultDimensions(request.aspectRatio);

    return {
      status: "generated",
      provider: "mock",
      model: "mock-image-generator-v1",
      imageUrl: `/mock/generated-images/${request.articleId}.${MOCK_FORMAT}`,
      width,
      height,
      format: MOCK_FORMAT,
      metadata: {
        mock: true,
        dryRun: request.dryRun,
        promptLength: request.prompt.length,
        articleMode: request.articleMode,
      },
    };
  },
};
