// OPS-02B: 배포 전 환경설정을 점검하는 preflight validator. 순수
// 함수이며 process.env를 "읽기"만 한다 — 실제 Supabase/Anthropic/
// WordPress API를 호출하지 않는다. secret 값은 어떤 필드에도 절대
// 담지 않는다(설정 여부 boolean만 반환) — 이미 있는
// isWordPressConfigured/isTrendEnabled/isNaverKeySet/isDaumKeySet/
// shouldUseAnthropic/auditPublishingFeatureFlags를 재사용하고, 새
// 병렬 판단 로직을 만들지 않는다.

import { isAiGenerationEnabled, shouldUseAnthropic } from "@/lib/ai/ai-config";
import { isWordPressConfigured } from "@/lib/publish/wordpress-client";
import { isTrendEnabled, isNaverKeySet, isDaumKeySet } from "@/lib/trends/trend-service";
import { auditPublishingFeatureFlags, type FeatureFlagAuditItem } from "@/lib/social/feature-flag-safety-auditor";

export type PreflightStatus = "pass" | "warning" | "fail";

export interface PreflightCheck {
  name: string;
  status: PreflightStatus;
  /** 사람이 읽을 안내 메시지. 항상 "설정 여부"만 담고 실제 값은 절대 포함하지 않는다. */
  message: string;
}

export interface PreflightResult {
  overall: PreflightStatus;
  checks: PreflightCheck[];
  /** 위험 feature flag 원본 audit item(값 없음, 참고용). */
  dangerousFlags: FeatureFlagAuditItem[];
}

function worse(a: PreflightStatus, b: PreflightStatus): PreflightStatus {
  const rank: Record<PreflightStatus, number> = { pass: 0, warning: 1, fail: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY
  );
}

function checkSupabase(): PreflightCheck {
  return isSupabaseConfigured()
    ? { name: "Supabase", status: "pass", message: "필수 Supabase 환경변수 3종이 모두 설정되어 있습니다." }
    : {
        name: "Supabase",
        status: "fail",
        message: "필수 Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/SUPABASE_SECRET_KEY) 중 일부가 설정되지 않았습니다.",
      };
}

function checkAnthropic(): PreflightCheck {
  if (!isAiGenerationEnabled()) {
    return { name: "Anthropic", status: "pass", message: "AI_GENERATION_ENABLED=false — AI 생성은 mock으로 대체됩니다(정상)." };
  }
  return shouldUseAnthropic()
    ? { name: "Anthropic", status: "pass", message: "AI_GENERATION_ENABLED=true이고 ANTHROPIC_API_KEY가 설정되어 있습니다." }
    : {
        name: "Anthropic",
        status: "fail",
        message: "AI_GENERATION_ENABLED=true인데 ANTHROPIC_API_KEY가 설정되지 않았습니다 — AI 생성이 실패하고 mock으로 자동 전환됩니다(의도한 상태인지 확인하세요).",
      };
}

function checkWordPress(): PreflightCheck {
  const publishEnabled = process.env.WORDPRESS_PUBLISH_ENABLED === "true";
  if (!publishEnabled) {
    return { name: "WordPress Draft", status: "pass", message: "WORDPRESS_PUBLISH_ENABLED=false — dry-run 모드입니다(정상, 실제 WordPress API를 호출하지 않습니다)." };
  }
  return isWordPressConfigured()
    ? { name: "WordPress Draft", status: "pass", message: "WORDPRESS_PUBLISH_ENABLED=true이고 필수 WordPress 환경변수 3종이 설정되어 있습니다." }
    : {
        name: "WordPress Draft",
        status: "fail",
        message: "WORDPRESS_PUBLISH_ENABLED=true인데 WORDPRESS_BASE_URL/WORDPRESS_USERNAME/WORDPRESS_APP_PASSWORD 중 일부가 설정되지 않았습니다.",
      };
}

function checkSearchProviders(): PreflightCheck {
  if (!isTrendEnabled()) {
    return { name: "Search providers", status: "pass", message: "TREND_COLLECTION_ENABLED=false — 트렌드 수집을 사용하지 않습니다(정상)." };
  }
  const naverOk = isNaverKeySet();
  const daumOk = isDaumKeySet();
  if (naverOk && daumOk) {
    return { name: "Search providers", status: "pass", message: "TREND_COLLECTION_ENABLED=true이고 Naver/Daum API key가 모두 설정되어 있습니다." };
  }
  if (!naverOk && !daumOk) {
    return {
      name: "Search providers",
      status: "fail",
      message: "TREND_COLLECTION_ENABLED=true인데 Naver/Daum API key가 모두 설정되지 않았습니다.",
    };
  }
  return {
    name: "Search providers",
    status: "warning",
    message: `TREND_COLLECTION_ENABLED=true인데 ${naverOk ? "Daum" : "Naver"} API key가 설정되지 않았습니다 — 해당 provider만 건너뛰고 동작합니다.`,
  };
}

/**
 * 이 프로젝트에는 "public publish"를 위한 별도 flag가 없다 —
 * `lib/publish/public-publish-guards.ts`의 `checkPublicPublishGuard`가
 * article.status/quality gate/approval/WordPress draft 존재 여부 등을
 * DB 상태로 판단하며, 환경변수로 켜고 끄는 기능이 아니다(항상 사람이
 * 버튼을 눌러야 시도되고, 그마저 guard를 통과해야만 실행된다). 따라서
 * 여기서는 "이 배포가 실제 공개 게시를 자동으로 하지 않는다"는 사실만
 * 확인 표시한다 — env 설정과 무관하게 항상 DISABLED로 표시되는 것이
 * 의도된 동작이다(자동 공개 게시 경로 자체가 없음).
 */
function checkPublicPublish(): PreflightCheck {
  return {
    name: "Public publish",
    status: "pass",
    message: "이 프로젝트에는 자동 공개 게시 경로가 없습니다(항상 사람이 버튼을 눌러야 하고, server-side guard를 통과해야만 실행됩니다) — DISABLED로 간주합니다.",
  };
}

function checkDangerousFlags(flags: FeatureFlagAuditItem[]): PreflightCheck {
  const critical = flags.filter((f) => f.status === "critical");
  if (critical.length > 0) {
    return {
      name: "Mock mode / dangerous flags",
      status: "fail",
      message: `위험한 게시 관련 flag가 안전하지 않은 값으로 설정되어 있습니다(${critical.map((f) => f.flagName).join(", ")}). 즉시 안전값으로 되돌리세요.`,
    };
  }
  return { name: "Mock mode / dangerous flags", status: "pass", message: "모든 위험 게시 flag가 안전한 기본값입니다." };
}

/**
 * 프로덕션 배포 전 환경설정을 점검한다. 실제 API를 호출하지 않고
 * process.env만 읽는다. 결과에는 어떤 secret 값도 포함되지 않는다.
 */
export function runProductionPreflight(): PreflightResult {
  const dangerousFlags = auditPublishingFeatureFlags();

  const checks: PreflightCheck[] = [
    checkSupabase(),
    checkAnthropic(),
    checkWordPress(),
    checkSearchProviders(),
    checkPublicPublish(),
    checkDangerousFlags(dangerousFlags),
  ];

  const overall = checks.reduce<PreflightStatus>((acc, c) => worse(acc, c.status), "pass");

  return { overall, checks, dangerousFlags };
}
