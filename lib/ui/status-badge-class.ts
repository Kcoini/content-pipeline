// app/articles/[id]/blog/page.tsx의 로컬 stepBadgeClass를 공용화했다
// (QA-01: browser 검증을 위해 공유 컴포넌트로 분리하면서 함께 뺐다).
// 워크플로 step 배지와 프로세스 로그 상태 배지가 같은 Tailwind 팔레트를
// 쓰도록 통합한다 — 새 디자인 시스템은 추가하지 않는다.

/** 6가지 사용자 상태(완료/필요/확인 필요/차단됨/실패/생략)와 그 변형 한국어 라벨을 색상으로 매핑한다. */
export function describeStatusBadgeClass(status: string): string {
  if (["완료", "승인됨", "생성됨", "준비됨", "연결됨", "준비 완료", "handoff 완료", "성공"].includes(status)) {
    return "bg-green-100 text-green-800";
  }
  if (["실패", "처리 실패", "차단됨", "없음"].includes(status)) {
    return "bg-red-100 text-red-800";
  }
  if (["필요", "승인 필요", "누락", "미확인", "경고", "미준비", "이미지 없이 진행", "확인 필요", "대기중"].includes(status)) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-zinc-100 text-zinc-600";
}
