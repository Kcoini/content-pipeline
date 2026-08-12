// Phase 3-6: Platform-specific Approval & Publishing Guard — 규칙 정의.
// runPlatformPublishingGuard()(platform-publishing-guard-service.ts)가
// 사용하는 순수 함수만 모아둔다. 실제 게시 API 호출은 하지 않는다.

import type { CardItem, SocialPlatform, SocialPost, ThreadItem } from "./social-platform-types";

export interface PublishingRuleDescriptor {
  key: string;
  label: string;
}

/** 모든 플랫폼 공통으로 검사하는 규칙(문서/UI 표시용 설명). */
export function getCommonPublishingRules(): PublishingRuleDescriptor[] {
  return [
    { key: "quality_status_ready", label: "quality_status가 ready" },
    { key: "approval_status_approved", label: "approval_status가 approved" },
    { key: "export_status_ready_or_exported", label: "export_status가 ready 또는 exported" },
    { key: "publish_status_not_blocked_or_published", label: "publish_status가 blocked/published/failed가 아님" },
    { key: "content_present", label: "게시할 콘텐츠 존재" },
    { key: "export_payload_present", label: "export_payload 존재" },
    { key: "no_forbidden_patterns", label: "금지 표현(협박/공포조장/광고클릭유도/과장수익/개인정보/API key) 없음" },
  ];
}

/** 플랫폼별로 검사하는 규칙(문서/UI 표시용 설명). */
export function getPlatformPublishingRules(platform: SocialPlatform): PublishingRuleDescriptor[] {
  switch (platform) {
    case "wordpress_blog":
      return [
        { key: "wordpress_title_body_present", label: "post_title/post_body 존재" },
        { key: "wordpress_excerpt_present", label: "excerpt 존재 (가산)" },
        { key: "wordpress_body_length", label: "본문 길이 적정성" },
      ];
    case "naver_blog":
      return [
        { key: "naver_blog_title_body_present", label: "post_title/post_body 존재" },
        { key: "naver_blog_keyword_stuffing", label: "키워드 도배 없음" },
        { key: "naver_blog_hashtag_present", label: "해시태그 존재 (가산)" },
      ];
    case "naver_cafe":
      return [
        { key: "naver_cafe_title_body_present", label: "post_title/post_body 존재" },
        { key: "naver_cafe_discussion_cue", label: "질문형/토론 유도 문장 존재" },
        { key: "naver_cafe_link_overuse", label: "링크 남발 없음" },
      ];
    case "x":
      return [
        { key: "x_thread_items_present", label: "thread_items 존재" },
        { key: "x_thread_item_length", label: "각 item 길이 제한 이내" },
        { key: "x_hook_present", label: "첫 item에 hook 존재" },
      ];
    case "threads":
      return [
        { key: "threads_body_present", label: "post_body 존재" },
        { key: "threads_length", label: "너무 길지 않음" },
        { key: "threads_conversational", label: "대화형/질문/인사이트 포함" },
      ];
    case "instagram":
      return [
        { key: "instagram_caption_present", label: "caption 존재" },
        { key: "instagram_hashtags_present", label: "해시태그 존재" },
        { key: "instagram_media_declared", label: "card_items 또는 media_requirements.requiresImage=true" },
      ];
    default: {
      const exhaustiveCheck: never = platform;
      return exhaustiveCheck;
    }
  }
}

const THREAT_PATTERNS = ["협박", "가만두지 않겠다", "당장 하지 않으면", "큰일 납니다", "후회하게 될"];
const FEARMONGERING_PATTERNS = ["지금 안 하면 큰일", "모르면 손해", "위험에 처할 수 있습니다"];
const FALSE_CERTAINTY_PATTERNS = ["100% 확실", "무조건 사실", "확실히 보장합니다"];
const AD_CLICK_BAIT_PATTERNS = ["광고 클릭", "지금 클릭", "클릭하면 돈"];
const INCOME_GUARANTEE_PATTERNS = ["수익 보장", "원금 보장", "확정 수익", "무조건 돈 버는"];
const PII_PATTERN = /\d{6}-\d{7}|\d{3}-\d{3,4}-\d{4}/;
const SECRET_PATTERN = /sk-ant-[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9._-]+|Basic\s+[a-zA-Z0-9+/=]+/i;

export interface ForbiddenPatternCheckResult {
  blocked: boolean;
  found: string[];
}

/**
 * 협박/공포조장/허위단정/광고클릭유도/과장수익/개인정보/API key·token 노출
 * 의심 패턴을 검사한다. 하나라도 발견되면 blocked=true를 반환한다.
 */
export function checkForbiddenPatterns(text: string): ForbiddenPatternCheckResult {
  const found: string[] = [];
  for (const pattern of [
    ...THREAT_PATTERNS,
    ...FEARMONGERING_PATTERNS,
    ...FALSE_CERTAINTY_PATTERNS,
    ...AD_CLICK_BAIT_PATTERNS,
    ...INCOME_GUARANTEE_PATTERNS,
  ]) {
    if (text.includes(pattern)) found.push(pattern);
  }
  if (PII_PATTERN.test(text)) found.push("개인정보(주민등록번호/전화번호 형식) 의심");
  if (SECRET_PATTERN.test(text)) found.push("API key/token 노출 의심");

  return { blocked: found.length > 0, found };
}

function collectPostText(post: SocialPost): string {
  const threadText = post.threadItems.map((item: ThreadItem) => item.text).join(" ");
  const cardText = post.cardItems.map((item: CardItem) => `${item.heading} ${item.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

const CAFE_PROMOTIONAL_PATTERNS = ["홍보합니다", "판매합니다", "문의주세요", "최저가", "지금 바로 구매", "재구매", "매일 게시"];
const NAVER_BLOG_IMAGE_MISUSE_PATTERNS = ["뉴스 이미지를 가져와", "타 블로그에서 가져온 이미지", "출처 없이 캡처"];
const X_AGGRESSIVE_PATTERNS = ["당장 팔로우 안 하면", "무조건 리트윗", "낚시 아님 진짜"];

/** naver_blog: 특정 단어(2자 이상)가 지나치게 자주 반복되는지 확인한다. */
function findOverRepeatedKeyword(text: string): { word: string; count: number } | null {
  const words = text.match(/[가-힣a-zA-Z0-9]{2,}/g) ?? [];
  if (words.length === 0) return null;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  let worst: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (count >= 8 && (!worst || count > worst.count)) worst = { word, count };
  }
  return worst;
}

/**
 * 플랫폼별 추가 위험 신호(공통 금지 표현 검사와 별개)를 검사한다. 발견된
 * 위험 사유 메시지 목록을 반환한다(비어 있으면 위험 없음).
 */
export function checkPlatformSpecificRisks(post: SocialPost): string[] {
  const text = collectPostText(post);
  const risks: string[] = [];

  switch (post.platform) {
    case "naver_blog": {
      const overRepeated = findOverRepeatedKeyword(post.postBody ?? "");
      if (overRepeated) {
        risks.push(`"${overRepeated.word}" 표현이 ${overRepeated.count}회 반복되어 키워드 도배로 보일 수 있습니다.`);
      }
      const imageMisuse = NAVER_BLOG_IMAGE_MISUSE_PATTERNS.filter((pattern) => text.includes(pattern));
      if (imageMisuse.length > 0) {
        risks.push(`타 매체 이미지 무단 사용을 암시하는 표현이 발견되었습니다: ${imageMisuse.join(", ")}`);
      }
      break;
    }
    case "naver_cafe": {
      const promotional = CAFE_PROMOTIONAL_PATTERNS.filter((pattern) => text.includes(pattern));
      if (promotional.length > 0) {
        risks.push(`홍보성/도배성 표현이 발견되었습니다: ${promotional.join(", ")}`);
      }
      break;
    }
    case "x": {
      const aggressive = X_AGGRESSIVE_PATTERNS.filter((pattern) => text.includes(pattern));
      if (aggressive.length > 0) {
        risks.push(`공격적/낚시성 표현이 발견되었습니다: ${aggressive.join(", ")}`);
      }
      break;
    }
    default:
      break;
  }

  return risks;
}

export type PublishingChecklistStatus = "pass" | "warning" | "fail" | "blocked";

export interface PublishingChecklistItemLike {
  status: PublishingChecklistStatus;
}

/** pass=1, warning=0.5, fail/blocked=0 평균 점수를 0~100 스케일로 계산한다. */
export function calculatePublishingGuardScore(checklist: PublishingChecklistItemLike[]): number {
  if (checklist.length === 0) return 0;
  const points: Record<PublishingChecklistStatus, number> = { pass: 1, warning: 0.5, fail: 0, blocked: 0 };
  const total = checklist.reduce((sum, item) => sum + points[item.status], 0);
  return Math.round((total / checklist.length) * 100);
}
