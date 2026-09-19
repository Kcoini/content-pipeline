// Phase UX-05A: UX-04B의 MultiPlatformReviewSummary와 같은 패턴으로,
// 여러 platform post의 PublishPreparationViewModel을 집계한다. 새
// publish 판단 로직을 만들지 않는다 — 각 post의 PublishPreparationViewModel
// (이미 계산됨)을 state별로 세기만 한다.

import type { PublishPreparationState, PublishPreparationViewModel } from "./publish-preparation-view-model";

export interface MultiPlatformPublishPreparationSummary {
  total: number;
  notApproved: number;
  needsAttention: number;
  needsSetup: number;
  ready: number;
  inProgress: number;
  completed: number;
  failed: number;
  postIdsByState: Record<PublishPreparationState, string[]>;
}

export interface MultiPlatformPublishPreparationPostInput {
  id: string;
  viewModel: PublishPreparationViewModel;
}

export function summarizeMultiPlatformPublishPreparation(
  posts: readonly MultiPlatformPublishPreparationPostInput[]
): MultiPlatformPublishPreparationSummary {
  const postIdsByState: Record<PublishPreparationState, string[]> = {
    not_approved: [],
    needs_attention: [],
    needs_setup: [],
    ready: [],
    in_progress: [],
    completed: [],
    failed: [],
  };

  for (const post of posts) {
    postIdsByState[post.viewModel.state].push(post.id);
  }

  return {
    total: posts.length,
    notApproved: postIdsByState.not_approved.length,
    needsAttention: postIdsByState.needs_attention.length,
    needsSetup: postIdsByState.needs_setup.length,
    ready: postIdsByState.ready.length,
    inProgress: postIdsByState.in_progress.length,
    completed: postIdsByState.completed.length,
    failed: postIdsByState.failed.length,
    postIdsByState,
  };
}

const STATE_SORT_PRIORITY: Record<PublishPreparationState, number> = {
  failed: 0,
  needs_attention: 1,
  needs_setup: 2,
  not_approved: 3,
  ready: 4,
  in_progress: 5,
  completed: 6,
};

/** 사용자가 먼저 해결해야 하는 항목이 위로 오도록 하는 정렬 키. */
export function getPublishPreparationSortKey(post: MultiPlatformPublishPreparationPostInput): number {
  return STATE_SORT_PRIORITY[post.viewModel.state];
}
