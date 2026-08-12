// Phase 3-1: Multi-platform Writing을 위한 quality gate skeleton.
// 이 단계에서는 간단한 rule-based 검사만 구현한다 (AI 기반 정교한 평가는
// 이후 단계 범위). 실제 게시는 어떤 경우에도 수행하지 않으며, 이 함수는
// 검증 결과(ready/needs_revision/blocked/failed)만 반환한다.

import { isSocialPlatform, isToneStyle } from "./social-platform-types";
import type {
  SocialPlatform,
  ToneStyle,
  ThreadItem,
  CardItem,
  SocialPostQualityChecklistItem,
  SocialPostQualityResult,
} from "./social-platform-types";
import { getPlatformWritingConfig } from "./platform-writing-config";

/** 협박/공포 조장 표현. blocked 처리 대상. */
const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];

/** 광고 클릭 유도 표현. blocked 처리 대상. */
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];

/** 허위/과장 수익 보장 표현. blocked 처리 대상. */
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];

/** 개인정보 노출 의심 패턴(주민등록번호/전화번호 형식). blocked 처리 대상. */
const PII_PATTERN = /\d{6}-\d{7}|\d{3}-\d{3,4}-\d{4}/;

export interface SocialPostQualityGateInput {
  platform: SocialPlatform | string;
  toneStyle: ToneStyle | string;
  postTitle?: string | null;
  postBody?: string | null;
  caption?: string | null;
  excerpt?: string | null;
  hashtags?: string[];
  threadItems?: ThreadItem[];
  cardItems?: CardItem[];
}

function checklistItem(
  key: string,
  label: string,
  status: SocialPostQualityChecklistItem["status"],
  message: string
): SocialPostQualityChecklistItem {
  return { key, label, status, message };
}

function collectTextForPatternCheck(input: SocialPostQualityGateInput): string {
  const threadText = (input.threadItems ?? []).map((item) => item.text).join(" ");
  const cardText = (input.cardItems ?? []).map((item) => `${item.heading} ${item.body}`).join(" ");
  return [input.postTitle, input.postBody, input.caption, input.excerpt, threadText, cardText]
    .filter(Boolean)
    .join(" ");
}

function hasAnyContent(input: SocialPostQualityGateInput): boolean {
  return Boolean(
    (input.postBody && input.postBody.trim().length > 0) ||
      (input.caption && input.caption.trim().length > 0) ||
      (input.threadItems && input.threadItems.length > 0 && input.threadItems.some((item) => item.text.trim().length > 0))
  );
}

function getContentLength(input: SocialPostQualityGateInput): number {
  const threadLength = (input.threadItems ?? []).reduce((sum, item) => sum + item.text.length, 0);
  return (input.postBody?.length ?? 0) + (input.caption?.length ?? 0) + threadLength;
}

/**
 * social post 하나에 대해 rule-based quality gate를 실행한다.
 * platform/tone_style 유효성, 콘텐츠 존재 여부, 금지 표현(협박/광고 클릭
 * 유도/허위 수익 보장/개인정보 노출 의심), 플랫폼별 필수 필드를 검사한다.
 * 실행 중 예외가 발생해도 이 함수를 호출하는 쪽에서 안전하게 처리할 수
 * 있도록, 이 함수 자체는 항상 결과 객체를 반환한다(throw하지 않음).
 */
export function runSocialPostQualityGate(input: SocialPostQualityGateInput): SocialPostQualityResult {
  const checklist: SocialPostQualityChecklistItem[] = [];

  const platformValid = isSocialPlatform(input.platform);
  checklist.push(
    checklistItem(
      "platform_valid",
      "Platform 유효성",
      platformValid ? "pass" : "blocked",
      platformValid ? "지원하는 platform입니다." : `지원하지 않는 platform입니다: ${input.platform}`
    )
  );

  const toneStyleValid = isToneStyle(input.toneStyle);
  checklist.push(
    checklistItem(
      "tone_style_valid",
      "Tone style 유효성",
      toneStyleValid ? "pass" : "blocked",
      toneStyleValid ? "지원하는 tone_style입니다." : `지원하지 않는 tone_style입니다: ${input.toneStyle}`
    )
  );

  const contentPresent = hasAnyContent(input);
  checklist.push(
    checklistItem(
      "content_present",
      "콘텐츠 존재",
      contentPresent ? "pass" : "blocked",
      contentPresent ? "본문/캡션/스레드 중 하나 이상 존재합니다." : "본문/캡션/스레드가 모두 비어 있습니다."
    )
  );

  const text = collectTextForPatternCheck(input);

  const threatFound = THREAT_PATTERNS.filter((pattern) => text.includes(pattern));
  checklist.push(
    checklistItem(
      "no_threat_language",
      "협박/공포 조장 표현 없음",
      threatFound.length > 0 ? "blocked" : "pass",
      threatFound.length > 0 ? `협박성 표현이 발견되었습니다: ${threatFound.join(", ")}` : "협박성 표현이 없습니다."
    )
  );

  const adClickFound = AD_CLICK_BAIT_PATTERNS.filter((pattern) => text.includes(pattern));
  checklist.push(
    checklistItem(
      "no_ad_click_bait",
      "광고 클릭 유도 표현 없음",
      adClickFound.length > 0 ? "blocked" : "pass",
      adClickFound.length > 0
        ? `광고 클릭 유도 표현이 발견되었습니다: ${adClickFound.join(", ")}`
        : "광고 클릭 유도 표현이 없습니다."
    )
  );

  const incomeGuaranteeFound = INCOME_GUARANTEE_PATTERNS.filter((pattern) => text.includes(pattern));
  checklist.push(
    checklistItem(
      "no_income_guarantee",
      "허위 수익 보장 표현 없음",
      incomeGuaranteeFound.length > 0 ? "blocked" : "pass",
      incomeGuaranteeFound.length > 0
        ? `허위/과장 수익 보장 표현이 발견되었습니다: ${incomeGuaranteeFound.join(", ")}`
        : "허위 수익 보장 표현이 없습니다."
    )
  );

  const piiSuspected = PII_PATTERN.test(text);
  checklist.push(
    checklistItem(
      "no_pii_exposure",
      "개인정보 노출 의심 없음",
      piiSuspected ? "blocked" : "pass",
      piiSuspected ? "주민등록번호/전화번호 형식의 문자열이 발견되었습니다." : "개인정보 노출 패턴이 발견되지 않았습니다."
    )
  );

  if (platformValid) {
    const config = getPlatformWritingConfig(input.platform as SocialPlatform);

    const requiredFieldsOk =
      (!config.supportsTitle || Boolean(input.postTitle?.trim())) &&
      (!config.supportsCaption || Boolean(input.caption?.trim())) &&
      (!config.supportsThreads || (input.threadItems && input.threadItems.length > 0));
    checklist.push(
      checklistItem(
        "required_fields_present",
        "플랫폼 필수 필드 존재",
        requiredFieldsOk ? "pass" : "warning",
        requiredFieldsOk
          ? "플랫폼이 요구하는 필드가 채워져 있습니다."
          : "플랫폼이 지원하는 필드(title/caption/thread) 중 일부가 비어 있습니다."
      )
    );

    if (config.supportsHashtags) {
      const hashtagOk = (input.hashtags?.length ?? 0) > 0;
      checklist.push(
        checklistItem(
          "hashtag_check",
          "해시태그 존재",
          hashtagOk ? "pass" : "warning",
          hashtagOk ? "해시태그가 포함되어 있습니다." : "해시태그가 없습니다 (권장하지만 필수는 아닙니다)."
        )
      );
    }

    if (contentPresent) {
      const length = getContentLength(input);
      const lengthOk = length >= config.minLength;
      checklist.push(
        checklistItem(
          "length_check",
          "플랫폼 권장 길이",
          lengthOk ? "pass" : "warning",
          lengthOk
            ? `분량이 충분합니다 (${length}자, 최소 권장 ${config.minLength}자).`
            : `분량이 플랫폼 권장 최소(${config.minLength}자)보다 적습니다 (${length}자).`
        )
      );
    }
  }

  const blockedItems = checklist.filter((item) => item.status === "blocked");
  const failedItems = checklist.filter((item) => item.status === "fail");
  const warningItems = checklist.filter((item) => item.status === "warning");

  const points: Record<SocialPostQualityChecklistItem["status"], number> = {
    pass: 1,
    warning: 0.5,
    fail: 0,
    blocked: 0,
  };
  const score = Math.round(
    (checklist.reduce((sum, item) => sum + points[item.status], 0) / checklist.length) * 100
  );

  let status: SocialPostQualityResult["status"];
  if (blockedItems.length > 0) {
    status = "blocked";
  } else if (failedItems.length > 0 || warningItems.length > 0) {
    status = "needs_revision";
  } else {
    status = "ready";
  }

  return {
    status,
    score,
    checklist,
    warnings: warningItems.map((item) => item.message),
    failures: failedItems.map((item) => item.message),
    blockedReasons: blockedItems.map((item) => item.message),
  };
}
