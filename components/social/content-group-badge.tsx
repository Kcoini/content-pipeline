// Phase 3-16: Content Type Separation & Dashboard Information Architecture.
// content_group 및 부가 안내 배지를 공통 스타일로 렌더링한다. 기존
// 프로젝트의 Tailwind 유틸리티 클래스만 사용하며 새 스타일 라이브러리를
// 추가하지 않는다.

import { getContentGroupBadge, type ContentGroup } from "@/lib/social/content-type-classifier";

export function ContentGroupBadge({ group }: { group: ContentGroup }) {
  const badge = getContentGroupBadge(group);
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>;
}

export type InfoBadgeLabel = "게시 완료" | "Metrics 필요" | "Low Performance" | "재게시 추천" | "수동 검토 후보";

const INFO_BADGE_STYLES: Record<InfoBadgeLabel, string> = {
  "게시 완료": "bg-green-100 text-green-700",
  "Metrics 필요": "bg-zinc-100 text-zinc-600",
  "Low Performance": "bg-amber-100 text-amber-700",
  "재게시 추천": "bg-indigo-100 text-indigo-700",
  "수동 검토 후보": "bg-red-100 text-red-700",
};

export function InfoBadge({ label }: { label: InfoBadgeLabel }) {
  return <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${INFO_BADGE_STYLES[label]}`}>{label}</span>;
}
