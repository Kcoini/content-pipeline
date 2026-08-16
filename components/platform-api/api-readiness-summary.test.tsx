import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiReadinessSummary } from "./api-readiness-summary";
import { getPlatformApiCapability } from "@/lib/social/platform-api-capabilities";

describe("ApiReadinessSummary", () => {
  it("readiness/eligibility 상태와 blocker/warning을 렌더링하고 환경변수 값은 노출하지 않는다", () => {
    const capability = getPlatformApiCapability("wordpress_blog");
    const html = renderToStaticMarkup(
      <ApiReadinessSummary
        capability={capability}
        readiness={{
          platform: "wordpress_blog",
          status: "missing_config",
          publishEnabled: true,
          dryRunOnly: true,
          configured: false,
          missingEnvVars: ["WORDPRESS_BASE_URL"],
          warnings: [],
          blockers: ["필요한 환경변수가 설정되지 않았습니다 (1개 누락)."],
          fallbackMode: "draft_or_manual_existing",
        }}
        eligibility={{
          socialPostId: "post-1",
          eligibleForDryRun: false,
          eligibleForActualPublish: false,
          blockers: ["필요한 환경변수가 설정되지 않았습니다 (1개 누락)."],
          warnings: [],
          nextAction: "blocker를 먼저 해결하세요.",
        }}
      />
    );

    expect(html).toContain("설정 누락");
    expect(html).toContain("WORDPRESS_BASE_URL");
    expect(html).not.toContain("https://");
    expect(html).toContain("blockers");
  });
});
