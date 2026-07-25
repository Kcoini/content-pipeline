// Phase 2-7: OpenAI 이미지 생성 provider (구조만 준비 — 실제 호출은 아직 구현하지 않는다).
//
// IMAGE_GENERATION_ENABLED=false이면 mock provider로 안전하게 대체한다
// (disabled fallback, 결과는 provider="openai"로 표시되지만 실제 API는 호출하지
// 않는다). true이면 OPENAI_API_KEY 존재 여부를 확인하고, 실제 호출 로직은
// 아직 구현하지 않았으므로 명확한 오류를 반환한다 (실제 시크릿 키는 절대
// 로그/오류 메시지에 포함하지 않는다). 어떤 경우에도 예외를 던지지 않는다.

import { mockImageProvider } from "./mock-image-provider";
import { isImageGenerationEnabled, getImageGenerationTimeoutMs } from "../image-generation-config";
import type {
  ImageGenerationProviderClient,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../image-generation-types";

export const openaiImageProvider: ImageGenerationProviderClient = {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    try {
      if (!isImageGenerationEnabled()) {
        const mockResult = await mockImageProvider.generateImage(request);
        return {
          ...mockResult,
          provider: "openai",
          metadata: { ...mockResult.metadata, disabled: true, fallbackProvider: "mock" },
        };
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          status: "failed",
          provider: "openai",
          metadata: {},
          error: "OPENAI_API_KEY가 설정되지 않았습니다.",
        };
      }

      // 실제 OpenAI 이미지 생성 API(images.generate 등) 호출은 이번 단계에서
      // 구현하지 않는다. 타임아웃 설정만 자리를 마련해 둔다.
      void getImageGenerationTimeoutMs();

      return {
        status: "failed",
        provider: "openai",
        metadata: {},
        error: "실제 OpenAI 이미지 생성 API 연동은 아직 구현되지 않았습니다 (구조만 준비됨).",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      return { status: "failed", provider: "openai", metadata: {}, error: message };
    }
  },
};
