// Phase 3-21: Platform API Publishing Preparation.
// social_post 하나의 API 게시 준비 상태를 보여주는 패널. 환경변수
// 값은 절대 표시하지 않는다 — "설정됨/누락"과 이름만 표시한다.
// actual publish 버튼은 어디에도 없다.

import type { PlatformApiCapability } from "@/lib/social/platform-api-capabilities";
import { getPlatformApiModeLabel } from "@/lib/social/platform-api-capabilities";
import type { PlatformApiReadinessResult } from "@/lib/social/platform-api-readiness-checker";
import type { PlatformApiPublishEligibility } from "@/lib/social/platform-api-publish-eligibility-guard";
import { ApiReadinessBadge } from "./api-readiness-badge";

export function ApiReadinessSummary({
  capability,
  readiness,
  eligibility,
}: {
  capability: PlatformApiCapability;
  readiness: PlatformApiReadinessResult;
  eligibility?: PlatformApiPublishEligibility;
}) {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ApiReadinessBadge status={readiness.status} />
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{getPlatformApiModeLabel(capability.currentMode)}</span>
        {readiness.dryRunOnly && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">dry-run only</span>}
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-600">feature flag</dt>
          <dd className="text-zinc-500">{readiness.publishEnabled ? "활성화" : "비활성화"} ({capability.publishEnabledFlagName})</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-600">설정 상태</dt>
          <dd className="text-zinc-500">
            {readiness.configured ? "설정 완료" : `설정 누락 ${readiness.missingEnvVars.length}개`}
            {readiness.missingEnvVars.length > 0 && (
              <span className="ml-1 font-mono text-[10px] text-amber-700">({readiness.missingEnvVars.join(", ")})</span>
            )}
          </dd>
        </div>
        {eligibility && (
          <>
            <div>
              <dt className="font-medium text-zinc-600">dry-run 가능</dt>
              <dd className={eligibility.eligibleForDryRun ? "font-medium text-green-700" : "text-zinc-500"}>
                {eligibility.eligibleForDryRun ? "예" : "아니오"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">실제 게시 가능</dt>
              <dd className={eligibility.eligibleForActualPublish ? "font-medium text-red-700" : "text-zinc-500"}>
                {eligibility.eligibleForActualPublish ? "예 (주의)" : "아니오 (준비 단계)"}
              </dd>
            </div>
          </>
        )}
      </dl>

      {(eligibility?.blockers.length ?? readiness.blockers.length) > 0 && (
        <div className="mt-2">
          <p className="font-medium text-red-700">blockers</p>
          <ul className="mt-1 list-inside list-disc text-red-600">
            {(eligibility?.blockers ?? readiness.blockers).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {(eligibility?.warnings.length ?? readiness.warnings.length) > 0 && (
        <div className="mt-2">
          <p className="font-medium text-amber-700">warnings</p>
          <ul className="mt-1 list-inside list-disc text-amber-700">
            {(eligibility?.warnings ?? readiness.warnings).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-[11px] text-zinc-400">{capability.notes}</p>
    </div>
  );
}
