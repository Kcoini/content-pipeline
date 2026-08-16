import Link from "next/link";
import { listPlatformApiCapabilities, getPlatformApiModeLabel } from "@/lib/social/platform-api-capabilities";
import { checkPlatformApiReadiness } from "@/lib/social/platform-api-readiness-checker";
import { ApiReadinessBadge } from "@/components/platform-api/api-readiness-badge";

export const dynamic = "force-dynamic";

export default function PlatformApiDashboardPage() {
  const rows = listPlatformApiCapabilities().map((capability) => ({
    capability,
    readiness: checkPlatformApiReadiness(capability.platform),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Platform API Readiness</h1>
            <p className="mt-1 text-sm text-zinc-600">
              플랫폼별 API 게시 준비 상태입니다 — 실제 게시가 아니라 준비 단계 확인용입니다.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            메인 대시보드로
          </Link>
        </header>

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>이 화면은 실제 API 게시가 아니라 API 게시 준비 상태 확인입니다.</p>
          <p>현재 자동 게시 기능은 비활성화되어 있습니다.</p>
          <p>토큰이나 API key 값은 화면에 표시하지 않습니다 — 설정 이름과 상태만 표시합니다.</p>
          <p>수동 Export/Handoff 흐름은 계속 사용할 수 있습니다.</p>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Platform Capability Matrix</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead>
                <tr className="text-zinc-500">
                  <th className="pr-3 py-1">platform</th>
                  <th className="pr-3 py-1">capability</th>
                  <th className="pr-3 py-1">feature flag</th>
                  <th className="pr-3 py-1">readiness</th>
                  <th className="pr-3 py-1">dry-run 지원</th>
                  <th className="pr-3 py-1">실제 게시 지원(capability상)</th>
                  <th className="pr-3 py-1">fallback mode</th>
                  <th className="pr-3 py-1">설정 누락</th>
                </tr>
              </thead>
              <tbody className="text-zinc-700">
                {rows.map(({ capability, readiness }) => (
                  <tr key={capability.platform} className="border-t border-zinc-100">
                    <td className="pr-3 py-1 font-mono">{capability.platform}</td>
                    <td className="pr-3 py-1">{getPlatformApiModeLabel(capability.currentMode)}</td>
                    <td className="pr-3 py-1">
                      {readiness.publishEnabled ? "활성화" : "비활성화"}
                      <span className="ml-1 font-mono text-[10px] text-zinc-400">({capability.publishEnabledFlagName})</span>
                    </td>
                    <td className="pr-3 py-1">
                      <ApiReadinessBadge status={readiness.status} />
                    </td>
                    <td className="pr-3 py-1">{capability.supportsDryRun ? "예" : "아니오"}</td>
                    <td className="pr-3 py-1">{capability.supportsApiPublishing ? "예" : "아니오"}</td>
                    <td className="pr-3 py-1">{capability.currentMode}</td>
                    <td className="pr-3 py-1">{readiness.missingEnvVars.length}개</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">Notes / Warnings</h2>
          <ul className="mt-2 flex flex-col gap-3 text-xs">
            {rows.map(({ capability, readiness }) => (
              <li key={capability.platform} className="rounded border border-zinc-200 p-2">
                <p className="font-medium text-zinc-700">{capability.platform}</p>
                <p className="mt-1 text-zinc-500">{capability.notes}</p>
                {readiness.blockers.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-red-600">
                    {readiness.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {readiness.warnings.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-amber-700">
                    {readiness.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
