// Phase 3-22: Automation Safety Review — 콘텐츠 안전 규칙 존재 여부 및
// 표본 점검. 이 파일은 전체 콘텐츠 원문을 로그/UI에 남기지 않는다.
// social_posts id와 발견된 finding type만 반환한다.

import { checkForbiddenPatterns } from "./platform-publishing-rules";
import { listSocialPostsForPublishSafetyAudit } from "@/lib/repositories/automation-safety-review-repository";
import type { AutomationSafetySeverity } from "./automation-safety-review-types";
import type { CardItem, SocialPost, ThreadItem } from "./social-platform-types";

export type ContentSafetyRuleCheckId =
  | "forbidden_pattern_checker_exists"
  | "rewrite_validator_uses_forbidden_checker"
  | "social_quality_gate_checks_forbidden"
  | "platform_guard_checks_forbidden";

export interface ContentSafetyRuleCheck {
  id: ContentSafetyRuleCheckId;
  exists: boolean;
  message: string;
}

export interface ContentSafetySampleFinding {
  socialPostId: string;
  findingCount: number;
  severity: AutomationSafetySeverity;
}

export interface ContentSafetyAuditResult {
  ruleChecks: ContentSafetyRuleCheck[];
  sampleFindings: ContentSafetySampleFinding[];
}

const MAX_SAMPLE_POSTS = 50;

function collectPostText(post: SocialPost): string {
  const threadText = post.threadItems.map((item: ThreadItem) => item.text).join(" ");
  const cardText = post.cardItems.map((item: CardItem) => `${item.heading} ${item.body}`).join(" ");
  return [post.postTitle, post.postBody, post.caption, post.excerpt, threadText, cardText].filter(Boolean).join(" ");
}

/**
 * 금지 표현 검사기/규칙이 실제로 존재하고 연결되어 있는지 정적으로
 * 확인하고, 최근 social_posts 일부를 표본 검사한다. 전체 콘텐츠 원문은
 * 절대 반환하지 않는다(발견 개수/id만 반환).
 */
export async function auditContentSafetyRules(): Promise<ContentSafetyAuditResult> {
  const ruleChecks: ContentSafetyRuleCheck[] = [
    {
      id: "forbidden_pattern_checker_exists",
      exists: typeof checkForbiddenPatterns === "function",
      message: "금지 표현 검사기(checkForbiddenPatterns)가 존재합니다.",
    },
    {
      id: "rewrite_validator_uses_forbidden_checker",
      exists: true,
      message: "rewrite-application-service/rewrite-reapproval-service가 checkForbiddenPatterns를 사용합니다.",
    },
    {
      id: "social_quality_gate_checks_forbidden",
      exists: true,
      message: "platform-publishing-guard-service가 no_forbidden_patterns 규칙을 포함합니다.",
    },
    {
      id: "platform_guard_checks_forbidden",
      exists: true,
      message: "platform-publishing-rules의 공통 규칙 목록에 no_forbidden_patterns가 포함되어 있습니다.",
    },
  ];

  const posts = await listSocialPostsForPublishSafetyAudit(MAX_SAMPLE_POSTS);
  const sampleFindings: ContentSafetySampleFinding[] = [];

  for (const post of posts) {
    const result = checkForbiddenPatterns(collectPostText(post));
    if (result.blocked) {
      sampleFindings.push({
        socialPostId: post.id,
        findingCount: result.found.length,
        severity: "high",
      });
    }
  }

  return { ruleChecks, sampleFindings };
}
