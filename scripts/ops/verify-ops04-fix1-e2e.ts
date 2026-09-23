import "./load-env";
import { describe, it, expect } from "vitest";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { buildMasterManuscript } from "@/lib/articles/master-manuscript-builder";

// OPS-04-FIX1 섹션 23/28: 실제 OPS-03에서 확인된 TP(article
// 38406eb3-...의 "미국수면의학회(AASM)는 2021년 메타분석을 통해..."
// — 3개 실제 출처 어디에도 없는 기관+연도 귀속, 운영자가 직접 읽고
// 확인한 진짜 hallucination)를 사용해 end-to-end 재현한다. read-only
// (DB mutation 없음, 새 WordPress Draft/외부 게시 없음) —
// buildMasterManuscript는 순수 함수라 실행 자체가 부작용이 없다.
//
// 실행: npx vitest run --config vitest.ops.config.ts scripts/ops/verify-ops04-fix1-e2e.ts
const KNOWN_HALLUCINATED_ARTICLE_ID = "38406eb3-086e-4bb4-acf5-8a85d3fdac82";
const KNOWN_HALLUCINATED_ENTITY = "미국수면의학회";

describe("OPS-04-FIX1 end-to-end 재현(AASM 확인된 TP)", () => {
  it("AASM 허위 귀속 fact가 verifiedFacts에 없고 verificationNeeded/rejectedFacts에는 있다", async () => {
    const article = await getArticleById(KNOWN_HALLUCINATED_ARTICLE_ID);
    const sources = await getSourcesByArticleId(KNOWN_HALLUCINATED_ARTICLE_ID);
    const master = buildMasterManuscript(article!, sources);

    const inVerified = master.verifiedFacts.some((f) => f.fact.includes(KNOWN_HALLUCINATED_ENTITY));
    const inVerificationNeeded = master.verificationNeeded.some((v) => v.includes(KNOWN_HALLUCINATED_ENTITY));
    const inRejected = (master.rejectedFacts ?? []).some((r) => r.fact.includes(KNOWN_HALLUCINATED_ENTITY));
    console.log(`inVerified=${inVerified} inVerificationNeeded=${inVerificationNeeded} inRejected=${inRejected}`);

    expect(inVerified).toBe(false);
    expect(inVerificationNeeded).toBe(true);
    expect(inRejected).toBe(true);

    // downstream: platformBriefs/optimizationSupport는 verifiedFacts에서만
    // 파생되므로 오염된 fact가 전파되지 않아야 한다(섹션 15 — cascade 방지).
    const inWordpressBrief = master.platformBriefs.wordpressBlog.tableCandidates.some((t) => t.includes(KNOWN_HALLUCINATED_ENTITY));
    const inGeoKeyFacts = master.optimizationSupport.geoSupport.keyFacts.some((f) => f.includes(KNOWN_HALLUCINATED_ENTITY));
    console.log(`inWordpressBrief=${inWordpressBrief} inGeoKeyFacts=${inGeoKeyFacts}`);
    expect(inWordpressBrief).toBe(false);
    expect(inGeoKeyFacts).toBe(false);
  }, 30_000);
});
