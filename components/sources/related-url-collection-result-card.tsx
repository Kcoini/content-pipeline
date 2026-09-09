// Phase 3-27: "관련 기사 URL 수집" 버튼을 누른 뒤 반드시 보여줘야 하는
// 결과 요약 + 다음 행동 선택 UI. 버튼 클릭 후 무반응 상태를 만들지
// 않기 위한 화면이다 — 성공/부분 성공/결과 없음/실패를 각각 다른
// 문구로 보여주고, 상황에 맞는 버튼 하나만 primary로 강조한다.
//
// raw status/raw JSON/API 응답 전체는 여기서 절대 렌더링하지 않는다
// (found/saved/duplicate 같은 숫자와 사용자 친화적 문구만 사용한다).

import Link from "next/link";
import type { SourceStatusSummary } from "@/lib/dashboard/source-display";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

export type CollectionResultStatus = "success" | "partial" | "none" | "error" | "finished";

export interface CandidateStatusCounts {
  /** 아직 등록/제외 처리하지 않은 후보 수(전체 누적). */
  pending: number;
  /** 출처로 등록된 후보 수(전체 누적). */
  imported: number;
  /** 제외 처리된 후보 수(전체 누적). */
  dismissed: number;
}

export interface RelatedUrlCollectionResultCardProps {
  themeId: string;
  status: CollectionResultStatus;
  /** 이번 실행에서 새로 찾아 저장한 후보 수. */
  newCount: number;
  /** 이번 실행에서 이미 알고 있던(중복) 후보 수. */
  duplicateCount: number;
  candidateCounts: CandidateStatusCounts;
  sourceStatus: SourceStatusSummary;
  errorMessage?: string | null;
  /** 수집된 후보가 하나도 없으면 "수집한 URL 확인" 버튼을 보여주지 않는다(이동할 곳이 없다). */
  hasCollectedCandidates: boolean;
  /** "추가로 기사 URL 수집" — collectCandidates를 trigger=add_more로 다시 실행한다. */
  collectMoreAction: (formData: FormData) => Promise<void>;
  /** "이 정도로 충분합니다" — 수집 종료를 기록하고 종료 안내 화면으로 바꾼다. */
  finishCollectionAction: (formData: FormData) => Promise<void>;
  /** "대시보드로 돌아가기". */
  goDashboardAction: (formData: FormData) => Promise<void>;
  /** "글 생성 단계로 진행". */
  goGenerateAction: (formData: FormData) => Promise<void>;
}

const STATUS_HEADLINE: Record<CollectionResultStatus, string> = {
  success: "관련 기사 URL 수집이 완료되었습니다.",
  partial: "일부 기사 URL만 수집되었습니다.",
  none: "새로 등록할 기사 URL을 찾지 못했습니다.",
  error: "관련 기사 URL 수집 중 오류가 발생했습니다.",
  finished: "출처 수집을 종료했습니다.",
};

const STATUS_DESCRIPTION: Record<CollectionResultStatus, string> = {
  success: "새로운 기사 URL이 후보로 등록되었습니다.",
  partial: "일부 검색만 성공했습니다. 이미 등록된 URL이나 중복 URL은 제외되었습니다.",
  none: "검색어를 바꾸거나 직접 URL을 추가할 수 있습니다.",
  error: "잠시 후 다시 시도하거나 직접 URL을 추가해 주세요.",
  finished: "이제 글 생성을 진행할 수 있습니다.",
};

const STATUS_TONE_CLASS: Record<CollectionResultStatus, string> = {
  success: "border-green-200 bg-green-50 text-green-900",
  partial: "border-amber-200 bg-amber-50 text-amber-900",
  none: "border-zinc-200 bg-zinc-50 text-zinc-700",
  error: "border-red-200 bg-red-50 text-red-800",
  finished: "border-blue-200 bg-blue-50 text-blue-900",
};

/** 이 실행 화면에서 primary로 강조할 버튼 하나를 상황에 맞게 고른다(경쟁 금지). */
function resolvePrimaryAction(
  status: CollectionResultStatus,
  sourceStatus: SourceStatusSummary,
  newCount: number
): "generate" | "collect_more" | "add_manual" {
  if (status === "finished") return "generate";
  if (sourceStatus.isReady) return "generate";
  if (status === "error") return "collect_more";
  if (status === "none" && newCount === 0) return "add_manual";
  return "collect_more";
}

const PRIMARY_BUTTON_CLASS = "rounded bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700";
const SECONDARY_BUTTON_CLASS =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100";
const SECONDARY_SUBMIT_CLASS =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60";

export function RelatedUrlCollectionResultCard({
  themeId,
  status,
  newCount,
  duplicateCount,
  candidateCounts,
  sourceStatus,
  errorMessage,
  hasCollectedCandidates,
  collectMoreAction,
  finishCollectionAction,
  goDashboardAction,
  goGenerateAction,
}: RelatedUrlCollectionResultCardProps) {
  const primaryAction = resolvePrimaryAction(status, sourceStatus, newCount);
  const manualAddHref = `/dashboard?themeId=${themeId}#source-url-input`;

  return (
    <section
      id="collection-result"
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={`rounded-lg border p-4 shadow-sm outline-none ${STATUS_TONE_CLASS[status]}`}
    >
      <h2 className="text-sm font-semibold">{STATUS_HEADLINE[status]}</h2>
      <p className="mt-1 text-sm">{STATUS_DESCRIPTION[status]}</p>
      {status === "error" && errorMessage && <p className="mt-1 text-xs opacity-80">{errorMessage}</p>}

      {status !== "error" && status !== "finished" && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="font-medium opacity-70">새로 찾은 기사</dt>
            <dd className="text-sm font-semibold">{newCount}개</dd>
          </div>
          <div>
            <dt className="font-medium opacity-70">이미 알고 있던 기사</dt>
            <dd className="text-sm font-semibold">{duplicateCount}개</dd>
          </div>
          <div>
            <dt className="font-medium opacity-70">등록된 기사(누적)</dt>
            <dd className="text-sm font-semibold">{candidateCounts.imported}개</dd>
          </div>
          <div>
            <dt className="font-medium opacity-70">제외된 기사(누적)</dt>
            <dd className="text-sm font-semibold">{candidateCounts.dismissed}개</dd>
          </div>
        </dl>
      )}

      <div className="mt-3 rounded border border-white/60 bg-white/50 p-2 text-xs">
        <p className="font-medium">현재 출처</p>
        <p className="mt-0.5">
          출처 {sourceStatus.total}개 등록됨 · 본문 수집 완료 {sourceStatus.fetchSuccessCount}개 · 요약 완료{" "}
          {sourceStatus.summarySuccessCount}개
        </p>
        <p className="mt-0.5">
          {sourceStatus.isReady
            ? "글 생성에 필요한 출처 수를 충족했습니다."
            : `글 생성에는 출처가 ${sourceStatus.minRequired}개 필요합니다 (현재 ${sourceStatus.total}개).`}
        </p>
      </div>

      {status !== "finished" && (
        <div className="mt-3 rounded border border-white/60 bg-white/50 p-2 text-xs">
          <p className="font-medium">더 많은 관련 기사를 찾아볼까요?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <form action={collectMoreAction}>
              <input type="hidden" name="themeId" value={themeId} />
              <input type="hidden" name="trigger" value="add_more" />
              <PendingSubmitButton pendingLabel="수집 중..." className={PRIMARY_BUTTON_CLASS}>
                추가로 기사 URL 수집
              </PendingSubmitButton>
            </form>
            <form action={finishCollectionAction}>
              <input type="hidden" name="themeId" value={themeId} />
              <PendingSubmitButton pendingLabel="처리 중..." className={SECONDARY_SUBMIT_CLASS}>
                이 정도로 충분합니다
              </PendingSubmitButton>
            </form>
          </div>
        </div>
      )}

      <p className="mt-3 text-sm font-medium">다음 작업을 선택하세요.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <form action={goGenerateAction}>
          <input type="hidden" name="themeId" value={themeId} />
          <PendingSubmitButton
            pendingLabel="이동 중..."
            className={primaryAction === "generate" ? PRIMARY_BUTTON_CLASS : SECONDARY_SUBMIT_CLASS}
          >
            글 생성 단계로 진행
          </PendingSubmitButton>
        </form>

        {primaryAction !== "generate" && status !== "finished" && (
          <form action={collectMoreAction}>
            <input type="hidden" name="themeId" value={themeId} />
            <input type="hidden" name="trigger" value="add_more" />
            <PendingSubmitButton
              pendingLabel="수집 중..."
              className={primaryAction === "collect_more" ? PRIMARY_BUTTON_CLASS : SECONDARY_SUBMIT_CLASS}
            >
              추가로 기사 URL 수집
            </PendingSubmitButton>
          </form>
        )}

        {status !== "finished" && hasCollectedCandidates && (
          <Link href="#candidate-list" className={SECONDARY_BUTTON_CLASS}>
            수집한 URL 확인
          </Link>
        )}

        <Link
          href={manualAddHref}
          className={primaryAction === "add_manual" ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
        >
          직접 URL 추가
        </Link>

        <form action={goDashboardAction}>
          <input type="hidden" name="themeId" value={themeId} />
          <PendingSubmitButton pendingLabel="이동 중..." className={SECONDARY_SUBMIT_CLASS}>
            대시보드로 돌아가기
          </PendingSubmitButton>
        </form>
      </div>
    </section>
  );
}
