import { describe, expect, it } from "vitest";
import {
  summarizeMultiPlatformPublishPreparation,
  getPublishPreparationSortKey,
  type MultiPlatformPublishPreparationPostInput,
} from "./multi-platform-publish-preparation-summary";
import type { PublishPreparationState, PublishPreparationViewModel } from "./publish-preparation-view-model";

function makePost(id: string, state: PublishPreparationState): MultiPlatformPublishPreparationPostInput {
  const viewModel: PublishPreparationViewModel = { platform: "x", state, title: state };
  return { id, viewModel };
}

describe("summarizeMultiPlatformPublishPreparation (Phase UX-05A)", () => {
  it("total을 정확히 집계한다", () => {
    const posts = [makePost("a", "ready"), makePost("b", "completed")];
    expect(summarizeMultiPlatformPublishPreparation(posts).total).toBe(2);
  });

  it("notApproved를 정확히 집계한다", () => {
    const posts = [makePost("a", "not_approved"), makePost("b", "ready")];
    const summary = summarizeMultiPlatformPublishPreparation(posts);
    expect(summary.notApproved).toBe(1);
    expect(summary.postIdsByState.not_approved).toEqual(["a"]);
  });

  it("needsAttention을 정확히 집계한다", () => {
    const posts = [makePost("a", "needs_attention")];
    expect(summarizeMultiPlatformPublishPreparation(posts).needsAttention).toBe(1);
  });

  it("needsSetup을 정확히 집계한다", () => {
    const posts = [makePost("a", "needs_setup")];
    expect(summarizeMultiPlatformPublishPreparation(posts).needsSetup).toBe(1);
  });

  it("ready를 정확히 집계한다", () => {
    const posts = [makePost("a", "ready"), makePost("b", "ready")];
    expect(summarizeMultiPlatformPublishPreparation(posts).ready).toBe(2);
  });

  it("inProgress를 정확히 집계한다", () => {
    const posts = [makePost("a", "in_progress")];
    expect(summarizeMultiPlatformPublishPreparation(posts).inProgress).toBe(1);
  });

  it("completed를 정확히 집계한다", () => {
    const posts = [makePost("a", "completed"), makePost("b", "completed"), makePost("c", "ready")];
    expect(summarizeMultiPlatformPublishPreparation(posts).completed).toBe(2);
  });

  it("failed를 정확히 집계한다", () => {
    const posts = [makePost("a", "failed")];
    expect(summarizeMultiPlatformPublishPreparation(posts).failed).toBe(1);
  });

  it("같은 post가 두 state에 중복 집계되지 않는다", () => {
    const posts = [makePost("a", "failed")];
    const summary = summarizeMultiPlatformPublishPreparation(posts);
    const sum =
      summary.notApproved + summary.needsAttention + summary.needsSetup + summary.ready + summary.inProgress + summary.completed + summary.failed;
    expect(sum).toBe(1);
  });
});

describe("getPublishPreparationSortKey (Phase UX-05A)", () => {
  it("failed > needsAttention > needsSetup > notApproved > ready > inProgress > completed 순으로 정렬 키가 커진다", () => {
    const order: PublishPreparationState[] = ["failed", "needs_attention", "needs_setup", "not_approved", "ready", "in_progress", "completed"];
    const keys = order.map((state) => getPublishPreparationSortKey(makePost("x", state)));
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(new Set(keys).size).toBe(7);
  });
});
