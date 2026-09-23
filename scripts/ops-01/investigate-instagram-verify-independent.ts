import "./load-env";
import { describe, it } from "vitest";
import { getArticleById } from "@/lib/repositories/article-repository";
import { readArticleMasterManuscript } from "@/lib/repositories/article-repository";

// OPS-02A coordinator independent verification: confirm fork's claim that
// the hydrogen-fuel-cell comparison in the real Pilot C instagram post is
// actually present in verifiedFacts (not hallucinated). Read-only, no AI.
describe("Coordinator independent check: real verifiedFacts content", () => {
  it("prints verifiedFacts entries mentioning hydrogen/수소", async () => {
    const article = await getArticleById("7481495e-b8d9-4c1c-bbe4-5a439189287d");
    if (!article) throw new Error("article not found");
    const manuscript = readArticleMasterManuscript(article);
    if (!manuscript) throw new Error("no master manuscript");

    const hydrogenFacts = manuscript.verifiedFacts.filter((f) => f.fact.includes("수소"));
    console.log("total verifiedFacts:", manuscript.verifiedFacts.length);
    console.log("hydrogen-related facts count:", hydrogenFacts.length);
    for (const f of hydrogenFacts) {
      console.log("- fact:", f.fact, "| sourceIds:", f.sourceIds, "| confidence:", f.confidence);
    }
  });
});
