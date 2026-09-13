// Phase 4-20: 글 카드 안에 "상세 보기 → 성과 보기 → 기사 개요 →" 처럼
// 화살표로 이어붙인 링크 목록이 반복되던 문제를 정리하는 공통
// 컴포넌트. 화살표를 작업 순서처럼 쓰지 않고, "관련 화면 보기"
// 접힘 영역 안에 텍스트 링크로 묶는다 — 기능(이동 링크)은 그대로
// 유지하고 표현/위치만 정리한다. primary/secondary action 버튼보다
// 절대 강조되지 않아야 하므로 항상 그 아래, 기본 접힘 상태로 둔다.

export interface RelatedPostLink {
  label: string;
  href: string;
}

export interface RelatedPostLinksProps {
  links: RelatedPostLink[];
  /** 기본은 접힘(false). 관련 화면 확인이 자주 필요한 화면이면 true로 펼쳐 둘 수 있다. */
  defaultOpen?: boolean;
  className?: string;
}

/** 링크가 하나도 없으면 아무것도 렌더링하지 않는다(빈 접힘 영역을 만들지 않는다). */
export function RelatedPostLinks({ links, defaultOpen = false, className }: RelatedPostLinksProps) {
  if (links.length === 0) return null;

  return (
    <details className={`mt-2 ${className ?? ""}`} open={defaultOpen}>
      <summary className="cursor-pointer text-[11px] text-zinc-400">관련 화면 보기</summary>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100"
          >
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}
