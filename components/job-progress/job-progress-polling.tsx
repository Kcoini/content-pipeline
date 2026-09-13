"use client";

// Phase 4-17: Job Progress System — jobRunId를 받아 /api/job-runs/[id]를
// 2~3초 간격으로 polling하며 JobProgressCard를 갱신한다. 서버 컴포넌트만
// 으로는 실시간 진행 표시가 어렵기 때문에 1차 구현은 이 client component가
// 담당한다(2차 개선: Supabase Realtime).
//
// completed/failed/blocked/partial_success/cancelled/waiting_user가 되면
// polling을 멈춘다(isTerminalJobStatus). running/retrying인데
// last_heartbeat_at이 2분 이상 갱신되지 않으면 "멈춤 가능성 있음"으로
// 표시한다(detectStalledJobRun) — DB status를 바로 바꾸지는 않는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { detectStalledJobRun } from "@/lib/job-progress/job-progress-types";
import { isTerminalJobStatus } from "@/lib/job-progress/job-progress-labels";
import { JobProgressCard, type JobProgressCardData } from "./job-progress-card";

const POLL_INTERVAL_MS = 2500;

interface JobRunApiResponse {
  success: boolean;
  data?: JobProgressCardData;
  error?: string;
}

export interface JobProgressPollingProps {
  jobRunId: string;
  /** 실패 시 재시도 action으로 이동할 링크(있으면 [다시 시도] 버튼이 보인다). */
  retryHref?: string;
  /** polling 간격(ms). 기본 2500ms. */
  pollIntervalMs?: number;
}

export function JobProgressPolling({ jobRunId, retryHref, pollIntervalMs = POLL_INTERVAL_MS }: JobProgressPollingProps) {
  const [jobRun, setJobRun] = useState<JobProgressCardData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-runs/${jobRunId}`, { cache: "no-store" });
      const body: JobRunApiResponse = await res.json();
      if (!res.ok || !body.success || !body.data) {
        setFetchError(body.error ?? "상태를 불러오지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setFetchError(null);
      setJobRun(body.data);
    } catch {
      setFetchError("상태를 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [jobRunId]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      await fetchOnce();
      if (cancelled) return;
      // 최신 jobRun은 setJobRun 콜백 밖에서 즉시 알 수 없으므로, ref 대신
      // 다음 tick 예약 여부는 fetchOnce 이후의 state를 다시 읽어 판단한다.
      timerRef.current = setTimeout(tick, pollIntervalMs);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // jobRunId가 바뀌면(다른 작업을 보게 되면) polling을 새로 시작한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobRunId, pollIntervalMs]);

  // 터미널 상태가 되면 예약된 다음 polling을 취소한다.
  useEffect(() => {
    if (jobRun && isTerminalJobStatus(jobRun.status) && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [jobRun]);

  if (loading && !jobRun) {
    return <p className="text-xs text-zinc-400">작업 상태를 불러오는 중...</p>;
  }

  if (!jobRun) {
    return (
      <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {fetchError ?? "상태를 불러오지 못했습니다. 다시 시도해 주세요."}
        <button type="button" onClick={() => fetchOnce()} className="ml-2 text-indigo-700 hover:underline">
          다시 시도
        </button>
      </div>
    );
  }

  const isStalled = detectStalledJobRun({ status: jobRun.status, lastHeartbeatAt: jobRun.lastHeartbeatAt });

  return (
    <div>
      <JobProgressCard jobRun={jobRun} isStalled={isStalled} onRefresh={fetchOnce} retryHref={retryHref} />
      {fetchError && (
        <p className="mt-1 text-[11px] text-red-500">
          {fetchError} <button type="button" onClick={() => fetchOnce()} className="underline">다시 시도</button>
        </p>
      )}
    </div>
  );
}
