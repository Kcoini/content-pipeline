// Phase 4-27: [본문 복사]/[전체 보기]·[본문 접기]/[본문 수정]이 카드마다
// 서로 다른 위치(상단/본문 아래/하단)에 흩어져 있던 문제를 정리한다.
// 이 컴포넌트는 세 버튼을 항상 같은 줄(순서: 복사 → 전체 보기/접기 →
// 수정)에 모아서 보여주는 순수 표시용 행이다 — 어떤 상태도 스스로
// 갖지 않고, 펼침 상태(expanded)/편집 열기(onEdit) 등은 모두 부모
// (SocialPostBodyPanel)가 소유한다.

import { CopyPostBodyButton } from "./copy-post-body-button";

const BUTTON_CLASS = "rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50";

export interface PostBodyActionRowProps {
  articleId: string;
  socialPostId: string;
  /** [본문 복사]가 복사할 전체 텍스트 — 접힌 상태여도 항상 전체를 복사한다. */
  copyText: string;
  /** true면(본문 길이 > 1,200자) [전체 보기]/[본문 접기] 버튼을 보여준다. 짧으면 아예 렌더링하지 않는다(비활성화가 아니라 미표시). */
  showExpandToggle: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /** false면(x처럼 threadItems 기반 플랫폼) [본문 수정] 버튼을 보여주지 않는다. */
  editable: boolean;
  onEdit: () => void;
  className?: string;
}

/**
 * 본문 확인 영역의 공통 버튼 행. 순서는 항상 [본문 복사] → [전체
 * 보기]/[본문 접기](필요할 때만) → [본문 수정](editable일 때만)이다.
 * flex-wrap을 써서 데스크톱은 한 줄, 좁은 화면은 자연스럽게 줄바꿈된다.
 */
export function PostBodyActionRow({
  articleId,
  socialPostId,
  copyText,
  showExpandToggle,
  expanded,
  onToggleExpand,
  editable,
  onEdit,
  className,
}: PostBodyActionRowProps) {
  return (
    <div className={className ?? "mt-2 flex flex-wrap items-center gap-2"}>
      <CopyPostBodyButton articleId={articleId} socialPostId={socialPostId} text={copyText} className={BUTTON_CLASS} />
      {showExpandToggle && (
        <button type="button" onClick={onToggleExpand} className={BUTTON_CLASS}>
          {expanded ? "본문 접기" : "전체 보기"}
        </button>
      )}
      {editable && (
        <button type="button" onClick={onEdit} className={BUTTON_CLASS}>
          본문 수정
        </button>
      )}
    </div>
  );
}
