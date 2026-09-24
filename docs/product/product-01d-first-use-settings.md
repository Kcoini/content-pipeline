# PRODUCT-01D: First-use & Settings Foundation

- 작성일: 2026-09-24
- 관련 문서: `docs/product/product-language-dictionary.md`(readiness 용어 절),
  `docs/product/product-information-architecture.md`(설정 route 반영),
  `docs/product/product-01b-user-shell.md`, `docs/product/product-01c-review-language.md`.

## 1. 현재 설정 소스 조사(Category 분류)

`lib/`/`app/`/`db/` 전체를 grep해서 사용자별 저장 가능한 preference
구조가 있는지 확인했다(`defaultTone`, `default_platform`,
`user_preferences`, `user_settings` 등 — 전부 0건).

| 항목 | 분류 | 근거 |
|---|---|---|
| 글 스타일(문체) 기본값 | **C**(저장 구조 없음) | 매번 `/dashboard` 폼에서 직접 선택 — 저장 컬럼 없음 |
| 플랫폼 기본값 | **C**(저장 구조 없음) | 매번 콘텐츠 생성 시 직접 선택 |
| 콘텐츠 생성 가능 여부(Anthropic) | **B**(시스템 기본값, 상태만 표시) | `runProductionPreflight()`의 "Anthropic" check |
| 자료 검색 가능 여부(Search providers) | **B** | `runProductionPreflight()`의 "Search providers" check |
| WordPress 연동 여부 | **B** | `runProductionPreflight()`의 "WordPress Draft" check |
| 출처 확인 / 게시 전 최종 확인 | **B**(항상 켜짐, toggle 없음) | `lib/harness/approval-gate.ts`의 `assertApproved` — 구조적으로 항상 강제 |
| API 연동 상세 설정(env var/provider ID) | **D**(admin 전용) | `/dashboard/platform-api` |

Category C 항목(저장 구조 없음)을 위해 가짜 editable UI를 만들지
않았다(지시서 섹션 1의 명시적 금지). 대신 "저장된 기본값은 아직
없습니다"라는 정직한 안내 문구로 대체했다.

## 2. First-use 판단 기준

새 DB 컬럼/쿼리를 추가하지 않았다. `app/dashboard/page.tsx`의 기존
`selectedTheme` 계산을 추적한 결과, `!selectedTheme`가 이미
`themes.length === 0`(테마를 하나도 만든 적 없음)과 수학적으로
동일함을 확인했다(`selectedTheme = (themeId && themes.find(...)) ||
themes[themes.length - 1]`는 `themes`가 빈 배열일 때만 falsy).
기존 빈 상태 분기를 그대로 확장해서 재사용했다.

## 3. Welcome 빈 상태

`app/dashboard/page.tsx`의 `!selectedTheme` 분기에 환영 문구 + 5단계
안내(주제 선택 → 참고자료 확인 → 콘텐츠 생성 → 확인이 필요한 내용
검토 → 게시 준비) + CTA 1개(`#theme-list` 앵커, 실제 테마 생성 폼
위치)를 추가했다. 기존 사용자(테마가 하나 이상 있는 경우)의 화면은
전혀 바뀌지 않았다 — `else` 분기(선택된 테마 요약 카드)를 그대로
유지했다.

4~5단계 온보딩 마법사, 가입절차, 프로필 입력, 튜토리얼 오버레이는
만들지 않았다(지시서 섹션 9 명시적 금지) — CTA는 실제 진입점(테마
생성 폼)으로 바로 연결되는 앵커일 뿐이다.

## 4. Settings IA

`/dashboard/settings` 신설(다른 모든 INTERNAL_USER 페이지가 쓰는
`/dashboard/*` 관례를 따름, 상단 nav의 "설정" 그룹에서 연결). 3개
section:

1. **콘텐츠 설정** — Category C 항목에 대한 정직한 read-only 안내.
2. **연결 상태** — `ContentServiceReadiness`를 `StatusRow`로 표시.
   WordPress가 `available`이 아니면 "관리자에게 연결 설정을 요청해
   주세요"만 보여주고, `[연결하기]`/`[수정하기]` 같은 가짜 버튼은
   만들지 않았다(지시서 섹션 4).
3. **검토 및 게시** — 출처 확인/게시 전 최종 확인/WordPress 게시
   방식(초안 저장)을 항상 "사용 중"으로만 표시. OFF toggle을 제공하지
   않는다(지시서 섹션 16, Safety Settings 원칙).

## 5. WordPress 표현 방식

`unknown`(preflight check 자체를 찾을 수 없음)을 "연결 안 됨"으로
단정하지 않는다 — "상태를 확인할 수 없습니다"라는 별도 문구를
쓴다(섹션 22). `available`/`needs_attention`/`unknown` 3단계 용어의
전체 정의는 `docs/product/product-language-dictionary.md`
"PRODUCT-01D: 서비스 준비 상태(readiness) 용어" 절 참고.

## 6. Service Readiness 모델

`lib/ui/content-service-readiness.ts`의 `getContentServiceReadiness()`는
기존 `runProductionPreflight()`(admin 전용 순수 env 읽기 함수)를 그대로
재사용해서 결과만 사용자 언어로 재번역한다 — 새 판단 로직을
만들지 않았고, preflight의 raw check 이름/message는 반환값 밖으로
나가지 않는다(테스트로 JSON.stringify 결과에 env var 이름이 없음을
확인).

## 7. Safety Settings 정책

출처 확인, 사람 승인, public publish guard는 이 화면(또는 다른 어떤
설정 화면)에서도 OFF로 바꿀 수 없다. `requiresHumanApproval: true`는
env/preflight에서 파생되지 않고 코드 레벨에서 항상 고정된 값이다
(`assertApproved`가 구조적으로 강제).

## 8. Dashboard 생성 문구 재검토(섹션 18)

PRODUCT-01B/C에서 이미 "전체 플랫폼 글 생성"/"플랫폼별 글 생성" 관련
문구를 검토했고(비용 보호 confirm 구조를 유지하기 위해 버튼 재배치는
하지 않기로 결정), 이번 Phase에서 다시 확인한 결과 추가로 바꿀 필요가
있는 생성 관련 버튼 문구는 발견하지 못했다 — **변경 없음**으로
결론짓는다(섹션 18을 건너뛰지 않고 명시적으로 재확인함).

## 9. Backend 변경 여부(섹션 24)

`git diff --stat` 기준으로 PRODUCT-01D에서 새로 추가/수정한 파일은
`lib/ui/content-service-readiness.ts`(신규, presentation-only, 기존
`runProductionPreflight()`를 수정 없이 호출만 함), `app/dashboard/settings/page.tsx`(신규 라우트),
`app/dashboard/page.tsx`(기존 빈 상태 분기 확장), `components/navigation/dashboard-top-nav.tsx`(메뉴
항목 추가) 및 대응 테스트/fixture 파일뿐이다. DB 스키마, 상태 머신,
승인/게시 로직, repository, server action은 전혀 건드리지 않았다 —
**backend 변경 없음**.

## 10. 알려진 한계

- 첫 사용/기존 사용자 Dashboard fixture는 `app/dashboard/page.tsx`가
  Supabase에 직접 의존하는 async 서버 컴포넌트라 fixture 파이프라인
  (`renderToStaticMarkup`)으로 페이지 전체를 구울 수 없다 — 실제
  페이지에 추가한 것과 동일한 JSX를 별도로 재현한 fixture로 QA를
  수행했다(`e2e/first-use.pw.ts`).
- Settings 페이지의 드롭다운/인터랙션은 없다(전부 read-only 표시라
  client-side 상태가 필요 없음) — PRODUCT-01C가 겪었던 "hydration
  없이는 드롭다운 열림 상태를 검증할 수 없다"는 제약이 이 페이지에는
  적용되지 않는다.
