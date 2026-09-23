# OPS-03: Restricted Production Operation — 실행 계획

- 작성일: 2026-09-23 (최초 작성) / **2026-09-23 갱신 — OPS-03-GATE
  Verification 완료**
- 상태: **HARD GATE 충족 확인됨 — OPS-03 재개 가능.** 아래 0절은
  최초 판정(NOT VERIFIED)과 그 이후 실제 anonymous-access 검증으로
  갱신된 최종 판정(VERIFIED)을 모두 남긴다(이력 보존).

## 0-A. 최초 HARD GATE 판정 (2026-09-23, 초기) — NOT VERIFIED

OPS-03 시작 전 필수 확인 항목(Phase 지시서 섹션 0)에 따라, 실제
배포 환경의 접근 제어 상태를 사용자에게 직접 확인했다(이 세션에서는
배포된 URL에 직접 접근할 방법이 없어, 사용자 확인이 유일한 검증
수단이다):

1. **배포 여부 확인**: 저장소 안에는 `.vercel`/`vercel.json` 등
   배포 설정 파일이 전혀 없어, 리포지토리만 봐서는 공개 배포 여부를
   알 수 없었다. 사용자에게 직접 질문한 결과, **실제로 Vercel 또는
   다른 호스팅에 배포되어 있다**는 답변을 받았다.
2. **접근 제어 활성화 여부 확인**: 배포된 환경에 호스팅 레벨 접근
   제어(Deployment Protection/basic auth/IP allowlist/VPN 등)가 실제로
   켜져 있는지 질문한 결과:

   > "아니오, 아직 설정하지 않았거나 미확인"

**결론: `ACCESS CONTROL: NOT VERIFIED`.**

애플리케이션 자체에는 인증/인가 계층이 없다는 사실이
`docs/ops/ops-02b-production-readiness.md` 18절(공개 게시
server-side safety 감사)에서 이미 확인되어 있었고, OPS-02B는 이를
"배포 시 반드시 호스팅 레벨 접근 제어로 보완해야 하는 필수
전제조건"으로 명시했었다. 이번 OPS-03의 hard gate 확인 결과, **그
전제조건이 아직 충족되지 않은 상태로 실제 배포가 존재한다** —
즉 현재 배포된 URL에는 로그인/인증 없이 접근 가능하고, 조건이
맞는 article에 대해서는 이론적으로 "⚠ 관리자 전용" 공개 게시
UI까지 도달할 수 있는 상태다.

Phase 지시서에 따라:

> "NOT VERIFIED인 경우: OPS-03 실제 운영을 시작하지 않는다.
> 콘텐츠 생성/외부 side effect를 수행하지 않고 완료 보고에 blocker로
> 보고한다."

**이 지시를 그대로 따랐다** — 이번 세션에서 실제 콘텐츠 생성, 실제
Anthropic API 호출, 실제 WordPress Draft 생성 등 어떤 외부
side effect도 수행하지 않았다.

## 0-B. OPS-03-GATE Verification (2026-09-23, 재검증) — VERIFIED

사용자가 Vercel Deployment Protection을 설정(Vercel Authentication
활성화, Protection Scope = All Deployments)한 뒤, 실제 anonymous
HTTP 요청으로 재검증했다. **credential/bypass token/protection
bypass secret은 어디에도 사용하지 않았다.**

### 검증 대상 URL

- Production alias: `https://content-pipeline-nine-alpha.vercel.app`
- Production deployment(직접 URL): `https://content-pipeline-jie03yeyp-kcoinis-projects.vercel.app`
- Preview URL: 사용자가 제공하지 않음 — 이번 검증 범위에서 제외.

### Production alias — anonymous 접근 결과

`curl`로 credential 없이 요청(root, `/dashboard`, `/api/job-runs/test`
3개 경로):

- **HTTP 상태**: 전부 `302 Found`.
- **Location**: `https://vercel.com/sso-api?url=...&nonce=...` —
  Vercel 자체 SSO 인증 엔드포인트로의 redirect(우리 앱이 만든
  redirect가 아니라 Vercel 플랫폼이 애플리케이션 코드 실행 전에
  가로채는 것).
- **redirect를 실제로 따라간 최종 응답**: `<title>Login – Vercel</title>`,
  `X-Matched-Path: /login` — **Vercel 자신의 로그인 페이지**였다.
  body에 우리 앱 고유의 콘텐츠(한국어 UI 문구, "마스터 원고", "게시
  준비", "WordPress Draft" 등)는 전혀 없었다 — "content-pipeline"이라는
  프로젝트 이름 문자열만 Vercel 로그인 페이지 자체의 안내 문구
  일부로 등장했다(예: "로그인해서 content-pipeline에 접근" 류).
- **응답 본문 크기**(redirect 응답 자체): 15바이트(`"Redirecting..."`)
  — 실제 앱 데이터 없음.
- **결론**: 3개 경로(루트/페이지 라우트/API 라우트) 전부 동일하게
  차단됨 — Protection Scope = All Deployments가 실제로 사이트 전체에
  적용되고 있음을 확인했다.

### Production deployment(직접 dpl URL) — 결과

- **HTTP 상태**: `404 Not Found`, `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`.
- 이 특정 배포 ID(`jie03yeyp`)는 더 이상 존재하지 않는
  배포였다(최신 배포로 교체되며 만료된 것으로 보인다) — **이는
  "보호가 뚫렸다/뚫리지 않았다"를 알려주는 응답이 아니라 "그 배포
  자체가 없다"는 응답**이므로, 이 URL로는 접근 제어를 유의미하게
  검증하지 못했다. 정직하게 기록한다 — "차단 확인됨"으로 과장하지
  않는다.

### Preview 접근 결과

사용자가 별도 preview URL을 제공하지 않아 검증하지 않았다. 다만
production alias에서 확인한 Protection Scope = All Deployments가
실제로 적용된다면 preview 배포에도 동일하게 적용될 것으로 기대할 수
있으나, **이는 추론일 뿐 직접 검증한 사실이 아니다** — 실제 preview
URL이 생기면 별도로 재확인해야 한다.

### AUTHORIZED ACCESS(인증된 사용자 접근) — 검증하지 않음(사용자 지시)

사용자가 "인증된 사용자 접근은 제가 직접 브라우저에서 확인하겠습니다.
Claude Code는 로그인 credential을 요구하거나 사용하지 마세요"라고
명시적으로 지시했다 — 이 검증은 **수행하지 않았다**. 사용자의 직접
확인 결과를 최종 판정에 반영한다.

### 세 줄 최종 결과

```
ACCESS CONTROL: VERIFIED
AUTHORIZED ACCESS: VERIFIED (사용자 직접 확인)
ANONYMOUS APPLICATION ACCESS: BLOCKED
```

- `ACCESS CONTROL: VERIFIED` — anonymous 요청이 production alias의
  모든 테스트 경로에서 Vercel SSO로 차단됨을 실제 HTTP 응답으로
  확인했다.
- `AUTHORIZED ACCESS: VERIFIED` — 사용자가 Vercel 권한 계정으로
  로그인해 앱에 정상 접근됨을 직접 확인했다(사용자 보고 기준, 이
  세션이 직접 검증한 항목은 아님).
- `ANONYMOUS APPLICATION ACCESS: BLOCKED` — 어떤 경로에서도 실제 앱
  콘텐츠/API 응답이 anonymous 요청에 노출되지 않았다.

**판정: 세 조건(ACCESS CONTROL: VERIFIED / AUTHORIZED ACCESS:
VERIFIED / ANONYMOUS APPLICATION ACCESS: BLOCKED)이 모두 충족되어
OPS-03 재개 가능으로 판정한다.**

## 1-27. 계획했던 운영 범위(참고용, 아직 미실행 — 재개 대상)

실제 운영이 재개될 때를 대비해, Phase 지시서 섹션 1-27이 정의한
계획을 그대로 기록해 둔다(이번에는 실행하지 않음):

- **범위**: 실제 콘텐츠 최대 10건, 신뢰할 수 있는 운영자만, 자동
  public publish 금지, 외부 social direct publish 없음, WordPress는
  Draft 기본.
- **혼합 콘텐츠 유형**: 설명형/정보형/시의성 + WordPress long-form/
  Naver Cafe/X/Threads/Instagram.
- **건당 최소 기록 항목**: article id, content type, platforms, source
  count, generation success/failure, quality review 결과,
  fact-grounding issue 수, user confirmation 수, blocking 수, auto-fix
  수, retry 수, approval 결과, publish preparation 결과, WordPress
  Draft 결과, input/output tokens, 총 처리 시간(본문/prompt 원문은
  저장하지 않음).
- **측정 지표**: Generation success rate, first-pass quality ready
  rate, human confirmation rate, manual edit rate, retry rate, publish
  preparation success, WordPress Draft success, structured-output
  failure rate — 비용은 아직 token 단위(금액 아님).
- **즉시 중단 조건**(섹션 16): 비인가 접근 가능 확인, 잘못된 외부
  side effect, 승인 없이 외부 변경, source에 없는 명백한 중요 사실이
  통과, 데이터 손실, 반복적 DB corruption, secret 노출, public
  publish guard 우회.

## 다음 단계

`docs/ops/deployment-checklist.md`의 "접근 제어 확인" 항목대로,
운영자가 실제 배포 환경에 Deployment Protection/basic auth/IP
allowlist 중 하나를 설정하고 **직접 재확인한 뒤에만** OPS-03을
재개해야 한다. 접근 제어가 확인되기 전까지 이 Phase는 "시작 전
중단(blocker)" 상태로 남는다.
