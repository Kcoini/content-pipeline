// Phase 3-8: Platform Manual Posting Checklist & Result Recording.
// 사람이 실제 플랫폼에 게시하기 직전 마지막으로 확인해야 할 체크리스트를
// 만든다. 실제 게시 API는 호출하지 않는다.

import type { SocialPost } from "./social-platform-types";

export interface ManualPostingChecklistBuildResult {
  platform: string;
  checklist: { key: string; label: string }[];
  warnings: string[];
  instructions: string[];
}

function checklistItem(key: string, label: string): { key: string; label: string } {
  return { key, label };
}

function commonChecklist(): { key: string; label: string }[] {
  return [
    checklistItem("quality_gate_ready", "Quality Gate ready 확인"),
    checklistItem("approval_approved", "Approval approved 확인"),
    checklistItem("manual_export_ready", "Manual Export ready/exported 확인"),
    checklistItem("platform_publishing_guard_ready", "Platform Publishing Guard ready 확인"),
    checklistItem("publish_dry_run_ready", "Publish Dry-run ready 확인"),
    checklistItem("handoff_completed", "Handoff completed 확인"),
    checklistItem("final_content_check", "최종 내용 확인"),
    checklistItem("image_link_check", "이미지/링크 확인"),
    checklistItem("policy_violation_check", "플랫폼 정책 위반 가능성 확인"),
    checklistItem("record_url_after_posting", "게시 후 URL 기록 필요"),
  ];
}

function platformChecklist(platform: SocialPost["platform"]): { key: string; label: string }[] {
  switch (platform) {
    case "wordpress_blog":
      return [
        checklistItem("wordpress_workflow_duplicate_check", "WordPress 자동 게시 workflow와 중복 여부 확인"),
        checklistItem("wordpress_title_body_image_check", "제목/본문/대표 이미지 확인"),
        checklistItem("wordpress_seo_check", "SEO title/meta description 확인"),
        checklistItem("wordpress_visibility_check", "공개 상태 확인"),
        checklistItem("wordpress_copy_url", "게시 URL 복사"),
      ];
    case "naver_blog":
      return [
        checklistItem("naver_blog_title_check", "제목 확인"),
        checklistItem("naver_blog_body_format_check", "본문 서식 확인"),
        checklistItem("naver_blog_image_check", "이미지 삽입 여부 확인"),
        checklistItem("naver_blog_hashtag_check", "태그/해시태그 확인"),
        checklistItem("naver_blog_link_check", "링크 정상 여부 확인"),
        checklistItem("naver_blog_preview_check", "네이버 블로그 편집기에서 미리보기 확인"),
        checklistItem("naver_blog_copy_url", "게시 후 URL 복사"),
      ];
    case "naver_cafe":
      return [
        checklistItem("naver_cafe_rules_check", "카페 규칙 확인"),
        checklistItem("naver_cafe_promotional_check", "홍보성/도배성 문구 확인"),
        checklistItem("naver_cafe_link_overuse_check", "외부 링크 과다 여부 확인"),
        checklistItem("naver_cafe_discussion_check", "질문형/토론형 마무리 확인"),
        checklistItem("naver_cafe_category_check", "게시판 카테고리 확인"),
        checklistItem("naver_cafe_copy_url", "게시 후 URL 복사"),
      ];
    case "x":
      return [
        checklistItem("x_thread_order_check", "thread item 순서 확인"),
        checklistItem("x_item_length_check", "각 item 글자 수 확인"),
        checklistItem("x_link_preview_check", "링크 미리보기 확인"),
        checklistItem("x_hashtag_excess_check", "해시태그 과다 여부 확인"),
        checklistItem("x_copy_url", "게시 후 URL 복사"),
      ];
    case "threads":
      return [
        checklistItem("threads_tone_check", "문장 자연스러움 확인"),
        checklistItem("threads_hashtag_excess_check", "해시태그 과다 여부 확인"),
        checklistItem("threads_link_image_check", "링크/이미지 확인"),
        checklistItem("threads_copy_url", "게시 후 URL 복사"),
      ];
    case "instagram":
      return [
        checklistItem("instagram_media_ready_check", "이미지 또는 카드뉴스 준비 확인"),
        checklistItem("instagram_caption_check", "caption 확인"),
        checklistItem("instagram_hashtags_check", "hashtags 확인"),
        checklistItem("instagram_alt_text_check", "alt text 가능하면 확인"),
        checklistItem("instagram_copy_url", "게시 후 URL 복사"),
      ];
    default: {
      const exhaustiveCheck: never = platform;
      return exhaustiveCheck;
    }
  }
}

function platformInstructions(platform: SocialPost["platform"]): string[] {
  switch (platform) {
    case "wordpress_blog":
      return ["기존 WordPress 자동 게시 workflow가 있다면 중복 게시가 아닌지 먼저 확인하세요."];
    case "naver_blog":
      return ["네이버 블로그 편집기에 붙여넣은 뒤 미리보기로 서식이 깨지지 않았는지 확인하세요."];
    case "naver_cafe":
      return ["카페 규칙과 홍보성 게시 제한을 반드시 확인하세요."];
    case "x":
      return ["각 thread item을 순서대로 게시했는지 확인하세요."];
    case "threads":
      return ["Threads에서는 자연스러운 문장이 우선입니다."];
    case "instagram":
      return ["실제 게시에는 이미지 또는 카드뉴스 디자인이 필요합니다."];
    default:
      return [];
  }
}

/**
 * social post의 플랫폼에 맞는 manual posting checklist를 만든다. 실제
 * 게시는 수행하지 않으며, 사람이 게시 전/후 확인할 목록만 생성한다.
 */
export function buildManualPostingChecklist(post: SocialPost): ManualPostingChecklistBuildResult {
  const checklist = [...commonChecklist(), ...platformChecklist(post.platform)];
  const warnings: string[] = [];

  if (post.platformPublishDryRunStatus !== "ready") {
    warnings.push("platform_publish_dry_run_status가 ready가 아닙니다.");
  }
  if (!post.platformPublishReady) {
    warnings.push("platform_publish_ready=false입니다.");
  }
  if (post.handoffStatus !== "completed") {
    warnings.push("handoff_status가 completed가 아닙니다.");
  }

  return { platform: post.platform, checklist, warnings, instructions: platformInstructions(post.platform) };
}
