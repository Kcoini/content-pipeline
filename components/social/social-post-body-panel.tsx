"use client";

// Phase 4-15: SNS/커뮤니티 글 목록 카드 안에서 게시용 본문을 보여주고,
// [본문 수정]을 누르면 페이지 이동 없이 같은 카드 안에서 textarea 편집
// 모드로 전환한다. 저장은 서버 action(saveSocialPostInlineEditAction)을
// 그대로 재사용하며, 이 컴포넌트는 "편집 모드를 보여줄지" 로컬 상태만
// 관리한다 — 저장 로직 자체는 서버에만 있다.

import { useState } from "react";
import { ExpandableText } from "./expandable-text";
import { CopyPostBodyButton } from "./copy-post-body-button";
import { logSocialPostInlineEditClientEventAction } from "@/app/articles/[id]/actions";
import { getDefaultPostBodyViewMode, getPostBodyViewModeLabel } from "@/lib/social/post-body-view-mode";
import type { SocialPlatform } from "@/lib/social/social-platform-types";

export interface SocialPostBodyPanelProps {
  articleId: string;
  socialPostId: string;
  returnTo: string;
  /** 게시용 본문(getSocialPostDisplayBody 결과). 표시/복사/textarea 초기값에 모두 이 값을 그대로 쓴다. */
  displayBody: string;
  /** false면(x처럼 threadItems 배열 기반 플랫폼) 편집 버튼을 보여주지 않는다 — 상세 페이지에서만 수정 가능. */
  editable: boolean;
  saveAction: (formData: FormData) => Promise<void>;
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
  hideBodyWhenNotEditing = false,
  platform,
}: SocialPostBodyPanelProps) {
  const [editing, setEditing] = useState(false);

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

  if (editing) {
    return (
      <div className="mt-2 rounded border border-indigo-300 bg-white p-2">
        <p className="text-[11px] font-semibold text-indigo-900">{bodyLabel} 수정</p>
        <form action={saveAction}>
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="socialPostId" value={socialPostId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <textarea
            name="body"
            defaultValue={displayBody}
            rows={10}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-[12px] text-zinc-800"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}
          />
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <button
              type="submit"
              name="saveMode"
              value="save_review_and_approve"
              className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500"
            >
              저장 후 승인
            </button>
            <button
              type="submit"
              name="saveMode"
              value="save_and_review"
              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
            >
              저장 후 자동 검토
            </button>
            <button
              type="submit"
              name="saveMode"
              value="save_only"
              className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
            >
              저장만 하기
            </button>
            <button
              type="button"
              onClick={cancelEditor}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-500 hover:bg-zinc-100"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium text-zinc-500">
          {hideBodyWhenNotEditing ? "본문 확인" : bodyLabel}
          {/* Phase 4-24: X/Threads/Instagram처럼 글자 수 제한이 실제로
              중요한 copy 기본 플랫폼에서만 글자 수를 함께 보여준다. */}
          {!hideBodyWhenNotEditing && isCopyMode && (
            <span className="ml-1 font-normal text-zinc-400">({displayBody.length}자)</span>
          )}
        </p>
        <CopyPostBodyButton articleId={articleId} socialPostId={socialPostId} text={displayBody} />
      </div>
      {!hideBodyWhenNotEditing && <ExpandableText text={displayBody} className="mt-1 text-[12px] text-zinc-800" />}
      {editable && (
        <button
          type="button"
          onClick={openEditor}
          className="mt-2 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
        >
          본문 수정
        </button>
      )}
    </div>
  );
}
