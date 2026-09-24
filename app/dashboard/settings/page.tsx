import Link from "next/link";
import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav";
import { getContentServiceReadiness, type ReadinessStatus } from "@/lib/ui/content-service-readiness";

export const dynamic = "force-dynamic";

// PRODUCT-01D: 일반 내부 사용자용 Settings. 기술 설정 화면이 아니다 —
// 실제로 저장/편집 가능한 항목이 현재 하나도 없으므로(섹션 1 조사
// 결과: tone/platform 기본값을 저장하는 DB 구조가 없음, Category C),
// 이번 Phase에서 가짜 editable UI를 만들지 않는다. 전부 read-only
// 상태 표시다. Supabase/Anthropic/Vercel/env var/provider ID/
// preflight raw 결과/token/JSON은 이 화면에 노출하지 않는다.

const STATUS_BADGE_CLASS: Record<ReadinessStatus, string> = {
  available: "bg-green-100 text-green-700",
  needs_attention: "bg-amber-100 text-amber-800",
  unknown: "bg-zinc-100 text-zinc-600",
};

const STATUS_ICON: Record<ReadinessStatus, string> = {
  available: "✓",
  needs_attention: "⚠",
  unknown: "?",
};

function StatusRow({ label, status, message }: { label: string; status: ReadinessStatus; message: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
        <span aria-hidden="true">{STATUS_ICON[status]}</span>
        {message}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const readiness = getContentServiceReadiness();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">설정</h1>
            <p className="mt-1 text-sm text-zinc-600">현재 서비스 상태와 게시 방식을 확인합니다.</p>
          </div>
          <DashboardTopNav active="settings" />
        </header>

        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← 콘텐츠 만들기로 돌아가기
        </Link>

        {/* 콘텐츠 설정 — 현재 저장 가능한 기본값이 없다(Category C, 섹션 1/15).
            없는 기능을 있는 것처럼 보이는 편집 UI를 만들지 않는다. */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">콘텐츠 설정</h2>
          <p className="mt-2 text-sm text-zinc-600">
            글 스타일(문체)과 플랫폼은 콘텐츠를 만들 때마다 직접 선택합니다. 저장된 기본값은 아직 없습니다.
          </p>
        </section>

        {/* 연결 상태 */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">연결 상태</h2>
          <div className="mt-1 divide-y divide-zinc-100">
            <StatusRow label="콘텐츠 생성" status={readiness.canCreateContent.status} message={readiness.canCreateContent.message} />
            <StatusRow label="자료 검색" status={readiness.sourceSearchAvailable.status} message={readiness.sourceSearchAvailable.message} />
            <StatusRow label="WordPress" status={readiness.wordpressAvailable.status} message={readiness.wordpressAvailable.message} />
          </div>
          {readiness.wordpressAvailable.status !== "available" && (
            <p className="mt-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              연결 정보는 이 화면에서 직접 바꿀 수 없습니다. 관리자에게 연결 설정을 요청해 주세요.
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500">WordPress는 항상 초안(Draft)으로 저장됩니다 — 이 화면에서 공개 게시를 실행하지 않습니다.</p>
        </section>

        {/* 검토 및 게시 — 안전 관련 항목은 toggle을 제공하지 않는다(섹션 16). */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">검토 및 게시</h2>
          <div className="mt-1 divide-y divide-zinc-100">
            <StatusRow label="출처 확인" status="available" message="사용 중" />
            <StatusRow label="게시 전 최종 확인" status="available" message="사용 중" />
            <StatusRow label="WordPress 게시 방식" status="available" message="초안으로 저장" />
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            출처 확인과 최종 승인은 항상 켜져 있으며, 이 화면에서 끌 수 없습니다.
          </p>
        </section>
      </div>
    </div>
  );
}
