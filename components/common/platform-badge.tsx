// Phase UX-03C: app/trends/page.tsx, app/themes/[themeId]/page.tsx에 각각
// 따로 구현되어 있던 PlatformBadge(raw key를 그대로 노출하던 컴포넌트)를
// 공통화. label/색상 계산은 이 컴포넌트가 새로 하지 않고
// lib/ui/platform-badge.ts에 위임한다.

import { describePlatformBadge, getPlatformBadgeClassName } from "@/lib/ui/platform-badge";

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${getPlatformBadgeClassName(platform)}${
        className ? ` ${className}` : ""
      }`}
    >
      {describePlatformBadge(platform)}
    </span>
  );
}
