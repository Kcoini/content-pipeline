"use server";

// Phase 3-22: Automation Safety Review — 페이지 새로고침용 서버 액션.
// 점검 결과는 저장되지 않으며(migration 없음), 이 페이지는 매 로드마다
// runAutomationSafetyReview()를 실행해 최신 상태를 계산한다. 아래 액션은
// "다시 점검" 버튼이 페이지를 재검증(새로고침)하도록 하기 위한 것일 뿐,
// 어떤 데이터도 변경하지 않는다. 실제 게시를 실행하는 액션은 없다.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const PAGE_PATH = "/dashboard/automation-safety";

/** 페이지 데이터를 재검증하고 같은 페이지로 되돌아간다. 데이터를 변경하지 않는다. */
export async function rerunAutomationSafetyReview(): Promise<void> {
  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH);
}
