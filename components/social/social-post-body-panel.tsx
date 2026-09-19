"use client";

// Phase 4-15: SNS/커뮤니티 글 목록 카드 안에서 게시용 본문을 보여주고,
// [본문 수정]을 누르면 페이지 이동 없이 같은 카드 안에서 textarea 편집
// 모드로 전환한다. 저장은 서버 action(saveSocialPostInlineEditAction)을
// 그대로 재사용하며, 이 컴포넌트는 "편집 모드를 보여줄지" 로컬 상태만
// 관리한다 — 저장 로직 자체는 서버에만 있다.

import { useState } from "react";
import { ExpandableText, needsExpandableCollapse } from "./expandable-text";
import { PostBodyActionRow } from "./post-body-action-row";
import { InlinePostBodyEditor } from "./inline-post-body-editor";
import { logSocialPostInlineEditClientEventAction } from "@/app/articles/[id]/actions";
import { getDefaultPostBodyViewMode, getPostBodyViewModeLabel } from "@/lib/social/post-body-view-mode";
import { formatThreadItemsForCopy } from "@/lib/social/thread-item-formatter";
import type { SocialPlatform, ThreadItem } from "@/lib/social/social-platform-types";

export interface SocialPostBodyPanelProps {
  articleId: string;
  socialPostId: string;
  returnTo: string;
  /** 게시용 본문(getSocialPostDisplayBody 결과). 표시/복사/textarea 초기값에 모두 이 값을 그대로 쓴다. threadItems가 있으면 미리보기 텍스트로만 쓰이고, 복사/편집은 threadItems 기준으로 동작한다. */
  displayBody: string;
  /** false면 편집 버튼을 보여주지 않는다 — 상세 페이지에서만 수정 가능. threadItems+saveThreadAction이 있으면(X 등) 이 값과 무관하게 항상 편집 가능하다. */
  editable: boolean;
  saveAction: (formData: FormData) => Promise<void>;
  /**
   * Phase UX-03B2: X처럼 threadItems 배열로 구성된 콘텐츠를 카드 안에서
   * 바로 편집하려면 이 값과 saveThreadAction을 함께 넘긴다 — 이 값이
   * 있으면(길이 무관, 빈 배열이 아니면) [본문 수정]이 항상 mode="thread"
   * InlinePostBodyEditor를 연다(상세 페이지 이동 없이). 본문 복사도
   * displayBody가 아니라 이 배열을 순서대로 이어붙인 텍스트를 쓴다.
   */
  threadItems?: ThreadItem[];
  /** threadItems가 있을 때 저장을 처리하는 server action(saveSocialPostThreadInlineEditAction). */
  saveThreadAction?: (formData: FormData) => Promise<void>;
  /** thread item별 권장 글자 수 제한(예: X의 280자) — 새 제한을 만들지 않고 호출 측이 기존 PLATFORM_WRITING_CONFIGS 값을 그대로 전달한다. */
  threadItemMaxLength?: number;
  /**
   * true면 (편집 중이 아닐 때) 본문 미리보기(ExpandableText)를 표시하지
   * 않고 [본문 수정]/[본문 복사] 버튼만 보여준다. wordpress_blog 카드처럼
   * 이미 다른 탭(게시용 미리보기/편집용 원문)에서 본문 전체를 보여주고
   * 있어서, 같은 본문을 카드 안에서 또 중복 표시하지 않아야 할 때 쓴다.
   * 편집 모드에서는 이 값과 무관하게 항상 전체 textarea를 보여준다.
   */
  hideBodyWhenNotEditing?: boolean;
  /**
   * 있으면 getDefaultPostBodyViewMode(platform)로 라벨을 결정한다
   * (naver_cafe/x/threads/instagram은 "복사용 텍스트" + 글자 수,
   * 그 외는 "게시용 미리보기"). 생략하면 기존처럼 "게시용 본문"으로
   * 표시한다(hideBodyWhenNotEditing이면 "본문 확인").
   */
  platform?: SocialPlatform;
}

export function SocialPostBodyPanel({
  articleId,
  socialPostId,
  returnTo,
  displayBody,
  editable,
  saveAction,
  threadItems,
  saveThreadAction,
  threadItemMaxLength,
  hideBodyWhenNotEditing = false,
  platform,
}: SocialPostBodyPanelProps) {
  // Phase UX-03B2: threadItems+saveThreadAction이 함께 있으면 이 카드는
  // "thread 편집 가능" 상태다 — X도 다른 플랫폼과 동일하게 [본문 수정]이
  // 같은 카드 안 inline editor를 연다(상세 페이지로 보내지 않는다).
  const isThreadMode = threadItems !== undefined && saveThreadAction !== undefined;
  const effectiveEditable = isThreadMode ? true : editable;
  const copyText = isThreadMode ? formatThreadItemsForCopy(threadItems) : displayBody;
  const [editing, setEditing] = useState(false);
  // Phase 4-27: 펼침 상태를 이 컴포넌트가 소유하고 ExpandableText를
  // controlled로 넘긴다 — [전체 보기]/[본문 접기] 버튼을 PostBodyActionRow
  // 하나로 모으기 위해서다(본문 텍스트 아래에 ExpandableText 자신의
  // 버튼이 또 생기지 않도록 hideToggleButton도 함께 쓴다).
  const [expanded, setExpanded] = useState(false);

  const openEditor = () => {
    setEditing(true);
    void logSocialPostInlineEditClientEventAction({ articleId, socialPostId, event: "opened" }).catch(() => {});
  };

  const cancelEditor = () => {
    setEditing(false);
    void logSocialPostInlineEditClientEventAction({ articleId, socialPostId, event: "cancelled" }).catch(() => {});
  };

  // platform이 주어지면 플랫폼별 기본 viewMode(getDefaultPostBodyViewMode)에
  // 맞는 라벨을 쓴다 — naver_cafe/x/threads/instagram은 "복사용 텍스트"
  // (+ 글자 수), 그 외(wordpress_blog/naver_blog/news_article/opinion_column
  // 등)는 "게시용 미리보기". platform을 넘기지 않으면(호출부를 아직
  // 바꾸지 않은 곳) 기존과 동일하게 "게시용 본문"을 그대로 쓴다 — 하위
  // 호환을 깨지 않는다.
  const viewMode = platform ? getDefaultPostBodyViewMode(platform) : null;
  const bodyLabel = viewMode ? getPostBodyViewModeLabel(viewMode) : "게시용 본문";
  const isCopyMode = viewMode === "copy";

  if (editing && isThreadMode && threadItems && saveThreadAction) {
    return (
      <InlinePostBodyEditor
        mode="thread"
        articleId={articleId}
        socialPostId={socialPostId}
        returnTo={returnTo}
        items={threadItems.slice().sort((a, b) => a.order - b.order).map((item) => ({ text: item.text }))}
        maxLengthPerItem={threadItemMaxLength}
        title={`${bodyLabel} 수정`}
        saveAction={saveThreadAction}
        onCancel={cancelEditor}
      />
    );
  }

  if (editing) {
    return (
      <InlinePostBodyEditor
        articleId={articleId}
        socialPostId={socialPostId}
        returnTo={returnTo}
        value={displayBody}
        title={`${bodyLabel} 수정`}
        saveAction={saveAction}
        onCancel={cancelEditor}
      />
    );
  }

  // Phase 4-27: [본문 복사]/[전체 보기]·[본문 접기]/[본문 수정]을 항상
  // 같은 줄, 같은 순서(복사 → 전체 보기/접기 → 수정)로 보여준다 —
  // 본문이 짧아서 펼칠 필요가 없으면(needsExpandableCollapse=false)
  // [전체 보기] 자체를 아예 렌더링하지 않는다(비활성화가 아니라 미표시).
  const showExpandToggle = !hideBodyWhenNotEditing && needsExpandableCollapse(displayBody);

  return (
    <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
      <p className="text-[10px] font-medium text-zinc-500">
        {hideBodyWhenNotEditing ? "본문 확인" : bodyLabel}
        {/* Phase 4-24: X/Threads/Instagram처럼 글자 수 제한이 실제로
            중요한 copy 기본 플랫폼에서만 글자 수를 함께 보여준다. */}
        {!hideBodyWhenNotEditing && isCopyMode && (
          <span className="ml-1 font-normal text-zinc-400">({displayBody.length}자)</span>
        )}
      </p>
      {!hideBodyWhenNotEditing && (
        <ExpandableText
          text={displayBody}
          expanded={expanded}
          hideToggleButton
          className="mt-1 text-[12px] text-zinc-800"
        />
      )}
      <PostBodyActionRow
        articleId={articleId}
        socialPostId={socialPostId}
        copyText={copyText}
        showExpandToggle={showExpandToggle}
        expanded={expanded}
        onToggleExpand={() => setExpanded((prev) => !prev)}
        editable={effectiveEditable}
        onEdit={openEditor}
      />
    </div>
  );
}
