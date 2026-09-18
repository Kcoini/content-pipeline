// 공통 "WordPress 게시 준비" 패널 — /articles/[id] 고급 기능(article
// targetType)과 /articles/[id]/blog의 wordpress_blog 카드(wordpress_blog
// targetType) 양쪽에서 같은 구조로 사용한다.
//
// 이 컴포넌트는 순수 표시 전용(read-only)이다 — 어떤 action도 직접
// 호출하지 않는다. 실제 버튼/폼(action)은 각 페이지가 targetType에 맞는
// 자기 자신의 action을 사용해 children으로 넘긴다:
//   - targetType="article" → article 전용 action(article 원문 title/content 전송)
//   - targetType="wordpress_blog" → wordpress_blog social_post 전용 action
// 두 targetType의 action/데이터를 이 컴포넌트 안에서 섞지 않는다 —
// article title/content가 wordpress_blog 게시에 쓰이거나, 그 반대로
// 쓰이는 일이 없도록 각 페이지가 자기 데이터만 전달한다.

import type { ReactNode } from "react";
import { describeStatusValue } from "@/lib/social/status-labels";

export type WordPressPublishingTargetType = "article" | "wordpress_blog";

export interface WordPressPublishingPanelSummary {
  /** article.publishQualityGateStatus 또는 social_post.qualityStatus. */
  qualityStatus: string;
  /** article.publicPublishApprovalStatus 또는 social_post.approvalStatus. */
  approvalStatus: string;
  /** WordPress Draft 생성 여부를 나타내는 문자열(예: "생성됨"/"아직 생성되지 않음"). */
  draftStatus: string;
  draftId: string | null;
  draftUrl?: string | null;
  seoMetadataStatus: string;
  seoTitle: string | null;
  metaDescription: string | null;
  targetKeyword: string | null;
  secondaryKeywords?: string[];
  featuredImageStatus: string;
  featuredImageMediaId: number | null;
  featuredImageUrl?: string | null;
  /** WordPress post에 실제로 대표 이미지를 연결한 결과 상태(있으면). */
  featuredImageAttachStatus?: string | null;
  /** 이미지 준비/연결 중 발생한 오류 메시지(있으면). */
  featuredImageErrorMessage?: string | null;
  /** 사용자가 "대표 이미지 없이 진행"을 선택했는지 여부. */
  featuredImageWaived: boolean;
  featuredImageWaiverReason?: string | null;
  publishGuardStatus: string;
  /** 가장 최근에 실행한 action의 결과 요약(있으면). 실패 사유 등 사람이 읽을 안전한 문자열만. */
  lastActionResult?: string | null;
  /** WordPress Draft/metadata를 마지막으로 갱신한 시각(ISO 문자열, 있으면). */
  lastUpdatedAt?: string | null;
}

export interface WordPressPublishingPanelProps {
  targetType: WordPressPublishingTargetType;
  /** true면 "기본 게시 흐름"(wordpress_blog), false면 "보조 기능/고급 기능"(article) 배지를 표시한다. */
  isPrimaryWorkflow: boolean;
  summary: WordPressPublishingPanelSummary;
  /** 실제 action 버튼/폼(targetType별로 페이지가 직접 구성해서 넘긴다). */
  children?: ReactNode;
}

const TARGET_LABEL: Record<WordPressPublishingTargetType, string> = {
  article: "원본 article",
  wordpress_blog: "wordpress_blog",
};

const DESCRIPTION: Record<WordPressPublishingTargetType, string> = {
  article:
    "이 기능은 원본 article을 그대로 WordPress Draft로 전송할 때 사용합니다. WordPress 블로그형 글로 게시하려면 Blog 탭에서 wordpress_blog 글을 생성한 뒤 해당 글의 WordPress 게시 준비 기능을 사용하세요.",
  wordpress_blog:
    "이 기능은 WordPress 블로그 글로 생성된 wordpress_blog 콘텐츠를 WordPress Draft로 전송하거나 업데이트할 때 사용합니다. 기사초안 원문이 아니라, 이 블로그 카드의 제목·본문·SEO metadata·대표 이미지 정보를 기준으로 WordPress에 반영합니다.",
};

/**
 * SEO 필드가 비어 있을 때 보여줄 안내 문구. targetType마다 원인과 해결
 * 방법이 다르므로(article은 애초에 값이 없을 수 있고, wordpress_blog는
 * 자체 생성/재생성으로 채울 수 있다) 서로 다른 문구를 쓴다 — 어느 쪽도
 * 상대방의 metadata로 자동 대체(fallback)하지 않는다는 점을 문구로도
 * 드러낸다.
 */
/** article은 필드명과 무관하게 공통 문구를, wordpress_blog는 "OOO 없음" 형태로 어떤 필드가 비었는지 짚어준다. */
function seoFieldMissingLabel(targetType: WordPressPublishingTargetType, fieldLabel: string): string {
  return targetType === "article" ? "설정되지 않음" : `${fieldLabel} 없음`;
}

export function WordPressPublishingPanel({
  targetType,
  isPrimaryWorkflow,
  summary,
  children,
}: WordPressPublishingPanelProps) {
  const containerClass =
    targetType === "article"
      ? "rounded border border-amber-200 bg-amber-50/60 p-3"
      : "rounded border border-indigo-200 bg-indigo-50/60 p-3";
  const badgeBase = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  const targetBadgeClass = targetType === "article" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800";
  const roleBadgeClass = isPrimaryWorkflow ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-700";
  const textClass = targetType === "article" ? "text-amber-900" : "text-indigo-900";
  const subTextClass = targetType === "article" ? "text-amber-700" : "text-indigo-700";
  const labelClass = targetType === "article" ? "text-amber-800" : "text-indigo-800";

  // Phase UX-02B (섹션 K): isPrimaryWorkflow=true(wordpress_blog)인 화면은
  // 이 패널의 children으로 이미 자체 "WordPress 게시 준비" 다음 작업
  // 카드를 렌더링한다(예: app/articles/[id]/blog/page.tsx) — 같은 문구를
  // 바로 위에 또 두면 같은 이름의 섹션이 중첩되어 보인다. 그래서
  // isPrimaryWorkflow일 때는 이 패널을 "그 카드의 세부 상태를 담는
  // 바깥 틀"로 구분해 다른 제목을 쓴다. isPrimaryWorkflow=false(article
  // 고급 기능)는 children 없이 단독으로 쓰이므로 원래 제목을 유지한다.
  const headingText = isPrimaryWorkflow ? "게시 상태 요약" : "WordPress 게시 준비";

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-2">
        <p className={`text-[11px] font-semibold ${textClass}`}>{headingText}</p>
        <span className={`${badgeBase} ${targetBadgeClass}`}>대상: {TARGET_LABEL[targetType]}</span>
        {isPrimaryWorkflow ? (
          <>
            <span className={`${badgeBase} ${roleBadgeClass}`}>기본 게시 흐름</span>
            <span className={`${badgeBase} ${roleBadgeClass}`}>WordPress 블로그 글 기준</span>
          </>
        ) : (
          <>
            <span className={`${badgeBase} ${roleBadgeClass}`}>보조 기능</span>
            <span className={`${badgeBase} ${roleBadgeClass}`}>고급 기능</span>
          </>
        )}
      </div>
      <p className={`mt-1 text-[11px] ${subTextClass}`}>{DESCRIPTION[targetType]}</p>

      {/*
        Phase UX-02B (C4): 기본 화면에는 "지금 어떤 상태인지"를 한
        눈에 보여줄 수 있는 짧은 요약만 둔다(5줄) — raw enum은
        describeStatusValue로 번역해서 보여준다. WordPress/이미지 관련
        내부 식별자·URL, raw publish guard 값, 마지막 갱신 시각 같은
        세부 정보는 전부 아래 "상세 상태 보기" 접힘 안으로 옮긴다.
      */}
      <ul className={`mt-2 flex flex-col gap-0.5 text-[11px] ${labelClass}`}>
        <li>품질검사: {describeStatusValue(summary.qualityStatus)}</li>
        <li>승인: {describeStatusValue(summary.approvalStatus)}</li>
        <li>WordPress Draft: {summary.draftStatus}</li>
        <li>SEO 정보: {describeStatusValue(summary.seoMetadataStatus)}</li>
        <li>대표 이미지: {describeStatusValue(summary.featuredImageStatus)}</li>
      </ul>
      {targetType === "wordpress_blog" &&
        (!summary.seoTitle || !summary.metaDescription || !summary.targetKeyword) && (
          <p className={`mt-1.5 text-[11px] ${subTextClass}`}>
            metadata 재생성이 필요합니다. article의 SEO metadata로 자동 대체되지 않습니다 — &ldquo;SEO
            Metadata 재생성&rdquo; 버튼을 사용하세요.
          </p>
        )}
      {summary.featuredImageErrorMessage && (
        <p className="mt-1.5 text-[11px] text-red-700">오류: {summary.featuredImageErrorMessage}</p>
      )}

      {children}

      <details className="mt-2">
        <summary className={`cursor-pointer text-[10px] ${subTextClass}`}>상세 상태 보기</summary>
        <dl className={`mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2 ${labelClass}`}>
          <div>
            <dt className="font-medium">WordPress Post/Draft ID</dt>
            <dd>
              {summary.draftId ?? "-"}
              {summary.draftUrl && (
                <>
                  {" "}
                  (
                  <a href={summary.draftUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    열기
                  </a>
                  )
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium">seoTitle</dt>
            <dd>{summary.seoTitle ?? seoFieldMissingLabel(targetType, "SEO Title")}</dd>
          </div>
          <div>
            <dt className="font-medium">metaDescription</dt>
            <dd>{summary.metaDescription ?? seoFieldMissingLabel(targetType, "Meta Description")}</dd>
          </div>
          <div>
            <dt className="font-medium">targetKeyword</dt>
            <dd>{summary.targetKeyword ?? seoFieldMissingLabel(targetType, "Target Keyword")}</dd>
          </div>
          {summary.secondaryKeywords && (
            <div>
              <dt className="font-medium">secondaryKeywords</dt>
              <dd>{summary.secondaryKeywords.length > 0 ? summary.secondaryKeywords.join(", ") : "-"}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">WordPress media ID</dt>
            <dd>{summary.featuredImageMediaId ?? "-"}</dd>
          </div>
          {summary.featuredImageUrl !== undefined && (
            <div>
              <dt className="font-medium">Media URL</dt>
              <dd className="break-all">{summary.featuredImageUrl ?? "-"}</dd>
            </div>
          )}
          {summary.featuredImageAttachStatus !== undefined && (
            <div>
              <dt className="font-medium">연결 상태</dt>
              <dd>{summary.featuredImageAttachStatus ? describeStatusValue(summary.featuredImageAttachStatus) : "-"}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">대표 이미지 생략 여부</dt>
            <dd>
              {summary.featuredImageWaived ? "예" : "아니오"}
              {summary.featuredImageWaived && summary.featuredImageWaiverReason ? ` (사유: ${summary.featuredImageWaiverReason})` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-medium">게시 준비 상태</dt>
            <dd>{describeStatusValue(summary.publishGuardStatus)}</dd>
          </div>
          {summary.lastUpdatedAt && (
            <div>
              <dt className="font-medium">마지막 업데이트 시각</dt>
              <dd>{summary.lastUpdatedAt}</dd>
            </div>
          )}
          {summary.lastActionResult && (
            <div className="sm:col-span-2">
              <dt className="font-medium">마지막 실행 결과</dt>
              <dd>{summary.lastActionResult}</dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
}
