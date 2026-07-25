// Phase 2-4: SEO Plugin 설정 유틸.
// SEO_PLUGIN_PROVIDER, SEO_PLUGIN_WRITE_ENABLED 환경 변수를 읽는다.
// 기본값은 항상 안전한 쪽(provider=none, write=false)이다.

import { isSeoPluginProvider, type SeoPluginProvider } from "./seo-plugin-types";

export interface ValidateSeoPluginProviderResult {
  provider: SeoPluginProvider;
  /** 잘못된 값이 들어와 none으로 대체된 경우에만 채워진다. */
  warning?: string;
}

/** 값이 유효한 SeoPluginProvider가 아니면 none으로 대체하고 warning을 반환한다. */
export function validateSeoPluginProvider(value: unknown): ValidateSeoPluginProviderResult {
  if (value === undefined || value === null || value === "") {
    return { provider: "none" };
  }
  if (isSeoPluginProvider(value)) {
    return { provider: value };
  }
  return {
    provider: "none",
    warning: `알 수 없는 SEO_PLUGIN_PROVIDER 값("${String(value)}")이어서 none으로 대체합니다.`,
  };
}

/** SEO_PLUGIN_PROVIDER 환경 변수를 읽어 유효한 provider를 반환한다 (기본값 none). */
export function getSeoPluginProvider(): SeoPluginProvider {
  return validateSeoPluginProvider(process.env.SEO_PLUGIN_PROVIDER).provider;
}

/**
 * SEO_PLUGIN_WRITE_ENABLED=true일 때만 실제 plugin write를 시도한다.
 * true여도 WORDPRESS_PUBLISH_ENABLED=true가 아니면 실제 WordPress API는 호출하지 않는다
 * (lib/seo/seo-plugin-writer.ts의 applySeoPluginMetadata에서 함께 확인한다).
 */
export function isSeoPluginWriteEnabled(): boolean {
  return process.env.SEO_PLUGIN_WRITE_ENABLED === "true";
}
