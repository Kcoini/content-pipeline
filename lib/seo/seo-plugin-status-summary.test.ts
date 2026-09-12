import { describe, expect, it } from "vitest";
import { summarizeSeoPluginWriteStatus, type SeoWriteSummaryInput } from "./seo-plugin-status-summary";

function baseInput(overrides: Partial<SeoWriteSummaryInput> = {}): SeoWriteSummaryInput {
  return {
    seoTitle: "제목",
    metaDescription: "설명",
    targetKeyword: "키워드",
    hasWordPressDraft: true,
    actualWriteStatus: "not_attempted",
    actualWriteVerified: false,
    actualWriteError: null,
    customEndpointStatus: "not_attempted",
    customEndpointVerified: false,
    customEndpointError: null,
    ...overrides,
  };
}

describe("summarizeSeoPluginWriteStatus", () => {
  it("SEO 제목/설명/키워드 중 하나라도 없으면 not_ready다", () => {
    const result = summarizeSeoPluginWriteStatus(baseInput({ seoTitle: null }));
    expect(result.status).toBe("not_ready");
    expect(result.primaryAction).toBe("generate_seo");
    expect(result.seoTitleReady).toBe(false);
  });

  it("모두 준비되고 아직 반영 시도 전이면 ready_to_write다", () => {
    const result = summarizeSeoPluginWriteStatus(baseInput());
    expect(result.status).toBe("ready_to_write");
    expect(result.primaryAction).toBe("write_seo");
    expect(result.primaryActionDisabledReason).toBeNull();
  });

  it("WordPress draft가 없으면 ready_to_write여도 반영 버튼이 비활성 사유를 갖는다", () => {
    const result = summarizeSeoPluginWriteStatus(baseInput({ hasWordPressDraft: false }));
    expect(result.status).toBe("ready_to_write");
    expect(result.primaryActionDisabledReason).toContain("WordPress Draft");
  });

  it("반영 시도했지만 아직 verified가 아니면 written_unconfirmed다", () => {
    const result = summarizeSeoPluginWriteStatus(baseInput({ actualWriteStatus: "success", actualWriteVerified: false }));
    expect(result.status).toBe("written_unconfirmed");
    expect(result.primaryAction).toBe("check_status");
  });

  it("actualWrite 또는 customEndpoint 중 하나라도 verified면 confirmed다", () => {
    const viaActual = summarizeSeoPluginWriteStatus(baseInput({ actualWriteVerified: true }));
    expect(viaActual.status).toBe("confirmed");
    expect(viaActual.seoAppliedToWordPress).toBe(true);

    const viaCustom = summarizeSeoPluginWriteStatus(baseInput({ customEndpointVerified: true }));
    expect(viaCustom.status).toBe("confirmed");
  });

  it("실패 상태면 error이고 재시도 액션을 안내한다", () => {
    const result = summarizeSeoPluginWriteStatus(
      baseInput({ actualWriteStatus: "failed", actualWriteError: "네트워크 오류" })
    );
    expect(result.status).toBe("error");
    expect(result.primaryAction).toBe("retry");
    expect(result.errorMessage).toBe("네트워크 오류");
  });

  it("confirmed가 error보다 우선하지 않는다(실패가 있으면 항상 error)", () => {
    const result = summarizeSeoPluginWriteStatus(
      baseInput({ customEndpointStatus: "failed", customEndpointError: "실패", actualWriteVerified: false })
    );
    expect(result.status).toBe("error");
  });
});
