// Phase 2-7: provider별 client 선택 진입점.

import { mockImageProvider } from "./mock-image-provider";
import { openaiImageProvider } from "./openai-image-provider";
import { customImageProvider } from "./custom-image-provider";
import type { ImageGenerationProvider, ImageGenerationProviderClient } from "../image-generation-types";

export { mockImageProvider, openaiImageProvider, customImageProvider };

export function getImageProviderClient(provider: ImageGenerationProvider): ImageGenerationProviderClient {
  switch (provider) {
    case "openai":
      return openaiImageProvider;
    case "custom":
      return customImageProvider;
    case "mock":
    default:
      return mockImageProvider;
  }
}
