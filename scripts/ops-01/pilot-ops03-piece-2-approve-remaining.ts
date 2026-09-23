// OPS-03 Piece 2 이어서: 운영자(코디네이터)가 naver_cafe/threads/instagram의
// fact_grounding "확인 필요" 항목을 실제로 읽고 판단한 뒤(TP/FP 평가
// 완료 — 별도 investigate 스크립트로 이미 수행함), 심각한 차단 사유가
// 아니라고 판단해 개별 승인한다. 새 사실을 만들어내지 않고, 승인은
// 사람의 명시적 판단으로 수행한다(운영자 역할).
import "./load-env";

import { describe, it, expect } from "vitest";
import { approveSocialPost } from "@/lib/social/social-post-approval-service";

const APPROVED_BY = "ops-03-piece-2-operator-review";
const IDS: Record<string, string> = {
  naver_cafe: "dd84f5f5-b8dd-4c15-a4c2-cc75ef726516",
  threads: "cb531e84-3a93-4be0-a7de-4514d776e5ee",
  instagram: "8c8a58b0-d7c0-43a8-916d-b092cd09c3ae",
};

describe("OPS-03 Piece 2: 운영자 검토 후 개별 승인(naver_cafe/threads/instagram)", () => {
  it("fact_grounding 확인 필요 항목을 사람이 검토한 뒤(TP/FP 판단 완료) 개별 승인한다", async () => {
    for (const [platform, id] of Object.entries(IDS)) {
      const result = await approveSocialPost(id, APPROVED_BY, "운영자 검토: fact_grounding 확인 필요 항목 확인 완료, 차단 사유 아님으로 판단");
      console.log(`[ops-03-piece-2-approve] ${platform} approve success=${result.success} message=${result.message}`);
      expect(result.success).toBe(true);
    }
  });
});
