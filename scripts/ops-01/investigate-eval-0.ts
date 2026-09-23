import "./load-env";
import { describe, it } from "vitest";
import { getLatestEvalByArticleId } from "@/lib/repositories/eval-repository";

describe("OPS-02A investigation: Pilot A eval aggregateScore=0 root cause", () => {
  it("inspect real eval_runs row (read-only, no AI call)", async () => {
    const run = await getLatestEvalByArticleId("3b94f78b-680b-46e0-b9c7-a0033a287f2d");
    console.log("eval run found:", Boolean(run));
    if (run) {
      console.log("aggregateScore:", run.aggregateScore);
      console.log("passed:", run.passed);
      console.log("notes:", run.notes);
      console.log("criteriaScores keys:", Object.keys(run.criteriaScores ?? {}));
      console.log("criteriaScores sample:", JSON.stringify(run.criteriaScores).slice(0, 800));
    }
  });
});
