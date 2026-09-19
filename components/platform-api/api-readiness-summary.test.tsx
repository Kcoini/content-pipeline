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
    expect(html).toContain("차단 사유");
  });

  it("Phase UX-04B: 'dry-run'/'blockers'/'warnings'/'feature flag' 같은 영문/기술 용어 대신 한국어 문구를 쓴다(H2 해결)", () => {
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
          warnings: ["확인이 필요합니다."],
          blockers: ["필요한 환경변수가 설정되지 않았습니다 (1개 누락)."],
          fallbackMode: "draft_or_manual_existing",
        }}
        eligibility={{
          socialPostId: "post-1",
          eligibleForDryRun: false,
          eligibleForActualPublish: false,
          blockers: ["필요한 환경변수가 설정되지 않았습니다 (1개 누락)."],
          warnings: ["확인이 필요합니다."],
          nextAction: "blocker를 먼저 해결하세요.",
        }}
      />
    );
    expect(html).toContain("연결 확인 가능");
    expect(html).toContain("게시 기능 활성화 여부");
    expect(html).toContain("확인 필요 사항");
    expect(html).not.toContain("dry-run 가능");
    expect(html).not.toContain(">blockers<");
    expect(html).not.toContain(">warnings<");
    expect(html).not.toContain(">feature flag<");
  });
});
