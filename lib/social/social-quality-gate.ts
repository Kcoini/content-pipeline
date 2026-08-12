// Phase 3-1/3-3: Multi-platform Writing을 위한 quality gate.
// rule-based 검사(AI 기반 정교한 평가는 이후 단계 범위)와 플랫폼별 추가
// 검사를 수행한다. 실제 게시는 어떤 경우에도 수행하지 않으며, 이 함수는
// 검증 결과(ready/needs_revision/blocked)만 반환한다. 예외를 던지지 않는다
// (호출하는 쪽에서 실행 자체 실패를 별도로 failed 처리한다).

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
import { getToneTransformerRule } from "./tone-transformer-rules";

/** 협박/공포 조장 표현. blocked 처리 대상. */
const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];

/** 광고 클릭 유도 표현. blocked 처리 대상. */
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];

/** 허위/과장 수익 보장 표현. blocked 처리 대상. */
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];

/** 개인정보 노출 의심 패턴(주민등록번호/전화번호 형식). blocked 처리 대상. */
const PII_PATTERN = /\d{6}-\d{7}|\d{3}-\d{3,4}-\d{4}/;

/** naver_cafe에서 특히 경계하는 홍보/도배성 표현. */
const CAFE_PROMOTIONAL_PATTERNS = ["홍보합니다", "판매합니다", "문의주세요", "최저가", "지금 바로 구매"];

const X_MAX_ITEM_LENGTH = 280;

/** 85 이상이면 ready, 그 미만이면(blocked가 아닌 한) needs_revision. */
const READY_SCORE_THRESHOLD = 85;

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
  mediaRequirements?: Record<string, unknown>;
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

/** naver_blog: 특정 단어(2자 이상)가 지나치게 자주 반복되는지 확인한다 (검색 품질 정책 위반 소지). */
function findOverRepeatedKeyword(text: string): { word: string; count: number } | null {
  const words = text.match(/[가-힣a-zA-Z0-9]{2,}/g) ?? [];
  if (words.length === 0) return null;

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  let worst: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (count >= 8 && (!worst || count > worst.count)) {
      worst = { word, count };
    }
  }
  return worst;
}

/**
 * social post 하나에 대해 rule-based quality gate를 실행한다.
 * platform/tone_style 유효성, 콘텐츠 존재 여부, 금지 표현(협박/광고 클릭
 * 유도/허위 수익 보장/개인정보 노출 의심), 플랫폼별 필수 필드/추가 검사를
 * 수행한다. 실행 중 예외가 발생해도 이 함수를 호출하는 쪽에서 안전하게
 * 처리할 수 있도록, 이 함수 자체는 항상 결과 객체를 반환한다(throw하지 않음).
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

  // 원문 복사 의심 (Phase 3-2 contract validator와 동일한 기준 재확인)
  const longestFieldLength = Math.max(
    input.postBody?.length ?? 0,
    input.caption?.length ?? 0,
    input.excerpt?.length ?? 0
  );
  checklist.push(
    checklistItem(
      "no_raw_content_copy_suspected",
      "원문 복사 의심 없음",
      longestFieldLength > 12_000 ? "warning" : "pass",
      longestFieldLength > 12_000
        ? "본문/캡션 길이가 비정상적으로 길어 원문이 그대로 복사됐을 가능성이 있습니다."
        : "원문 복사 의심 신호가 없습니다."
    )
  );

  if (toneStyleValid) {
    const toneRule = getToneTransformerRule(input.toneStyle as ToneStyle);
    const toneBannedFound = toneRule.bannedPhrases.filter((pattern) => text.includes(pattern));
    checklist.push(
      checklistItem(
        "tone_alignment_check",
        "문체 정합성",
        toneBannedFound.length > 0 ? "warning" : "pass",
        toneBannedFound.length > 0
          ? `선택한 tone_style(${input.toneStyle})에서 지양해야 할 표현이 포함되어 있습니다: ${toneBannedFound.join(", ")}`
          : "선택한 tone_style과 크게 어긋나지 않습니다."
      )
    );
  }

  if (platformValid) {
    const platform = input.platform as SocialPlatform;
    const config = getPlatformWritingConfig(platform);

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
      const tooShort = length < config.minLength;
      const tooLong = length > config.maxLength;
      checklist.push(
        checklistItem(
          "length_check",
          "플랫폼 권장 길이",
          tooShort || tooLong ? "warning" : "pass",
          tooShort
            ? `분량이 플랫폼 권장 최소(${config.minLength}자)보다 적습니다 (${length}자).`
            : tooLong
              ? `분량이 플랫폼 권장 최대(${config.maxLength}자)를 초과했습니다 (${length}자).`
              : `분량이 적절합니다 (${length}자).`
        )
      );
    }

    // 플랫폼별 추가 검사
    switch (platform) {
      case "wordpress_blog": {
        checklist.push(
          checklistItem(
            "wordpress_excerpt_present",
            "excerpt 존재 (가산)",
            input.excerpt?.trim() ? "pass" : "warning",
            input.excerpt?.trim() ? "excerpt가 준비되어 있습니다." : "excerpt가 없습니다 (있으면 가산 요소)."
          )
        );
        break;
      }

      case "naver_blog": {
        const overRepeated = findOverRepeatedKeyword(input.postBody ?? "");
        checklist.push(
          checklistItem(
            "naver_blog_keyword_repetition",
            "과도한 키워드 반복 여부",
            overRepeated ? "warning" : "pass",
            overRepeated
              ? `"${overRepeated.word}" 표현이 ${overRepeated.count}회 반복되어 과도한 키워드 반복으로 보일 수 있습니다.`
              : "과도한 키워드 반복이 감지되지 않았습니다."
          )
        );
        break;
      }

      case "naver_cafe": {
        const promotionalFound = CAFE_PROMOTIONAL_PATTERNS.filter((pattern) => text.includes(pattern));
        checklist.push(
          checklistItem(
            "naver_cafe_promotional_language",
            "광고성/도배성 표현 없음",
            promotionalFound.length > 0 ? "blocked" : "pass",
            promotionalFound.length > 0
              ? `광고성/도배성으로 보이는 표현이 발견되었습니다: ${promotionalFound.join(", ")}`
              : "광고성/도배성 표현이 발견되지 않았습니다."
          )
        );
        const hasDiscussionCue = /[?？]|어떻게 생각|계신가요|공유해|추천해/.test(text);
        checklist.push(
          checklistItem(
            "naver_cafe_discussion_cue",
            "질문/토론 유도 여부",
            hasDiscussionCue ? "pass" : "warning",
            hasDiscussionCue
              ? "질문 또는 토론을 유도하는 문장이 포함되어 있습니다."
              : "질문/토론을 유도하는 문장이 보이지 않습니다 (커뮤니티 글에는 권장)."
          )
        );
        break;
      }

      case "x": {
        const items = input.threadItems ?? [];
        const overLength = items.filter((item) => item.text.length > X_MAX_ITEM_LENGTH);
        checklist.push(
          checklistItem(
            "x_thread_item_length",
            "thread item 길이 제한",
            overLength.length > 0 ? "fail" : "pass",
            overLength.length > 0
              ? `${overLength.length}개의 thread item이 ${X_MAX_ITEM_LENGTH}자를 초과했습니다.`
              : "모든 thread item이 길이 제한 이내입니다."
          )
        );
        if (items.length > 0) {
          const inRange = items.length >= 3 && items.length <= 7;
          checklist.push(
            checklistItem(
              "x_thread_item_count",
              "thread item 개수 (권장 3~7개)",
              inRange ? "pass" : "warning",
              inRange
                ? `thread item ${items.length}개 (권장 범위 내).`
                : `thread item ${items.length}개 (권장 범위 3~7개를 벗어남).`
            )
          );
        }
        break;
      }

      case "instagram": {
        const requiresImageDeclared = input.mediaRequirements?.requiresImage === true;
        checklist.push(
          checklistItem(
            "instagram_media_requirements",
            "media_requirements.requiresImage 명시",
            requiresImageDeclared ? "pass" : "warning",
            requiresImageDeclared
              ? "media_requirements.requiresImage=true로 명시되어 있습니다."
              : "media_requirements.requiresImage가 true로 명시되어 있지 않습니다 (instagram은 이미지가 필요합니다)."
          )
        );
        checklist.push(
          checklistItem(
            "instagram_card_items",
            "card_items 존재 (가산)",
            (input.cardItems?.length ?? 0) > 0 ? "pass" : "warning",
            (input.cardItems?.length ?? 0) > 0
              ? `card_items ${input.cardItems?.length}개가 준비되어 있습니다.`
              : "card_items가 없습니다 (있으면 가산 요소)."
          )
        );
        break;
      }

      default:
        break;
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
  } else if (failedItems.length > 0 || score < READY_SCORE_THRESHOLD) {
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
