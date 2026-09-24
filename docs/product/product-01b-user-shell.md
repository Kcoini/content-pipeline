# PRODUCT-01B: User Shell & Technical Cleanup

- 작성일: 2026-09-24
- 목적: PRODUCT-01A 감사 결과(P0 0건, P1 4~5건, P2 4건, P3 2건)를
  바탕으로, 일반 내부 사용자와 관리자 기술 정보의 실제 UI 경계를
  구현한다. **DB schema/status machine/approval semantics/publish
  guard/Source Evidence Integrity/fact-grounding validator/외부
  side effect/Vercel 인증/AI 생성 파이프라인/재시도 규칙은 전혀
  건드리지 않았다** — navigation/라벨/presentation component만
  수정했다.

## 1. 변경 전 문제(PRODUCT-01A 요약)

- 일반 사용자 메뉴와 관리자 전용 메뉴(`platform-api`,
  `automation-safety`)가 같은 드롭다운 안에 같은 무게로 섞여 있었다.
- env var 이름(`WORDPRESS_BASE_URL`, `WORDPRESS_PUBLISH_ENABLED`,
  `SEO_PLUGIN_PROVIDER`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`)이
  `<dt>` 라벨/안내 문구에 그대로 노출되고 있었다(모두 `<details>`
  안이라 기본 화면 노출은 아니었지만, 펼쳤을 때도 raw 이름이었다).
- 영문 기술 라벨("SEO Plugin update status", "last updated at",
  "error message", "현재 provider")이 details 안에 남아 있었다.
- `pipeline_logs` 테이블명이 안내 문구에 그대로 노출되고 있었다.
- Dashboard의 "카드별 글 생성하기"와 "선택한 플랫폼 글 생성"이 동시에
  보여 primary action이 여러 개로 보일 수 있었다.

**PRODUCT-01A 조사 중 정정된 항목**: 블로그/리라이트/소셜성과
대시보드의 필터 드롭다운은 재확인 결과 **이미
`describeStatusValue()`로 정확히 한국어 라벨을 렌더링하고 있었다**
(raw 값은 `<option value>` 속성에만 있음, 이미 올바른 패턴) — 이번
Phase에서 수정하지 않았다(수정할 필요가 없었다).

## 2. 변경 후 navigation

`components/navigation/dashboard-top-nav.tsx`의
`DASHBOARD_MENU_GROUPS`에 `audience: "user" | "admin"` 필드를
추가했다.

```
콘텐츠 관리 (audience: user)
성과 분석   (audience: user)
──────── (admin 그룹 앞에만 구분선)
"아래는 콘텐츠 작업에는 필요 없는 운영자/관리자 전용 화면입니다"
관리자 / 고급 (audience: admin) — API 연동 준비 상태 / 자동화 안전 점검
```

- 그룹 제목: "운영 설정" → **"관리자 / 고급"**으로 변경.
- 메뉴 항목 라벨: "API 연동 준비" → "API 연동 준비 상태", "자동화
  안전" → "자동화 안전 점검"(둘 다 실제 화면 제목과 일치시킴).
- admin 그룹 항목은 글자색을 한 단계 옅게(`text-zinc-500`) 해서
  일반 메뉴와 시각적으로 구분한다.
- **route는 이동/삭제하지 않았다** — `/dashboard/platform-api`,
  `/dashboard/automation-safety` 모두 URL 그대로 유지되고, 여전히
  직접 접근 가능하다(auth/RBAC 없음, 의도적).

## 3. Admin 진입 방식

복잡한 RBAC/인증을 새로 구현하지 않았다. "관리자 전용"은 순수하게
**정보 구조(어느 메뉴 그룹에 있는가)**로만 표현했다 — URL 직접 접근을
막는 기능은 만들지 않았다(지시서 섹션 3과 동일).

## 4. raw enum 매핑

PRODUCT-01A가 지목한 raw enum 필터 옵션 3곳은 **재확인 결과 이미
올바르게 구현되어 있어 수정하지 않았다**(섹션 1 참고). 별도의 raw
enum 수정은 이번 Phase에서 발생하지 않았다.

## 5. env label 매핑

`app/articles/[id]/page.tsx`에서 수정한 6곳(모두 기존 `<details>`
안, 기본 닫힘 유지 — env를 **읽는 코드**는 그대로 둠):

| 이전 라벨 | 이후 라벨 |
|---|---|
| `base URL` | WordPress 사이트 주소 |
| `publish enabled` | 게시 기능 상태 |
| `media upload enabled` | 이미지 업로드 기능 상태 |
| `WORDPRESS_MEDIA_UPLOAD_ENABLED:` | 이미지 업로드 기능 상태: |
| `WORDPRESS_PUBLISH_ENABLED` | WordPress 게시 기능 상태 |
| `SEO_PLUGIN_PROVIDER` | SEO 연동 방식 |
| `SEO_PLUGIN_WRITE_ENABLED` | SEO 자동 반영 기능 상태 |
| `write provider (마지막 시도)` | 마지막 반영 시도 방식 |
| `target_keyword (focus keyword)` | 타겟 키워드 |
| `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` | Custom Endpoint 기능 상태 |
| "⚠ SEO_PLUGIN_PROVIDER=none이어서..." | "⚠ SEO 연동이 설정되어 있지 않아..." |
| "⚠ SEO_PLUGIN_PROVIDER가 rank_math가 아니어서..." | "⚠ SEO 연동 방식이 Rank Math가 아니어서..." |
| "⚠ WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED=false이어서..." | "⚠ Custom Endpoint 기능이 꺼져 있어..." |

## 6. 영문 기술 라벨 정리

`app/articles/[id]/blog/page.tsx`(SEO 반영 상세 보기 details 안):

| 이전 | 이후 |
|---|---|
| 현재 provider | 현재 SEO 연동 방식 |
| SEO Plugin update status | SEO 반영 처리 결과(`describeStatusValue()`로 값도 함께 변환) |
| last updated at | 마지막 반영 시각 |
| error message | 오류 메시지 |

## 7. pipeline_logs 노출 처리

`components/platform-api/api-dry-run-payload-preview.tsx`: "어떤
값도 pipeline_logs에 저장되지 않습니다" → "어떤 값도 **작업
기록**에 저장되지 않습니다". DB/테이블 이름 자체는 변경하지 않았다.

## 8. AdvancedDetails 정책

기존 `<details>` 구조를 그대로 유지했다 — 모두 이미 기본 닫힘이었고,
"AdvancedDetails 재사용 가능성이 매우 높다"는 PRODUCT-01A의 결론대로
구조 자체(어디를 접을지)는 이미 올바르게 되어 있었다. 이번 Phase는
그 안의 **라벨 텍스트만** 수정했다 — 별도 컴포넌트 교체(`<details>`
→ `AdvancedDetails`)는 하지 않았다(리스크/범위 대비 이득이 낮다고
판단, e2e 스냅샷 회귀 위험 최소화).

## 9. Dashboard primary action 정리

`app/dashboard/page.tsx`의 "플랫폼별 글 생성" 섹션에 안내 문구 1줄을
추가했다: "플랫폼마다 카드에서 하나씩 만들거나, 여러 플랫폼을 한 번에
만들 수 있습니다 — 둘 다 같은 기능입니다." 버튼 배치/기능은 전혀
바꾸지 않았다(삭제 금지 원칙) — 실제 상태 기계를 확인한 결과, 이
섹션의 기존 설계(개별 카드 우선 노출, 일괄 생성은 "여러 플랫폼 한 번에
선택" 접힘 안, 전체 생성은 그 안에 다시 한번 "고급 옵션" + 확인
다이얼로그로 중첩)가 이미 API 비용을 고려한 의도적 우선순위였다 —
지시서 예시("Primary: 전체 플랫폼 콘텐츠 만들기")를 그대로 따르지
않고, **현재 설계의 의도(과다 생성 방지)를 우선했다.**

## 10. Review language

이번 Phase에서는 변경하지 않았다(지시서 섹션 11 — 기존 helper
`lib/social/status-labels.ts`가 이미 이 역할을 수행 중이며, review
화면 자체의 문구 통일 작업은 범위가 커서 착수하지 않음, PRODUCT-01C
이후 후보).

## 11. Draft/manual/copy safety 확인

수정한 모든 라벨은 env var **이름**만 바꿨을 뿐, env var **값을 읽는
코드**(`process.env.WORDPRESS_BASE_URL`, `isWordPressPublishEnabled()`
등)는 전혀 건드리지 않았다. "Draft ≠ 공개 게시", "복사 ≠ 게시",
"수동 기록 ≠ 게시 완료" 관련 로직/문구는 이번 Phase에서 수정 대상이
아니었고 실제로 변경되지 않았다(git diff로 확인 — 아래 섹션 참고).

## 12. 공통 helper

새 파일을 만들지 않았다. 기존 `lib/social/status-labels.ts`의
`describeStatusValue()`를 `app/articles/[id]/blog/page.tsx`의
`seoPluginWriteStatus` 표시에 추가로 적용했다(이미 이 파일에서
import되어 있던 helper를 재사용).

## 13. 남은 P0/P1/P2/P3

- P0: 0건(변경 없음, 원래도 0건).
- P1: env var 라벨 3~4곳 해결 → 남은 P1은 Settings 화면 부재,
  raw enum(재확인 결과 해당 없음으로 정정), Error UX 미검증(범위 밖)
  정도로 축소.
- P2: env var/영문 라벨 대부분 해결 → 남은 P2는 `/dashboard`의
  "대시보드" 트리거 라벨 모호함, `/themes/[themeId]`의
  `ARTICLE_SEARCH_ENABLED` 미검증.
- P3: 변경 없음(범위 밖).

## 14. 뒤로 미룬 PRODUCT 작업

- Settings 화면(섹션 14 — 신규 개발 금지 원칙 유지).
- Content Creation Wizard(섹션 15 — 신규 개발 금지 원칙 유지).
- 전체 Error UX 통일(섹션 16 — PRODUCT-01G).
- Review language 4단계 통일(섹션 11 — PRODUCT-01C 이후 후보).
- `/articles/[id]`, `/social-posts/[id]` 등 MIXED 화면의 구조적
  재배치(라벨만 정리했고, 섹션 재배치는 하지 않음).
