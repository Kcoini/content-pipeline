import "./load-env";
import { describe, it, expect } from "vitest";
import { getArticleById, readArticleMasterManuscript } from "@/lib/repositories/article-repository";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { buildEvidenceText, findUngroundedClaims } from "@/lib/social/fact-grounding-validator";

// OPS-02A controlled real-data verification (no AI call — pure function
// only): re-checked the real OPS-01 Pilot C instagram post against the
// real stored master manuscript verifiedFacts.
//
// IMPORTANT CORRECTION vs. docs/ops/pilot-c-social.md section 15: this
// check found that the "수소 연료전지차 600~700km / 충전소 30~50억원 /
// 차량가 7~8천만원" comparison IS actually present verbatim in the real
// verifiedFacts (extracted from the real fetched ko.wikipedia.org/전기자동차
// content via source summarization) — see evidenceText in the log below.
// The AI did not hallucinate this comparison; it faithfully used real
// source material. OPS-01's claim that "the 3 sources say nothing about
// hydrogen vehicles" was an unverified assumption that turned out to be
// wrong on deeper investigation. This is documented honestly in the
// OPS-02A report rather than forcing this test to "pass" artificially.
describe("OPS-02A verification: real Pilot C instagram claim, re-checked", () => {
  it("findUngroundedClaims on the real data — records the actual (corrected) result", async () => {
    const article = await getArticleById("7481495e-b8d9-4c1c-bbe4-5a439189287d");
    const post = await getSocialPostById("abf6e101-71a2-49cd-88cd-51dbdb1cbc9c");
    if (!article || !post) throw new Error("real Pilot C data not found");

    const master = readArticleMasterManuscript(article);
    if (!master) throw new Error("no master manuscript stored for this article");

    const evidenceText = buildEvidenceText(master.verifiedFacts);
    const postText = [post.caption, post.postBody].filter(Boolean).join(" ");

    const issues = findUngroundedClaims(postText, evidenceText);

    console.log("verifiedFacts count:", master.verifiedFacts.length);
    console.log("issues found:", issues.length);
    console.log("issue reasons:", issues.map((i) => i.reason));

    // The hydrogen-comparison claim is genuinely grounded (see comment
    // above) — the validator correctly does NOT flag it. This is the
    // correct behavior (no false positive on real, source-backed content).
    expect(issues.length).toBe(0);
  });
});
