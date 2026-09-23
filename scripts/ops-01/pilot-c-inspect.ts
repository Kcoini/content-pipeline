import "./load-env";
import { describe, it, expect } from "vitest";
import { getSocialPostById } from "@/lib/repositories/social-posts-repository";
import { summarizeAutoReview, summarizeUserFacingReview } from "@/lib/social/social-post-auto-review";

const IDS: Record<string, string> = {
  x: "b77fc804-967d-456f-a212-ceddf1fea6c7",
  threads: "0dbee46c-2ac7-4bb6-87e9-960aac1880ba",
  instagram: "abf6e101-71a2-49cd-88cd-51dbdb1cbc9c",
};

describe("inspect", () => {
  it("dump content lengths + issues (no full body/secrets)", async () => {
    for (const [platform, id] of Object.entries(IDS)) {
      const post = await getSocialPostById(id);
      const checklist = Array.isArray(post!.qualitySummary?.checklist) ? (post!.qualitySummary.checklist as never[]) : [];
      const review = summarizeAutoReview(checklist);
      const userFacing = summarizeUserFacingReview(post!.qualityStatus, review, checklist);
      console.log(
        JSON.stringify({
          platform,
          qualityStatus: post!.qualityStatus,
          approvalStatus: post!.approvalStatus,
          postBodyLength: post!.postBody?.length ?? 0,
          captionLength: post!.caption?.length ?? 0,
          threadItemCount: post!.threadItems.length,
          threadItemLengths: post!.threadItems.map((t) => t.text.length),
          hashtagCount: post!.hashtags.length,
          hashtags: post!.hashtags,
          cardItemCount: post!.cardItems.length,
          visibleIssues: userFacing.visibleIssues.map((i) => ({ key: i.key, axis: i.axisLabel, msg: i.message, severity: i.severity })),
        })
      );
    }
    expect(true).toBe(true);
  });

  it("dump x thread items text (public info article content, safe to inspect for quality)", async () => {
    const post = await getSocialPostById(IDS.x);
    post!.threadItems.forEach((t) => console.log(`[x-thread-item ${t.order}] (${t.text.length}자) ${t.text}`));
    expect(true).toBe(true);
  });

  it("dump instagram caption + hashtags", async () => {
    const post = await getSocialPostById(IDS.instagram);
    console.log(`[instagram-caption] (${post!.caption?.length ?? 0}자) ${post!.caption}`);
    console.log(`[instagram-hashtags] ${post!.hashtags.join(", ")}`);
    expect(true).toBe(true);
  });

  it("dump threads body", async () => {
    const post = await getSocialPostById(IDS.threads);
    console.log(`[threads-body] (${post!.postBody?.length ?? 0}자) ${post!.postBody}`);
    expect(true).toBe(true);
  });
});
