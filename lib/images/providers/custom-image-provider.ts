// Phase 2-7: 커스텀(자체 호스팅) 이미지 생성 provider (구조만 준비).
//
// 특정 벤더에 종속되지 않는 자체 이미지 생성 endpoint를 나중에 연결할 수
// 있도록 자리만 마련한다. openai-image-provider.ts와 동일한 안전 원칙을
// 따른다: IMAGE_GENERATION_ENABLED=false면 mock으로 대체하고, 어떤 경우에도
// 예외를 던지지 않는다.

import { mockImageProvider } from "./mock-image-provider";
import { isImageGenerationEnabled } from "../image-generation-config";
import type {
  ImageGenerationProviderClient,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../image-generation-types";

export const customImageProvider: ImageGenerationProviderClient = {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    try {
      if (!isImageGenerationEnabled()) {
        const mockResult = await mockImageProvider.generateImage(request);
        return {
          ...mockResult,
          provider: "custom",
          metadata: { ...mockResult.metadata, disabled: true, fallbackProvider: "mock" },
        };
      }

      // 실제 커스텀 endpoint 연동은 이번 단계에서 구현하지 않는다.
      return {
        status: "failed",
        provider: "custom",
        metadata: {},
        error: "커스텀 이미지 생성 provider는 아직 구현되지 않았습니다 (구조만 준비됨).",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      return { status: "failed", provider: "custom", metadata: {}, error: message };
    }
  },
};
