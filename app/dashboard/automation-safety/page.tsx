import Link from "next/link";
import { runAutomationSafetyReview } from "@/lib/social/automation-safety-review-service";
import { rerunAutomationSafetyReview } from "./actions";
import type { AutomationSafetyCategory, AutomationSafetyStatus } from "@/lib/social/automation-safety-review-types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AutomationSafetyStatus, string> = {
  not_checked: "점검 전",
  safe: "안전",
  warning: "주의",
  blocked: "차단 필요",
  failed: "점검 실패",
};

const STATUS_BADGE_CLASS: Record<AutomationSafetyStatus, string> = {
  not_checked: "border-zinc-300 bg-zinc-50 text-zinc-600",
  safe: "border-emerald-300 bg-emerald-50 text-emerald-700",
  warning: "border-amber-300 bg-amber-50 text-amber-700",
  blocked: "border-red-300 bg-red-50 text-red-700",
  failed: "border-red-300 bg-red-50 text-red-700",
};

// Phase 3-24: 카테고리 라벨을 영어에서 한국어로 바꿨다.
const CATEGORY_LABEL: Record<AutomationSafetyCategory, string> = {
  feature_flags: "기능 플래그",
  approval_gates: "승인 게이트",
  publish_guards: "게시 가드",
  api_publish: "API 게시",
  logging_security: "로깅 보안",
  content_safety: "콘텐츠 안전",
  data_integrity: "데이터 무결성",
  rollback: "롤백 / 복구",
  manual_workflow: "수동 작업 흐름",
  environment: "환경 설정",
};

function StatusBadge({ status }: { status: AutomationSafetyStatus }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function AutomationSafetyPage() {
  const result = await runAutomationSafetyReview();

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            {/* Phase 3-24: 영어 제목을 한국어로 바꾸고, 이 화면에서 할 수
                있는 일을 한 문장으로 안내한다. */}
            <h1 className="text-2xl font-bold">자동화 안전 점검</h1>
            <p className="mt-1 text-sm text-zinc-600">
              자동화 기능이 공개 게시나 민감정보 노출로 이어지지 않도록 점검합니다. 실제 API 게시나 자동화 확장 전,
              승인 게이트/게시 가드/로깅 보안/금지 콘텐츠 규칙을 점검합니다.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            메인 대시보드로
          </Link>
        </header>

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">이 페이지는 점검 전용이며 데이터를 자동 수정하지 않습니다.</p>
          <p>실제 게시 버튼이나 자동 수정 버튼은 제공하지 않습니다.</p>
          <p>API key, access token, refresh token, Authorization header, Application Password 값은 표시하지 않습니다.</p>
        </div>

        <section className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs text-zinc-500">전체 상태</p>
            <div className="mt-1">
              <StatusBadge status={result.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500">차단 필요(심각)</p>
            <p className="mt-1 text-lg font-semibold text-red-700">{result.blockers.length}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">주의</p>
            <p className="mt-1 text-lg font-semibold text-amber-700">{result.warnings.length}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">점검 시각</p>
            <p className="mt-1 text-xs text-zinc-600">{result.checkedAt}</p>
          </div>
          <p className="flex-1 text-sm text-zinc-600">{result.summary}</p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">점검 실행</h2>
          <p className="mt-1 text-xs text-zinc-500">
            아래 버튼은 이 페이지의 점검 결과를 다시 계산할 뿐이며, 실제 게시나 데이터 수정은 수행하지 않습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={rerunAutomationSafetyReview}>
              <button type="submit" className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                Safety Review 실행
              </button>
            </form>
            <form action={rerunAutomationSafetyReview}>
              <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                최근 로그 보안 점검
              </button>
            </form>
            <form action={rerunAutomationSafetyReview}>
              <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                게시 workflow 점검
              </button>
            </form>
            <form action={rerunAutomationSafetyReview}>
              <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                feature flag 점검
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">카테고리별 상태</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {result.categoryResults.map((cat) => (
              <div key={cat.category} className="rounded border border-zinc-200 p-3">
                <p className="text-xs font-medium text-zinc-700">{CATEGORY_LABEL[cat.category]}</p>
                <div className="mt-1">
                  <StatusBadge status={cat.status} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">finding {cat.findings.length}건</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">점검 체크리스트</h2>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {result.checklist.map((item) => (
              <li key={item.id} className="rounded border border-zinc-100 px-2 py-1">
                <span className="font-mono text-[10px] text-zinc-400">[{CATEGORY_LABEL[item.category]}]</span>{" "}
                <span className="font-medium text-zinc-700">{item.label}</span>
                <p className="text-zinc-500">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">발견된 문제</h2>
          {result.findings.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">발견된 문제가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-xs">
              {result.findings.map((finding) => (
                <li key={finding.id} className="rounded border border-zinc-200 p-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                      {finding.severity}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">{CATEGORY_LABEL[finding.category]}</span>
                  </div>
                  <p className="mt-1 text-zinc-700">{finding.message}</p>
                  {finding.sampleIds && finding.sampleIds.length > 0 && (
                    <p className="mt-1 text-zinc-500">샘플 id: {finding.sampleIds.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-700">권장 조치</h2>
          {result.recommendations.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">추가 권장 조치가 없습니다.</p>
          ) : (
            <ul className="mt-2 list-inside list-disc text-xs text-zinc-700">
              {result.recommendations.map((rec) => (
                <li key={rec.id}>{rec.message}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
