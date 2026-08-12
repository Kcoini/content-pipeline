import { describe, expect, it } from "vitest";
import { runSocialPostQualityGate } from "./social-quality-gate";

describe("runSocialPostQualityGate", () => {
  it("빈 글은 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "",
      hashtags: [],
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "content_present");
    expect(item?.status).toBe("blocked");
  });

  it("광고 클릭 유도 문구는 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "threads",
      toneStyle: "persuasive",
      postBody: "지금 바로 광고 클릭 하시고 혜택 받아가세요.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_ad_click_bait");
    expect(item?.status).toBe("blocked");
  });

  it("허위 수익 보장 표현은 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "persuasive",
      threadItems: [{ order: 1, text: "이 상품은 수익 보장이 확실합니다." }],
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_income_guarantee");
    expect(item?.status).toBe("blocked");
  });

  it("warning 문체에서도 협박 표현은 허용하지 않는다 (blocked)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "warning",
      postTitle: "주의하세요",
      postBody: "지금 확인하지 않으면 당장 하지 않으면 큰 문제가 생깁니다.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_threat_language");
    expect(item?.status).toBe("blocked");
  });

  it("loss_aversion 문체에서도 협박 표현은 허용하지 않는다 (blocked)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "loss_aversion",
      postTitle: "모르면 손해",
      postBody: "가만두지 않겠다는 심정으로 준비하지 않으면 손해를 봅니다.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_threat_language");
    expect(item?.status).toBe("blocked");
  });

  it("invalid platform이면 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "facebook",
      toneStyle: "informational",
      postBody: "본문",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "platform_valid");
    expect(item?.status).toBe("blocked");
  });

  it("invalid tone_style이면 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "threat",
      postBody: "본문",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "tone_style_valid");
    expect(item?.status).toBe("blocked");
  });

  it("정상적인 글은 ready 또는 needs_revision으로 처리된다 (blocked 아님)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "장기요양보험 신청 방법 총정리",
      postBody: "장기요양보험 신청 절차와 필요한 서류, 등급 판정 기준을 정리했습니다. ".repeat(20),
      hashtags: ["장기요양보험", "신청방법"],
    });

    expect(result.status).not.toBe("blocked");
  });

  it("x 플랫폼에서 thread_items가 없으면 required_fields_present가 warning이다", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "curiosity",
      postBody: "본문만 있고 thread_items는 없음",
    });

    const item = result.checklist.find((c) => c.key === "required_fields_present");
    expect(item?.status).toBe("warning");
  });
});
