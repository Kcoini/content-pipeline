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
import { classifyWordPressBlogSourceMode } from "./wordpress-blog-source-mode";

/** 협박/공포 조장 표현. blocked 처리 대상. */
const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];

/** 광고 클릭 유도 표현. blocked 처리 대상. */
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];

/** 허위/과장 수익 보장 표현. blocked 처리 대상. */
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];

/**
 * 개인정보 노출 의심 패턴(주민등록번호/휴대전화 형식). blocked 처리 대상.
 * `lib/social/social-output-contract-validator.ts`의 PII_PATTERN과 동일한
 * 이유로, 휴대전화는 "010-"로 시작하는 번호만 의심한다 — 정책/지원사업
 * 안내 글에 흔한 기관 대표번호(지역번호/1588 등)를 오탐하지 않기 위해서다.
 */
const PII_PATTERN = /\d{6}-\d{7}|\b010-\d{3,4}-\d{4}\b/;

/** naver_cafe에서 특히 경계하는 홍보/도배성 표현. */
const CAFE_PROMOTIONAL_PATTERNS = ["홍보합니다", "판매합니다", "문의주세요", "최저가", "지금 바로 구매"];

/**
 * wordpress_blog: SEO/AEO/GEO/E-E-A-T 문제 해결형 글 기준에서 상투적인
 * 도입부로 간주하는 표현(prompts/social/wordpress-blog.md "도입부 규칙"
 * 금지 목록과 동일). 도입부(본문 앞부분)에 이 표현이 있으면 needs_revision
 * 처리한다 — 검색자가 원하는 초반 결론 대신 형식적인 시작으로 보이기
 * 때문이다.
 */
const WORDPRESS_BLOG_CLICHE_OPENING_PATTERNS = [
  "많은 관심을 받고 있습니다",
  "알아보겠습니다",
  "알아보도록 하겠습니다",
  "자세히 살펴보겠습니다",
  "이번 글에서는",
];

/** wordpress_blog: 초반 결론(AEO 직접 답변) 섹션이 있는지 확인하는 heading 패턴. */
const WORDPRESS_BLOG_EARLY_ANSWER_HEADING_PATTERNS = ["먼저 결론", "핵심만 정리"];

/** wordpress_blog: 근거 없는 권위 표현(E-E-A-T authoritativeness 위반 소지). */
const WORDPRESS_BLOG_UNSUPPORTED_AUTHORITY_PATTERNS = ["전문가가 추천합니다", "전문가들이 인정하는", "전문가가 보장하는"];

/** wordpress_blog: AI 검색 노출을 보장하는 표현(GEO 원칙 위반 — 절대 사용 금지). */
const WORDPRESS_BLOG_AI_EXPOSURE_GUARANTEE_PATTERNS = ["AI 검색에 노출됩니다", "AI가 이 글을 인용", "검색 상위 노출 보장"];

/** wordpress_blog: 공포 조장 표현(no-fearmongering.md 금지 표현 예시와 동일). */
const WORDPRESS_BLOG_FEARMONGERING_PATTERNS = ["모르면 큰일 납니다", "놓치면 손해입니다", "지금 이 순간에도 위험합니다"];

/**
 * wordpress_blog: post_body 길이 기준. 목표는 2,500~4,000자(metadata 제외,
 * 순수 본문 기준)이며, 1,800자는 시스템이 허용하는 절대 최소 안전선일
 * 뿐이다. **1,800자 미만이면 이 항목을 fail로 처리해 quality gate가
 * "ready"를 절대 반환하지 않게 한다**(failedItems.length > 0이면 무조건
 * needs_revision) — 일반 length_check(경고)만으로는 score가 우연히 85
 * 이상이 되어 짧고 얕은 글도 "ready"로 통과할 수 있었기 때문에, 이 항목을
 * 별도로 강제한다. 1,200자 미만은 "article 개요만 우려낸 얕은 글"로 보고
 * 더 강한 경고 문구를 남긴다(둘 다 fail이지만 메시지로 구분).
 */
const WORDPRESS_BLOG_VERY_SHALLOW_BODY_LENGTH = 1200;
/** wordpress_blog: 시스템이 허용하는 절대 최소 안전선. 이 미만이면 무조건 fail. */
const WORDPRESS_BLOG_MIN_ACCEPTABLE_BODY_LENGTH = 1800;
/** wordpress_blog: 이 길이 이상이면 목표(2,500~4,000자)에 근접한 것으로 본다. */
const WORDPRESS_BLOG_TARGET_BODY_LENGTH = 2500;

/**
 * wordpress_blog: single_source_mode(usable source 1건) 전용 완화 기준.
 * 출처가 하나뿐이라는 한계를 인정하고 정보를 부풀리지 않는 것이 목적이므로,
 * 일반 기준(목표 2,500~4,000자/최소 1,800자)을 그대로 요구하지 않는다.
 * 대신 목표 1,800~3,000자/최소 1,500자로 완화한다 — 그래도 출처 없는 내용을
 * 채워 넣지 않는 것이 우선이다.
 */
const WORDPRESS_BLOG_SINGLE_SOURCE_MIN_ACCEPTABLE_BODY_LENGTH = 1500;
const WORDPRESS_BLOG_SINGLE_SOURCE_TARGET_BODY_LENGTH = 1800;

/** wordpress_blog: single_source_mode 글에 반드시 있어야 하는 "확인 필요 사항" 섹션 확인 패턴. */
const WORDPRESS_BLOG_VERIFICATION_NEEDED_HEADING_PATTERN = /확인\s*필요\s*사항/;

/** wordpress_blog: 본문에 markdown h2/h3 구조(##, ###)가 있는지 확인하는 패턴. */
const MARKDOWN_HEADING_PATTERN = /^#{2,3}\s+\S/m;

/**
 * wordpress_blog: source key points를 한 문단에 "/"로 이어 붙인 것으로
 * 보이는 패턴(article summary/excerpt를 그대로 재활용한 얕은 글의 전형적
 * 신호). "A / B / C"처럼 공백으로 감싼 "/" 구분자가 한 본문에 2회 이상
 * 나오면 의심한다 — 각 항목이 여러 단어(구/절)여도 잡아낼 수 있도록,
 * 항목 자체의 내용은 검사하지 않고 구분자 개수만 센다.
 */
const SLASH_SEPARATOR_PATTERN = /\s\/\s/g;
const SLASH_JOINED_POINTS_MIN_COUNT = 2;

// Phase 2-24: wordpress_blog 구조 강화(요약 박스/표/체크리스트/FAQ 4개
// 이상/기준일 안내) 확인용 기준값·패턴.
const WORDPRESS_BLOG_MIN_FAQ_COUNT = 4;
/** markdown table: 헤더 행 다음에 |---|---| 형태의 구분 행이 오는지 확인한다. */
const WORDPRESS_BLOG_TABLE_PATTERN = /\|[^\n]*\|[ \t]*\r?\n[ \t]*\|[\s:-]+\|/;

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
  /**
   * wordpress_blog 전용: 이 글을 만들 때 사용된 usable source 개수
   * (lib/social/wordpress-blog-source-mode.ts 참고). 전달되면 본문 길이
   * 기준/확인 필요 사항 섹션 검사에 single_source_mode 완화 기준을
   * 적용한다. 다른 플랫폼에는 영향이 없다.
   */
  usableSourceCount?: number;
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

        // SEO/AEO/GEO/E-E-A-T 문제 해결형 블로그 기준(prompts/social/wordpress-blog.md)에
        // 맞는지 확인하는 rule-based 검사. AI 평가가 아니라 문자열 패턴
        // 기반이라 완벽하지 않지만, 가장 흔한 형식적 문제를 걸러낸다.
        const bodyText = input.postBody ?? "";
        const bodyLength = bodyText.trim().length;

        // usable source 개수에 따른 작성 모드 — single_source_mode는 본문
        // 길이 기준이 완화된다(목표 1,800~3,000자/최소 1,500자).
        const sourceMode =
          typeof input.usableSourceCount === "number"
            ? classifyWordPressBlogSourceMode(input.usableSourceCount)
            : null;
        const isSingleSourceMode = sourceMode === "single_source";

        const minAcceptableBodyLength = isSingleSourceMode
          ? WORDPRESS_BLOG_SINGLE_SOURCE_MIN_ACCEPTABLE_BODY_LENGTH
          : WORDPRESS_BLOG_MIN_ACCEPTABLE_BODY_LENGTH;
        const targetBodyLength = isSingleSourceMode
          ? WORDPRESS_BLOG_SINGLE_SOURCE_TARGET_BODY_LENGTH
          : WORDPRESS_BLOG_TARGET_BODY_LENGTH;

        // article 개요만 우려낸 얕은 글(source-grounded reconstruction이
        // 아니라 article rewrite/excerpt)일 가능성이 큰 짧은 본문을 잡아낸다.
        // **최소 허용 기준 미만은 무조건 fail** — length_check(경고)만으로는
        // 점수가 우연히 85 이상이 되어 "ready"로 통과할 수 있었기 때문에,
        // 이 항목을 fail로 만들어 failedItems.length > 0 → needs_revision을
        // 강제한다. 1,200자 미만은 더 강한 경고 문구로 구분한다(단,
        // single_source_mode에서는 최소 허용 기준 자체가 낮아진다).
        checklist.push(
          checklistItem(
            "wordpress_blog_body_depth",
            "본문 길이(깊이) 충분함",
            bodyLength < minAcceptableBodyLength ? "fail" : "pass",
            bodyLength === 0
              ? "본문이 비어 있습니다."
              : !isSingleSourceMode && bodyLength < WORDPRESS_BLOG_VERY_SHALLOW_BODY_LENGTH
                ? `본문이 ${bodyLength}자로 너무 짧습니다 — article summary/excerpt를 그대로 옮긴 얕은 글일 수 있습니다(목표: ${targetBodyLength}~4000자, 최소 허용: ${minAcceptableBodyLength}자).`
                : bodyLength < minAcceptableBodyLength
                  ? `본문이 ${bodyLength}자로 최소 허용 기준(${minAcceptableBodyLength}자) 미만입니다 — 재작성이 필요합니다.${isSingleSourceMode ? " (single_source_mode 완화 기준 적용됨)" : ""}`
                  : bodyLength < targetBodyLength
                    ? `본문이 ${bodyLength}자로 목표(${targetBodyLength}~${isSingleSourceMode ? "3000" : "4000"}자)보다 짧습니다.`
                    : `본문 길이가 적절합니다 (${bodyLength}자).`
          )
        );

        if (isSingleSourceMode) {
          const hasVerificationNeededSection = WORDPRESS_BLOG_VERIFICATION_NEEDED_HEADING_PATTERN.test(bodyText);
          checklist.push(
            checklistItem(
              "wordpress_blog_single_source_verification_needed_section",
              "single_source_mode: 확인 필요 사항 섹션 존재",
              hasVerificationNeededSection ? "pass" : "fail",
              hasVerificationNeededSection
                ? "'확인 필요 사항' 섹션이 있습니다."
                : "single_source_mode 글에는 '확인 필요 사항' 섹션이 반드시 있어야 하는데 보이지 않습니다."
            )
          );

          // single source라는 사실 자체는 blocked/needs_revision을 강제하는
          // 사유가 아니다 — 항상 warning으로만 남겨 사람이 인지하게 한다.
          checklist.push(
            checklistItem(
              "wordpress_blog_single_source_notice",
              "single_source_mode 안내",
              "warning",
              "이 글은 usable source 1건을 기반으로 작성되었습니다 — 조건/금액/신청 기간 등은 공식 안내에서 재확인이 필요합니다."
            )
          );
        }

        // wordpress_blog는 markdown h2/h3 구조를 반드시 가져야 한다 —
        // 구조 없이 이어 쓴 글은 article summary/excerpt처럼 보인다.
        const hasHeadingStructure = MARKDOWN_HEADING_PATTERN.test(bodyText);
        checklist.push(
          checklistItem(
            "wordpress_blog_heading_structure",
            "markdown h2/h3 구조 존재",
            hasHeadingStructure ? "pass" : "fail",
            hasHeadingStructure
              ? "본문에 markdown h2/h3(##, ###) 구조가 있습니다."
              : "본문에 markdown h2/h3(##, ###) 구조가 없습니다 — 소제목 없이 이어 쓴 글로 보입니다."
          )
        );

        // key points를 "A / B / C"처럼 한 문단에 이어 붙인 형태(목록/표/FAQ로
        // 재구성하지 않은 것)를 잡아낸다.
        const slashJoinedPointsFound = (bodyText.match(SLASH_SEPARATOR_PATTERN) ?? []).length >= SLASH_JOINED_POINTS_MIN_COUNT;
        checklist.push(
          checklistItem(
            "wordpress_blog_no_slash_joined_points",
            "핵심 포인트가 목록/표/FAQ로 재구성됨",
            slashJoinedPointsFound ? "fail" : "pass",
            slashJoinedPointsFound
              ? "핵심 포인트가 한 문단에 '/'로 이어 붙어 있습니다 — 목록/표/조건 정리/FAQ 섹션으로 재구성해야 합니다."
              : "핵심 포인트를 '/'로 나열한 흔적이 없습니다."
          )
        );

        const openingText = bodyText.trim().slice(0, 200);

        const clicheOpeningFound = WORDPRESS_BLOG_CLICHE_OPENING_PATTERNS.filter((pattern) => openingText.includes(pattern));
        checklist.push(
          checklistItem(
            "wordpress_blog_non_generic_opening",
            "상투적 도입부 없음",
            clicheOpeningFound.length > 0 ? "fail" : "pass",
            clicheOpeningFound.length > 0
              ? `도입부에 상투적인 표현이 있습니다: ${clicheOpeningFound.join(", ")}`
              : "도입부가 상투적인 표현으로 시작하지 않습니다."
          )
        );

        const hasEarlyAnswer = WORDPRESS_BLOG_EARLY_ANSWER_HEADING_PATTERNS.some((pattern) => bodyText.includes(pattern));
        checklist.push(
          checklistItem(
            "wordpress_blog_early_direct_answer",
            "초반 직접 답변(AEO) 존재",
            hasEarlyAnswer ? "pass" : "warning",
            hasEarlyAnswer
              ? "'먼저 결론'/'핵심만 정리' 같은 초반 직접 답변 섹션이 있습니다."
              : "초반에 결론을 바로 보여주는 섹션('먼저 결론' 등)이 보이지 않습니다."
          )
        );

        const unsupportedAuthorityFound = WORDPRESS_BLOG_UNSUPPORTED_AUTHORITY_PATTERNS.filter((pattern) => text.includes(pattern));
        checklist.push(
          checklistItem(
            "wordpress_blog_no_unsupported_authority",
            "근거 없는 권위 표현 없음",
            unsupportedAuthorityFound.length > 0 ? "fail" : "pass",
            unsupportedAuthorityFound.length > 0
              ? `근거 없는 권위 표현이 있습니다: ${unsupportedAuthorityFound.join(", ")}`
              : "근거 없는 권위 표현이 없습니다."
          )
        );

        const aiExposureGuaranteeFound = WORDPRESS_BLOG_AI_EXPOSURE_GUARANTEE_PATTERNS.filter((pattern) => text.includes(pattern));
        checklist.push(
          checklistItem(
            "wordpress_blog_no_ai_exposure_guarantee",
            "AI 검색 노출 보장 표현 없음",
            aiExposureGuaranteeFound.length > 0 ? "fail" : "pass",
            aiExposureGuaranteeFound.length > 0
              ? `AI 검색 노출을 보장하는 표현이 있습니다: ${aiExposureGuaranteeFound.join(", ")}`
              : "AI 검색 노출 보장 표현이 없습니다."
          )
        );

        const fearmongeringFound = WORDPRESS_BLOG_FEARMONGERING_PATTERNS.filter((pattern) => text.includes(pattern));
        checklist.push(
          checklistItem(
            "wordpress_blog_no_fearmongering",
            "공포 조장 표현 없음",
            fearmongeringFound.length > 0 ? "fail" : "pass",
            fearmongeringFound.length > 0
              ? `공포 조장 표현이 있습니다: ${fearmongeringFound.join(", ")}`
              : "공포 조장 표현이 없습니다."
          )
        );

        // Phase 2-24: FAQ는 "섹션이 있는가"가 아니라 "몇 개인가"로 확인한다 —
        // 뉴스 요약형 글도 FAQ 1개 정도는 흉내 낼 수 있지만, 수익형 블로그
        // 구조는 최소 4개 이상을 요구한다("**Q." 형태 질문 기준).
        const faqQuestionCount = (bodyText.match(/\*\*Q[.:：]/g) ?? []).length;
        const hasFaqSection = faqQuestionCount > 0 || /faq|자주\s*묻는\s*질문/i.test(bodyText);
        checklist.push(
          checklistItem(
            "wordpress_blog_faq_present",
            "FAQ 최소 4개 (가산)",
            faqQuestionCount >= WORDPRESS_BLOG_MIN_FAQ_COUNT
              ? "pass"
              : hasFaqSection
                ? "warning"
                : "warning",
            faqQuestionCount >= WORDPRESS_BLOG_MIN_FAQ_COUNT
              ? `FAQ가 ${faqQuestionCount}개 있습니다.`
              : hasFaqSection
                ? `FAQ 섹션은 있지만 ${faqQuestionCount}개로 최소 기준(${WORDPRESS_BLOG_MIN_FAQ_COUNT}개)에 못 미칩니다.`
                : "FAQ 섹션이 보이지 않습니다 (있으면 AEO에 도움)."
          )
        );

        const hasSummaryBox = /<div class="summary-box">/.test(bodyText);
        checklist.push(
          checklistItem(
            "wordpress_blog_summary_box_present",
            '핵심 요약 박스(<div class="summary-box">) 존재 (가산)',
            hasSummaryBox ? "pass" : "warning",
            hasSummaryBox
              ? "핵심 요약 박스가 있습니다."
              : "핵심 요약 박스가 보이지 않습니다 (있으면 가독성/체류시간에 도움)."
          )
        );

        const hasTable = WORDPRESS_BLOG_TABLE_PATTERN.test(bodyText);
        checklist.push(
          checklistItem(
            "wordpress_blog_table_present",
            "표(markdown table) 존재 (가산)",
            hasTable ? "pass" : "warning",
            hasTable ? "표가 있습니다." : "표가 보이지 않습니다 (비교/정리에 도움이 되면 추가를 권장)."
          )
        );

        const hasChecklistSection = /체크리스트|checklist-box/i.test(bodyText);
        checklist.push(
          checklistItem(
            "wordpress_blog_checklist_present",
            "확인 체크리스트 존재 (가산)",
            hasChecklistSection ? "pass" : "warning",
            hasChecklistSection
              ? "확인 체크리스트가 있습니다."
              : "확인 체크리스트가 보이지 않습니다 (독자 행동 유도에 도움이 되면 추가를 권장)."
          )
        );

        const hasSourceDateNotice = bodyText.includes("기준일");
        checklist.push(
          checklistItem(
            "wordpress_blog_source_date_notice_present",
            "자료 기준일 안내 존재 (가산)",
            hasSourceDateNotice ? "pass" : "warning",
            hasSourceDateNotice
              ? "자료 기준일 안내가 있습니다."
              : "자료 기준일 안내가 보이지 않습니다 (경제/금융/정책/제도 주제라면 추가를 권장)."
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
