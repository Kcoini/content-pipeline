// Phase 4-17: Job Progress System — JobProgressPolling(client component)이
// 2~3초마다 이 route를 호출해 job_run/job_run_steps의 최신 상태를 읽는다.
// 서버 컴포넌트만으로는 실시간 진행 표시가 어렵기 때문에 1차 구현은 이
// route를 통한 polling 방식을 쓴다(2차 개선: Supabase Realtime).
//
// 이 응답에는 raw job_type/status와 error_message가 포함된다 — 화면에는
// job-progress-labels.ts로 변환한 라벨을 보여주고, raw 값은 항상 "상세
// 상태 보기" 접힘 영역 안에서만 노출한다(이 route 자체가 사용자 화면은
// 아니다). API key/auth token/Authorization header/Application Password/
// full body/full prompt/full AI response는 job_runs/job_run_steps
// 테이블 자체에 저장하지 않으므로 이 응답에도 포함되지 않는다.

import { NextResponse } from "next/server";
import { getJobRunWithSteps } from "@/lib/job-progress/job-progress-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ success: false, error: "job run id가 필요합니다." }, { status: 400 });
  }

  try {
    const jobRun = await getJobRunWithSteps(id);
    if (!jobRun) {
      return NextResponse.json({ success: false, error: "작업 실행 기록을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: jobRun });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "작업 상태를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
