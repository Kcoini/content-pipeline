// Phase 2-7: Image Generation 설정 유틸.
// IMAGE_GENERATION_PROVIDER/IMAGE_GENERATION_ENABLED 등 환경 변수를 읽는다.
// 기본값은 항상 안전한 쪽(provider=mock, enabled=false)이다.

import type { ImageGenerationProvider } from "@/lib/types/domain";

function isImageGenerationProvider(value: unknown): value is ImageGenerationProvider {
  return value === "mock" || value === "openai" || value === "custom";
}

/** IMAGE_GENERATION_PROVIDER 환경 변수를 읽어 유효한 provider를 반환한다 (기본값 mock). */
export function getImageGenerationProvider(): ImageGenerationProvider {
  const raw = process.env.IMAGE_GENERATION_PROVIDER;
  return isImageGenerationProvider(raw) ? raw : "mock";
}

/** IMAGE_GENERATION_ENABLED=true일 때만 실제 provider API를 호출한다 (기본값 false). */
export function isImageGenerationEnabled(): boolean {
  return process.env.IMAGE_GENERATION_ENABLED === "true";
}

const DEFAULT_TIMEOUT_MS = 30000;

export function getImageGenerationTimeoutMs(): number {
  const raw = process.env.IMAGE_GENERATION_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/** IMAGE_GENERATION_DEFAULT_MODEL이 비어 있으면 undefined를 반환한다 (provider 기본값 사용). */
export function getDefaultImageModel(): string | undefined {
  const raw = process.env.IMAGE_GENERATION_DEFAULT_MODEL;
  return raw && raw.trim() ? raw.trim() : undefined;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

const DEFAULT_DIMENSIONS_BY_ASPECT_RATIO: Record<string, ImageDimensions> = {
  "16:9": { width: 1536, height: 864 },
  "4:3": { width: 1200, height: 900 },
  "1:1": { width: 1024, height: 1024 },
};

const FALLBACK_DIMENSIONS: ImageDimensions = DEFAULT_DIMENSIONS_BY_ASPECT_RATIO["16:9"];

/** aspect ratio 문자열("16:9" 등)에 맞는 기본 픽셀 크기를 반환한다. 알 수 없으면 16:9 기본값을 사용한다. */
export function getDefaultDimensions(aspectRatio: string): ImageDimensions {
  return DEFAULT_DIMENSIONS_BY_ASPECT_RATIO[aspectRatio] ?? FALLBACK_DIMENSIONS;
}
