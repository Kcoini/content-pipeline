import { describe, expect, it } from "vitest";
import { describeStatusValue, describeStatusField, STATUS_FIELD_LABELS } from "./status-labels";

describe("describeStatusValue (Phase 3-24)", () => {
  it("자주 쓰이는 '아직 ~ 전' 계열 값을 한국어로 바꾼다", () => {
    expect(describeStatusValue("not_requested")).toBe("요청 전");
    expect(describeStatusValue("not_started")).toBe("아직 시작 전");
    expect(describeStatusValue("not_created")).toBe("아직 생성 전");
    expect(describeStatusValue("not_recorded")).toBe("아직 기록 없음");
  });

  it("결과 상태값을 한국어로 바꾼다", () => {
    expect(describeStatusValue("approved")).toBe("승인 완료");
    expect(describeStatusValue("rejected")).toBe("반려");
    expect(describeStatusValue("blocked")).toBe("차단됨");
    expect(describeStatusValue("ready")).toBe("준비 완료");
  });

  it("rewrite 재게시 워크플로 세부 단계를 한국어로 바꾼다", () => {
    expect(describeStatusValue("ready_for_reapproval")).toBe("재승인 요청 가능");
    expect(describeStatusValue("reapproval_pending")).toBe("재승인 검토 중");
    expect(describeStatusValue("handoff_completed")).toBe("수동 게시 준비 확인 완료");
  });

  it("알 수 없는 값이면 원본을 그대로 반환한다(예외를 던지지 않는다)", () => {
    expect(describeStatusValue("unknown_future_value")).toBe("unknown_future_value");
  });

  it("null/undefined/빈 문자열이면 '알 수 없음'을 반환한다", () => {
    expect(describeStatusValue(null)).toBe("알 수 없음");
    expect(describeStatusValue(undefined)).toBe("알 수 없음");
    expect(describeStatusValue("")).toBe("알 수 없음");
  });
});

describe("describeStatusField (Phase 3-24)", () => {
  it("camelCase/snake_case 필드명을 모두 같은 한국어 라벨로 바꾼다", () => {
    expect(describeStatusField("quality_status")).toBe("품질검사");
    expect(describeStatusField("qualityStatus")).toBe("품질검사");
    expect(describeStatusField("is_rewrite_version")).toBe("재작성 버전 여부");
    expect(describeStatusField("isRewriteVersion")).toBe("재작성 버전 여부");
    expect(describeStatusField("parent_social_post_id")).toBe("이전 버전 글");
    expect(describeStatusField("root_social_post_id")).toBe("원본 글");
  });

  it("알 수 없는 필드명이면 원본을 그대로 반환한다", () => {
    expect(describeStatusField("some_future_field")).toBe("some_future_field");
  });

  it("STATUS_FIELD_LABELS에는 이번 작업에서 문제로 지적된 모든 필드가 포함된다", () => {
    const requiredKeys = [
      "suggestion_status",
      "application_status",
      "rewrite_reapproval_status",
      "rewrite_reexport_status",
      "rewrite_republish_workflow_status",
      "version_comparison_status",
      "is_rewrite_version",
      "version_number",
      "parent_social_post_id",
      "root_social_post_id",
      "post_title",
      "excerpt",
      "hashtags",
      "post_url",
      "quality_score",
      "latest_performance_score",
      "latest_metrics_recorded_at",
      "rewrite_suggestion_status",
      "recommended_for_repost",
      "rewrite_performance_comparison_status",
      "content_group",
      "content_type",
      "created_at",
      "updated_at",
    ];
    for (const key of requiredKeys) {
      expect(STATUS_FIELD_LABELS[key]).toBeTruthy();
    }
  });
});
