import "./load-env";
import { describe, it, expect } from "vitest";
import { getSourcesByArticleId } from "@/lib/repositories/source-repository";
import { getArticleById } from "@/lib/repositories/article-repository";
import { evaluateSourceKeyPoints, type GroupedFactIntegrity } from "@/lib/sources/source-evidence-integrity-validator";

// OPS-04-FIX1(섹션 20): 이미 DB에 저장된 과거 article의 verifiedFacts
// candidate(keyPoints)를 raw source content와 다시 대조하는 read-only
// 감사(audit) helper. DB를 변경하지 않는다(자동 rewrite/migration 금지
// — 섹션 19). full raw source/본문은 출력하지 않는다 — 요약(개수/상태)만
// 출력한다.
//
// 실행:
//   AUDIT_ARTICLE_ID=<article-id> npm run ops:audit-source-evidence

export interface SourceEvidenceAuditResult {
  articleId: string;
  articleTitle: string;
  candidateFactCount: number;
  supported: GroupedFactIntegrity[];
  needsReview: GroupedFactIntegrity[];
  unsupported: GroupedFactIntegrity[];
  conflicting: GroupedFactIntegrity[];
}

export async function auditSourceEvidenceForArticle(articleId: string): Promise<SourceEvidenceAuditResult> {
  const article = await getArticleById(articleId);
  if (!article) {
    throw new Error(`article을 찾을 수 없습니다: ${articleId}`);
  }
  const sources = await getSourcesByArticleId(articleId);
  const graded = evaluateSourceKeyPoints(sources);

  return {
    articleId,
    articleTitle: article.title,
    candidateFactCount: graded.length,
    supported: graded.filter((g) => g.status === "supported"),
    needsReview: graded.filter((g) => g.status === "needs_review"),
    unsupported: graded.filter((g) => g.status === "unsupported"),
    conflicting: graded.filter((g) => g.status === "conflicting"),
  };
}

function printSummary(result: SourceEvidenceAuditResult): void {
  console.log(`\nSource Evidence Audit — article ${result.articleId}`);
  console.log(`title: ${result.articleTitle}`);
  console.log(`candidate fact 총 ${result.candidateFactCount}건`);
  console.log(`  supported:     ${result.supported.length}건`);
  console.log(`  needs_review:  ${result.needsReview.length}건`);
  console.log(`  unsupported:   ${result.unsupported.length}건`);
  console.log(`  conflicting:   ${result.conflicting.length}건`);

  for (const group of [
    { label: "needs_review", items: result.needsReview },
    { label: "unsupported", items: result.unsupported },
  ]) {
    if (group.items.length === 0) continue;
    console.log(`\n[${group.label}] 상세(이유만 — 원문은 출력하지 않음):`);
    for (const item of group.items) {
      console.log(`  - reason: ${item.reason} (sourceIds: ${item.sourceIds.join(",")})`);
    }
  }
  console.log("");
}

// npm run ops:audit-source-evidence로 실행하는 read-only CLI. DB
// mutation 없음 — 실제 Supabase를 읽기 전용으로 조회한다.
describe("ops:audit-source-evidence", () => {
  it("지정된 article의 source evidence integrity를 read-only로 감사한다", async () => {
    const articleId = process.env.AUDIT_ARTICLE_ID;
    if (!articleId) {
      console.log("AUDIT_ARTICLE_ID 환경변수가 없어 감사를 건너뜁니다. 예: AUDIT_ARTICLE_ID=<id> npm run ops:audit-source-evidence");
      expect(true).toBe(true);
      return;
    }

    const result = await auditSourceEvidenceForArticle(articleId);
    printSummary(result);

    expect(result.candidateFactCount).toBe(
      result.supported.length + result.needsReview.length + result.unsupported.length + result.conflicting.length
    );
  }, 30_000);
});
