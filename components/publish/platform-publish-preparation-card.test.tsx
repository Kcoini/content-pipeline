import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformPublishPreparationCard } from "./platform-publish-preparation-card";
import type { PublishPreparationViewModel } from "@/lib/ui/publish-preparation-view-model";

describe("PlatformPublishPreparationCard (Phase UX-05A)", () => {
  it("platformLabel/title/message를 보여주고 primaryAction을 renderAction으로 위임한다", () => {
    const viewModel: PublishPreparationViewModel = {
      platform: "wordpress_blog",
      state: "ready",
      title: "게시 준비 완료",
      message: "Draft를 만들 수 있습니다.",
      primaryAction: { type: "create_draft", label: "WordPress Draft 만들기" },
    };
    const html = renderToStaticMarkup(
      <PlatformPublishPreparationCard
        viewModel={viewModel}
        platformLabel="WordPress 블로그"
        renderAction={(action) => <button>{action.label}</button>}
      />
    );
    expect(html).toContain("WordPress 블로그");
    expect(html).toContain("게시 준비 완료");
    expect(html).toContain("Draft를 만들 수 있습니다.");
    expect(html).toContain("WordPress Draft 만들기");
  });

  it("disabled + disabledReason이 있으면 이유를 항상 보이는 텍스트로 표시한다", () => {
    const viewModel: PublishPreparationViewModel = {
      platform: "naver_cafe",
      state: "not_approved",
      title: "승인 필요",
      primaryAction: { type: "copy_body", label: "본문 복사", disabled: true, disabledReason: "먼저 승인해야 합니다." },
    };
    const html = renderToStaticMarkup(
      <PlatformPublishPreparationCard viewModel={viewModel} platformLabel="네이버 카페" renderAction={(action) => <button>{action.label}</button>} />
    );
    expect(html).toContain("먼저 승인해야 합니다.");
  });

  it("secondaryActions도 renderAction으로 위임한다", () => {
    const viewModel: PublishPreparationViewModel = {
      platform: "x",
      state: "ready",
      title: "게시 준비 완료",
      primaryAction: { type: "copy_body", label: "본문 복사" },
      secondaryActions: [{ type: "view_detail", label: "상세 보기" }],
    };
    const html = renderToStaticMarkup(
      <PlatformPublishPreparationCard viewModel={viewModel} platformLabel="X" renderAction={(action) => <a href="#">{action.label}</a>} />
    );
    expect(html).toContain("상세 보기");
  });

  it("raw state 이름을 그대로 노출하지 않는다", () => {
    const viewModel: PublishPreparationViewModel = { platform: "x", state: "needs_setup", title: "게시 설정 필요" };
    const html = renderToStaticMarkup(
      <PlatformPublishPreparationCard viewModel={viewModel} platformLabel="X" renderAction={() => null} />
    );
    expect(html).not.toContain("needs_setup");
  });
});
