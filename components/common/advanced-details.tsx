// Phase UX-03A: 일반 사용자가 몰라도 되는 Level 2/3 정보(내부 상태값/
// raw status/ID/로그 등)를 일관된 접힘 UI로 보여주기 위한 공통
// 컴포넌트. 지금까지 페이지마다 "상세 상태 보기"/"내부 상태값 보기"/
// "고급 기능"처럼 이름과 마크업이 제각각인 <details>를 개별적으로
// 구현해 왔다 — 이 컴포넌트는 그 반복 마크업만 공통화한다(어떤
// 데이터/액션도 이 컴포넌트 안에 새로 넣지 않는다, children으로
// 그대로 받는다).
//
// 원칙(반드시 지킬 것):
// - 기본은 항상 닫힘(defaultOpen=false가 기본값)
// - 일반 사용자가 몰라도 되는 정보만 넣는다 — API key/token/password,
//   전체 raw body/prompt 원문은 이 컴포넌트 안에도 넣지 않는다.
// - 같은 성격의 정보에는 같은 title 문구를 쓴다(기본값 "상세 상태
//   보기"). "raw"/"internal"/"debug" 같은 개발자 용어를 title에
//   쓰지 않는다.

import type { ReactNode } from "react";

export interface AdvancedDetailsProps {
  /** summary에 보여줄 문구. 기본값은 "상세 상태 보기"(프로젝트 전반의 관례). */
  title?: string;
  /** 기본으로 펼쳐 둘지(대부분 false로 둔다 — 정말 필요할 때만 true). */
  defaultOpen?: boolean;
  /** 테스트/자동화에서 이 영역을 식별할 때 쓸 선택적 data-testid. */
  testId?: string;
  className?: string;
  children: ReactNode;
}

export function AdvancedDetails({
  title = "상세 상태 보기",
  defaultOpen = false,
  testId,
  className,
  children,
}: AdvancedDetailsProps) {
  return (
    <details className={className ?? "mt-2"} open={defaultOpen} data-testid={testId}>
      <summary className="cursor-pointer text-[10px] font-medium text-zinc-500">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
