// Phase 3-5: Manual Export & Copy Workflow — export payload 검증.
// buildManualExportPayload()가 만든 결과를 저장하기 전에 다시 한 번
// 검사한다. 실제 게시는 하지 않으며, 이 모듈은 순수 함수만 제공한다
// (예외를 던지지 않는다).

import type { ManualExportResult } from "./social-export-builder";
import type { SocialPost } from "./social-platform-types";

const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];
const X_MAX_ITEM_LENGTH = 280;

export interface ManualExportValidationResult {
  valid: boolean;
  blocked: boolean;
  errors: string[];
  warnings: string[];
}

function collectProhibitedMatches(text: string): string[] {
  const found: string[] = [];
  for (const pattern of [...THREAT_PATTERNS, ...AD_CLICK_BAIT_PATTERNS, ...INCOME_GUARANTEE_PATTERNS]) {
    if (text.includes(pattern)) found.push(pattern);
  }
  return found;
}

function normalizeHashtags(hashtags: string[] | undefined): string[] {
  return (hashtags ?? []).map((tag) => tag.trim().replace(/^#/, "")).filter((tag) => tag.length > 0);
}

/**
 * manual export payload를 검증한다. 플랫폼별 필수 필드 존재, 금지 표현
 * 재검사, X thread item 길이, 빈 export text 등을 확인한다. 예외를
 * 던지지 않고 항상 결과 객체를 반환한다.
 */
export function validateManualExportPayload(
  post: SocialPost,
  exportPayload: ManualExportResult
): ManualExportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!exportPayload.ok) {
    errors.push(exportPayload.error ?? "export payload 생성에 실패했습니다.");
  }

  switch (post.platform) {
    case "wordpress_blog":
    case "naver_blog":
    case "naver_cafe": {
      if (!exportPayload.exportTitle?.trim()) errors.push("title이 비어 있습니다.");
      if (!exportPayload.exportBody?.trim()) errors.push("body가 비어 있습니다.");
      break;
    }
    case "x": {
      if (!exportPayload.exportThreadItems || exportPayload.exportThreadItems.length === 0) {
        errors.push("thread_items가 비어 있습니다.");
      } else {
        const overLength = exportPayload.exportThreadItems.filter((text) => text.length > X_MAX_ITEM_LENGTH);
        if (overLength.length > 0) {
          warnings.push(`${overLength.length}개의 thread item이 ${X_MAX_ITEM_LENGTH}자를 초과했습니다.`);
        }
      }
      break;
    }
    case "threads": {
      if (!exportPayload.exportBody?.trim()) errors.push("본문이 비어 있습니다.");
      break;
    }
    case "instagram": {
      if (!exportPayload.exportCaption?.trim()) errors.push("caption이 비어 있습니다.");
      break;
    }
    default:
      break;
  }

  const normalizedHashtags = normalizeHashtags(exportPayload.exportHashtags);
  if (exportPayload.exportHashtags && exportPayload.exportHashtags.length !== normalizedHashtags.length) {
    warnings.push("빈 해시태그 또는 형식이 올바르지 않은 해시태그가 정리되었습니다.");
  }

  const textForPatternCheck = [
    exportPayload.exportTitle,
    exportPayload.exportBody,
    exportPayload.exportCaption,
    exportPayload.exportText,
    ...(exportPayload.exportThreadItems ?? []),
    ...(exportPayload.exportCardItems ?? []).map((item) => `${item.heading} ${item.body}`),
  ]
    .filter(Boolean)
    .join(" ");

  const prohibitedFound = collectProhibitedMatches(textForPatternCheck);
  const blocked = prohibitedFound.length > 0;
  if (blocked) {
    errors.push(`금지 표현이 발견되었습니다: ${prohibitedFound.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    blocked,
    errors,
    warnings,
  };
}
