import "./load-env";
import { describe, it, expect } from "vitest";
import { generateSelectedPlatformPosts } from "@/lib/social/multi-platform-generation-service";

describe("OPS-01 Pilot C: threads 재시도 — tone=informational로 변경(story 2연속 JSON parse 실패 원인 분리)", () => {
  it("threads 재생성(informational)", async () => {
    const summary = await generateSelectedPlatformPosts({
      articleId: "7481495e-b8d9-4c1c-bbe4-5a439189287d",
      platforms: ["threads"],
      toneMode: "manual_per_platform",
      toneStylesByPlatform: { threads: "informational" },
    });
    if ("error" in summary) throw new Error(summary.error);
    console.log(`[ops-01-pilot-c-retry] threads status=${summary.results[0].status} socialPostId=${summary.results[0].socialPostId} message=${summary.results[0].message}`);
    expect(summary.results[0].status).toBe("generated");
  });
});
