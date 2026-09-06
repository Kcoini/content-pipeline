import { describe, expect, it } from "vitest";
import {
  computeManualPostingChecklistItemStatus,
  buildManualPostingChecklistDisplay,
  summarizeManualPostingChecklistStatus,
  getChecklistHandoffMismatchNotice,
  getChecklistGuidanceMessage,
  type ManualPostingChecklistStatusInput,
} from "./manual-posting-checklist-status";

function makeInput(overrides: Partial<ManualPostingChecklistStatusInput> = {}): ManualPostingChecklistStatusInput {
  return {
    qualityStatus: "ready",
    approvalStatus: "approved",
    exportStatus: "exported",
    platformPublishGuardStatus: "ready",
    platformPublishReady: true,
    platformPublishDryRunStatus: "ready",
    handoffStatus: "completed",
    manualPostStatus: "posted",
    postUrl: null,
    manualPostUrl: "https://example.com/posted",
    ...overrides,
  };
}

describe("computeManualPostingChecklistItemStatus", () => {
  it("quality_status='ready'이면 quality_gate_ready가 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("quality_gate_ready", "pending", makeInput())).toBe("completed");
  });

  it("quality_status가 needs_revision/blocked이면 quality_gate_ready가 blocked다", () => {
    expect(
      computeManualPostingChecklistItemStatus("quality_gate_ready", "pending", makeInput({ qualityStatus: "needs_revision" }))
    ).toBe("blocked");
  });

  it("quality_status가 not_checked면 quality_gate_ready가 pending이다", () => {
    expect(
      computeManualPostingChecklistItemStatus("quality_gate_ready", "pending", makeInput({ qualityStatus: "not_checked" }))
    ).toBe("pending");
  });

  it("approval_status='approved'이면 approval_approved가 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("approval_approved", "pending", makeInput())).toBe("completed");
  });

  it("approval_status가 approved가 아니면 approval_approved가 pending이다", () => {
    expect(
      computeManualPostingChecklistItemStatus("approval_approved", "pending", makeInput({ approvalStatus: "pending_review" }))
    ).toBe("pending");
  });

  it("export_status가 ready/exported면 manual_export_ready가 completed다", () => {
    expect(
      computeManualPostingChecklistItemStatus("manual_export_ready", "pending", makeInput({ exportStatus: "ready" }))
    ).toBe("completed");
  });

  it("platform_publish_guard_status='ready'이고 platform_publish_ready=true면 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("platform_publishing_guard_ready", "pending", makeInput())).toBe(
      "completed"
    );
  });

  it("platform_publish_guard_status='blocked'면 platform_publishing_guard_ready가 blocked다", () => {
    expect(
      computeManualPostingChecklistItemStatus(
        "platform_publishing_guard_ready",
        "pending",
        makeInput({ platformPublishGuardStatus: "blocked" })
      )
    ).toBe("blocked");
  });

  it("publish_dry_run_status='ready'면 publish_dry_run_ready가 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("publish_dry_run_ready", "pending", makeInput())).toBe("completed");
  });

  it("handoff_status='completed'면 handoff_completed가 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("handoff_completed", "pending", makeInput())).toBe("completed");
  });

  it("handoff_status가 completed가 아니어도 manual_post_status='posted'면 handoff_completed가 completed다", () => {
    expect(
      computeManualPostingChecklistItemStatus(
        "handoff_completed",
        "pending",
        makeInput({ handoffStatus: "ready", manualPostStatus: "posted" })
      )
    ).toBe("completed");
  });

  it("manual_post_url이 있으면 record_url_after_posting이 completed다", () => {
    expect(computeManualPostingChecklistItemStatus("record_url_after_posting", "pending", makeInput())).toBe("completed");
  });

  it("post_url/manual_post_url이 모두 없으면 record_url_after_posting이 needs_review다", () => {
    expect(
      computeManualPostingChecklistItemStatus(
        "record_url_after_posting",
        "pending",
        makeInput({ manualPostUrl: null, postUrl: null })
      )
    ).toBe("needs_review");
  });

  it("post_url만 있어도 wordpress_copy_url이 completed다", () => {
    expect(
      computeManualPostingChecklistItemStatus(
        "wordpress_copy_url",
        "pending",
        makeInput({ manualPostUrl: null, postUrl: "https://example.com/post" })
      )
    ).toBe("completed");
  });

  it("사람이 직접 확인해야 하는 항목(예: final_content_check)은 저장된 status가 pending이면 needs_review로 표시된다", () => {
    expect(computeManualPostingChecklistItemStatus("final_content_check", "pending", makeInput())).toBe("needs_review");
  });

  it("사람이 직접 확인해야 하는 항목이 저장된 status='confirmed'면 completed로 표시된다", () => {
    expect(computeManualPostingChecklistItemStatus("final_content_check", "confirmed", makeInput())).toBe("completed");
  });

  it("wordpress_blog 전용 항목(wordpress_seo_check)도 사람이 확인해야 하는 항목으로 처리된다", () => {
    expect(computeManualPostingChecklistItemStatus("wordpress_seo_check", "pending", makeInput())).toBe("needs_review");
  });

  it("confirmations에 confirmed=true가 있으면 사람이 확인해야 하는 항목이 completed로 표시된다", () => {
    const status = computeManualPostingChecklistItemStatus("final_content_check", "pending", makeInput(), {
      final_content_check: { confirmed: true, confirmedAt: "2026-01-01T00:00:00.000Z", confirmedBy: "local-user" },
    });
    expect(status).toBe("completed");
  });

  it("confirmations이 있어도 시스템 자동 계산 항목(quality_gate_ready)의 실제 상태를 덮어쓰지 않는다", () => {
    const status = computeManualPostingChecklistItemStatus(
      "quality_gate_ready",
      "pending",
      makeInput({ qualityStatus: "not_checked" }),
      { quality_gate_ready: { confirmed: true } }
    );
    expect(status).toBe("pending");
  });

  it("confirmations이 있어도 URL 기반 항목의 실제 상태를 덮어쓰지 않는다", () => {
    const status = computeManualPostingChecklistItemStatus(
      "record_url_after_posting",
      "pending",
      makeInput({ manualPostUrl: null, postUrl: null }),
      { record_url_after_posting: { confirmed: true } }
    );
    expect(status).toBe("needs_review");
  });
});

describe("buildManualPostingChecklistDisplay / summarizeManualPostingChecklistStatus", () => {
  const checklist = [
    { key: "quality_gate_ready", label: "Quality Gate ready 확인", status: "pending" },
    { key: "approval_approved", label: "Approval approved 확인", status: "pending" },
    { key: "manual_export_ready", label: "Manual Export ready/exported 확인", status: "pending" },
    { key: "platform_publishing_guard_ready", label: "Platform Publishing Guard ready 확인", status: "pending" },
    { key: "publish_dry_run_ready", label: "Publish Dry-run ready 확인", status: "pending" },
    { key: "handoff_completed", label: "Handoff completed 확인", status: "pending" },
    { key: "final_content_check", label: "최종 내용 확인", status: "pending" },
    { key: "image_link_check", label: "이미지/링크 확인", status: "pending" },
    { key: "policy_violation_check", label: "플랫폼 정책 위반 가능성 확인", status: "pending" },
    { key: "record_url_after_posting", label: "게시 후 URL 기록 필요", status: "pending" },
    { key: "wordpress_workflow_duplicate_check", label: "WordPress 자동 게시 workflow와 중복 여부 확인", status: "pending" },
    { key: "wordpress_title_body_image_check", label: "제목/본문/대표 이미지 확인", status: "pending" },
    { key: "wordpress_seo_check", label: "SEO title/meta description 확인", status: "pending" },
    { key: "wordpress_visibility_check", label: "공개 상태 확인", status: "pending" },
    { key: "wordpress_copy_url", label: "게시 URL 복사", status: "pending" },
  ];

  it("handoff_status가 completed면 Handoff completed 확인 항목은 completed로 표시된다(대기중 아님)", () => {
    const display = buildManualPostingChecklistDisplay(checklist, makeInput());
    const handoffItem = display.find((i) => i.key === "handoff_completed");
    expect(handoffItem?.status).toBe("completed");
  });

  it("handoff_status가 completed여도 모든 항목이 pending으로 표시되지 않는다 (자동 계산 항목은 completed로 바뀐다)", () => {
    const display = buildManualPostingChecklistDisplay(checklist, makeInput());
    const pendingCount = display.filter((i) => i.status === "pending").length;
    expect(pendingCount).toBe(0);
    const completedCount = display.filter((i) => i.status === "completed").length;
    expect(completedCount).toBeGreaterThan(0);
  });

  it("15개 항목 전체에 대해 완료/확인 필요 개수를 요약한다", () => {
    const display = buildManualPostingChecklistDisplay(checklist, makeInput());
    const summary = summarizeManualPostingChecklistStatus(display);
    expect(summary.completed + summary.needsReview + summary.pending + summary.blocked + summary.failed + summary.skipped).toBe(
      checklist.length
    );
    expect(summary.completed).toBeGreaterThan(0);
    expect(summary.needsReview).toBeGreaterThan(0);
  });
});

describe("getChecklistHandoffMismatchNotice", () => {
  it("handoff가 completed가 아니면 안내 문구가 없다", () => {
    const summary = { completed: 0, needsReview: 5, pending: 5, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistHandoffMismatchNotice("ready", summary)).toBeNull();
  });

  it("handoff가 completed이고 확인 필요/대기중 항목이 없으면 안내 문구가 없다", () => {
    const summary = { completed: 15, needsReview: 0, pending: 0, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistHandoffMismatchNotice("completed", summary)).toBeNull();
  });

  it("handoff가 completed인데 확인 필요 항목이 남아 있으면 안내 문구를 반환한다", () => {
    const summary = { completed: 8, needsReview: 7, pending: 0, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistHandoffMismatchNotice("completed", summary)).toBe("일부 체크리스트 항목은 확인 필요 상태입니다.");
  });
});

describe("getChecklistGuidanceMessage", () => {
  it("모든 항목이 완료면 안내 문구가 없다", () => {
    const summary = { completed: 15, needsReview: 0, pending: 0, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistGuidanceMessage(summary)).toBeNull();
  });

  it("시스템 항목은 모두 완료됐고 확인 필요 항목만 남았으면 안심 문구를 반환한다", () => {
    const summary = { completed: 8, needsReview: 7, pending: 0, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistGuidanceMessage(summary)).toBe(
      "게시 준비는 완료되었습니다. 남은 항목은 사람이 직접 확인해야 하는 최종 점검입니다."
    );
  });

  it("시스템 항목이 아직 안 끝났고 확인 필요 항목도 있으면 일반 안내 문구를 반환한다", () => {
    const summary = { completed: 5, needsReview: 5, pending: 5, blocked: 0, failed: 0, skipped: 0 };
    expect(getChecklistGuidanceMessage(summary)).toBe(
      "확인 필요 항목이 남아 있습니다. WordPress 관리자 화면에서 수동 확인 후 완료 표시를 하세요."
    );
  });
});
