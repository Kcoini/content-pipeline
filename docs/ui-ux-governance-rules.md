# UI/UX Governance Rules

프로젝트 UI가 기능 중심으로 계속 늘어나면서(버튼/상태/action이 많아지면서)
사용자 친화성이 떨어지는 것을 막기 위한 프로젝트 전반의 UI/UX 규칙이다.
새 화면을 만들거나 기존 화면에 기능을 추가할 때는 이 문서를 먼저 확인한다.

이 문서는 **규칙 정리 문서**다 — 이 문서 자체는 어떤 코드도 변경하지 않는다.
실제 UI를 수정/검토할 때는 이 문서 + [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md)를
함께 사용한다. wordpress_blog 카드처럼 화면별 세부 규칙이 필요하면
[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)처럼 별도 문서를 둔다.

## 섹션 1. 기본 원칙

- 사용자는 항상 **현재 상태**를 알 수 있어야 한다.
- 사용자는 **다음에 해야 할 작업**을 알 수 있어야 한다.
- **최종 실행 버튼은 하나만** 명확하게 보여야 한다(primary button).
- 보조 버튼은 관련된 단계 안에 배치한다 — 화면 상단에 흩어 놓지 않는다.
- 같은 의미의 버튼을 여러 위치에 중복 배치하지 않는다.
- 검사(quality gate, guard 등) 단계에는 **왜 필요한지** 설명을 붙인다.
- 업데이트 action에는 성공/실패/마지막 실행 시간을 표시한다.
- 외부 시스템(WordPress 등)에 반영될 내용을 실행 전에 미리 보여준다(미리보기).
- Draft 생성, Metadata 업데이트, 대표 이미지 연결, 공개 게시처럼 **결과가 다른
  action은 명확히 구분**한다 — 버튼 문구/위치/색상으로 헷갈리지 않게 한다.
- "확인 필요" 상태에는 반드시 설명과 다음 행동을 표시한다 — badge 텍스트만
  보여주고 끝내지 않는다.
- UI 상태 표현은 완료/필요/확인 필요/차단됨/실패/생략 중심으로 단순화한다
  (자세한 기준은 섹션 3).
- 내부 DB 상태명(`ready`, `approved`, `not_checked` 등)을 그대로 사용자에게
  노출하지 않는다 — 반드시 한국어 사용자 상태로 변환해서 보여준다.
- **공개 게시(public publish)와 Draft 업데이트는 절대 같은 버튼처럼 보이면
  안 된다** — 되돌리기 어려운 action과 안전한 action은 시각적으로도 명확히
  구분한다.

## 섹션 2. 버튼 규칙

- 버튼은 workflow 순서대로 배치한다(먼저 해야 할 일이 위/왼쪽).
- 한 줄에 많은 버튼을 나열하지 않는다 — 관련 있는 버튼끼리 묶는다.
- primary button은 한 화면 또는 한 section에 하나만 둔다.
- destructive 또는 irreversible action(예: 공개 게시, 승인 철회)은 명확한
  확인이 필요하다.
- disabled 버튼에는 반드시 이유를 표시한다(예: "승인 후 Draft를 생성할 수
  있습니다.").
- 영어와 한국어가 섞인 버튼명을 줄인다.
- 사용자 친화적인 버튼명으로 바꾼다 — 내부 함수명/기술 용어를 그대로 쓰지
  않는다.

버튼명 변환 예(실제 이번 프로젝트에 적용된 사례 — `docs/article-blog-wordpress-workflow.md` 참고):

| 이전 | 이후 |
| --- | --- |
| WordPress Draft Export | 수동 게시용 Draft 내보내기 |
| Dry-run 생성 | 게시 전 미리보기 생성 |
| Handoff 완료 | 수동 게시 완료 표시 |
| 게시 체크리스트 준비 | 게시 체크리스트 만들기 |
| WordPress 게시 준비 일괄 실행 | WordPress에 반영하기 |
| WordPress 게시 준비 확인 | 게시 가능 상태 확인 |

> 주의: 버튼 **label**을 바꾸는 것과 실제 **action 함수를 삭제/교체**하는
> 것은 다르다. 이 표는 화면에 보이는 문구 기준이며, 기존 action은 삭제하지
> 않는다(액션 재사용/재명명 원칙은 `CLAUDE.md` UI/UX Governance Rules 섹션
> 참고).

### 섹션 2-1. 목록 삭제(보관 처리) 버튼 규칙

테마/기사/wordpress_blog·naver_blog 등 social post 목록의 "삭제" 버튼은
다음을 반드시 지킨다.

- **삭제 버튼은 확인 모달(브라우저 `window.confirm`, `ConfirmSubmitButton`
  컴포넌트)을 반드시 거친다** — 클릭 즉시 삭제하지 않는다.
- **기본은 hard delete가 아니라 soft delete(archived_at 설정)/보관
  처리를 우선한다.** themes→articles→social_posts는 `on delete cascade`로
  연결되어 있어(`db/schema.sql`) 실제 삭제는 연쇄적으로 위험하다.
- 삭제 버튼은 primary button 스타일로 보이지 않게 한다 — 회색/보조 버튼
  색상을 쓰고, hover 시에만 위험(빨간색) 색상으로 바뀌게 한다. 목록 항목의
  주 클릭 영역(상세로 이동하는 링크)과 분리된 별도 버튼으로 둔다.
- 확인 모달 문구에는 **연관 데이터 개수**(연결된 기사/출처/social post
  개수 등)와 **WordPress 관련 안내**를 포함한다: "이미 생성된 WordPress
  글은 자동 삭제되지 않습니다."
- **WordPress에 이미 생성된 Draft/Post는 앱에서 항목을 삭제해도 원격으로
  자동 삭제하지 않는다** — 원격 WordPress 삭제 기능 자체를 만들지
  않는다. public publish된 글은 더더욱 건드리지 않는다.
- 삭제(보관 처리) 후에는 **목록 조회에서 자동으로 제외**된다
  (`archived_at is null` 조건). 복구 UI는 필수가 아니지만, DB에는
  기록이 남아 있어(hard delete가 아님) 나중에 복구 기능을 추가할 수
  있는 구조를 유지한다.
- 삭제/보관 action은 server action으로 구현하고, 성공/실패를
  `pipeline_logs`에 기록하며(`*_archived`/`*_delete_blocked`), 실행 후
  `revalidatePath`로 목록 화면을 갱신한다.

## 섹션 3. 상태 표시 규칙

UI 상태는 다음 6가지로 통일한다:

| 상태 | 의미 |
| --- | --- |
| 완료 | 확인/실행이 끝났다. |
| 필요 | 아직 실행하지 않았다(실행하면 된다). |
| 확인 필요 | 시스템이 자동으로 판단할 수 없어 사람이 직접 봐야 한다. 오류가 아니다. |
| 차단됨 | 필수 조건을 충족하지 못해 진행할 수 없다. |
| 실패 | 실행을 시도했지만 오류가 발생했다. |
| 생략 | 해당 없음으로 건너뛴다(예: 이미지 없이 진행). |

내부 상태가 `ready`/`approved`/`exported`/`completed`/`pending`/`blocked`/`failed`
등으로 테이블마다 다르게 저장되어 있더라도, **화면에는 항상 위 6가지 중
하나로 변환해서** 보여준다. 변환 로직은 화면별 헬퍼(예:
`lib/social/manual-posting-checklist-status.ts`, `wordpress-blog-workflow-steps.ts`의
`stepBadgeClass`)에 모아두고, JSX 안에 산발적으로 매핑하지 않는다.

## 섹션 4. WordPress 게시 준비 UI 규칙

wordpress_blog 카드의 WordPress 게시 준비 UI는 반드시 **단계형 workflow**로
표시한다(버튼 단순 나열 금지). 자세한 단계 구성과 카드 전용 규칙은
[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md)에 정리했다. 요약:

1. 품질검사
2. 승인
3. WordPress Draft
4. SEO Metadata
5. 대표 이미지
6. 게시 가능 상태 확인
7. 게시 체크리스트 / Handoff

각 단계에는 다음을 표시한다: 상태, 왜 필요한지, 현재 값, 실행 버튼, disabled
이유, 마지막 실행 결과.

**카드가 길어지면 탭으로 분리한다**: 한 카드 안에 기능이 계속 늘어나
세로 스크롤 부담이 커지면, 내용을 탭으로 나누고 카드 상단에는 항상
보이는 고정 상태 요약(핵심 상태 + 다음 추천 작업 + 최종 실행 버튼)만
남긴다. wordpress_blog 카드가 이 패턴의 실제 적용 사례다(6개 탭 —
글 내용/WordPress 미리보기/품질·승인/WordPress 반영/대표 이미지/
체크리스트, `docs/wordpress-blog-card-ui-rules.md` 참고). 탭 이동은
새 라이브러리 없이 query param(`tab=...`)과 기존 Tailwind만 사용하고,
action 실행 후에도 같은 카드·같은 탭으로 돌아온다.

**사용자가 자주 보는 작업 UI와 시스템 로그는 분리한다**: 카드 안에는
사용자가 실제로 해야 하는 작업(상태 요약, 다음 추천 작업, 실행 버튼,
짧은 결과 요약)만 두고, pipeline_logs/실행 이력/raw JSON details 같은
디버그성 정보는 페이지 하단의 별도 섹션으로 모은다. 하단 로그 섹션은
기본 접힘 상태로 두고, "문제가 발생했을 때만 확인하면 된다"는 것을
문구로 알려준다. 체크리스트(사용자가 지금 확인/처리해야 하는 항목)와
로그(이미 실행된 작업의 기록)는 서로 다른 개념이므로 같은 곳에 두지
않는다 — 체크리스트는 카드 안에, 로그는 페이지 하단에 둔다.
wordpress_blog 카드가 이 패턴의 실제 적용 사례다(`docs/article-blog-wordpress-workflow.md`
참고).

## 섹션 5. 외부 시스템 반영 미리보기 규칙

외부 시스템(WordPress 등)에 반영하기 전에 반드시 다음을 보여준다:

- 제목(WordPress 제목)
- 본문 미리보기
- SEO title
- meta description
- target keyword
- 대표 이미지
- AD_SLOT 위치
- 참고자료/출처

## 섹션 6. 업데이트 결과 표시 규칙

업데이트 action 실행 후 반드시 결과 요약을 보여준다:

- Draft 생성/업데이트 결과
- SEO Metadata 업데이트 결과
- 대표 이미지 연결 결과
- 게시 준비 상태
- 실패 단계
- 실패 사유
- 마지막 실행 시간

**일시적 action 결과는 toast로, 상태 자체는 카드에 남긴다**: "선택한
항목을 강조 표시했습니다.", "quality gate 실행 완료 (status: ready,
score: 92)." 같은 **일회성 확인 메시지**는 본문 중간에 계속 남는
alert/info box로 만들지 않는다. `components/ui/transient-notice.tsx`
(`TransientNotice`)처럼 화면 한쪽에 잠깐(기본 4초) 떴다 자동으로
사라지는 toast로 보여주고, 닫기 버튼도 둔다. 대신:
- 실제 **상태**(품질검사 완료 여부, score, 마지막 실행 시간 등)는
  toast가 아니라 카드의 상태 요약에 항상 남겨서, toast를 놓쳐도 지금
  상태를 확인할 수 있게 한다.
- **상세 실행 기록**(성공/실패, 언제, 무슨 값이었는지)은 페이지 하단
  프로세스 로그에 남는다(섹션 4의 로그/작업 UI 분리 규칙 참고).
- "선택한 항목을 강조 표시했습니다." 같은, 이미 화면에 보이는 사실을
  다시 문장으로 설명하는 메시지는 아예 표시하지 않는 것을 기본으로
  한다 — 카드 자체의 강조 표시(하이라이트 CSS)만으로 충분하다. 다만
  "선택한 항목을 찾을 수 없습니다" 같은 **실제로 필요한 경고**는
  toast가 아니라 그대로 유지한다(사용자가 놓치면 안 되는 정보이기
  때문).

## 섹션 7. 확인 필요 항목 규칙

"확인 필요" 항목은 오류가 아니며, 사람이 직접 확인해야 하는 항목이다. 각
항목에는 다음을 표시한다:

- 설명(무엇을 확인해야 하는지)
- 확인 방법(어디서 어떻게 확인하는지)
- 확인 완료 버튼(가능한 경우)
- URL 입력이 필요한 경우 입력 필드

**카드/박스 안 정보는 요약 → 상세(접기) 순으로 배치한다**: 제목/본문/
상태/metadata/오류/버튼이 한 화면에 한꺼번에 노출되면 읽기 어렵다.
지금 바로 필요한 정보(상태 badge, 다음 추천 작업, 실행 버튼, 상태에
실제로 영향을 주는 짧은 오류)만 기본으로 보여주고, metadata 전체
값·부가 상세·raw 내부 상태값·긴 설명 문장은 `<details>`(새 라이브러리
없이 네이티브 접기/펼치기)로 감싸 기본 접힘 상태로 둔다.
`docs/wordpress-blog-card-ui-rules.md`의 "카드 안 정보는 핵심 요약 →
상세(접기) 순으로 배치한다" 절이 이 패턴의 실제 적용 사례다. 오류는
"지금 상태에 영향을 주는 오류"와 "예전에 실패했던 이력"을 구분해서
표시한다 — 이미 해결된 문제(예: waived로 대체된 이전 실패)를 지금도
문제인 것처럼 크게 보여주지 않는다.

## 섹션 8. 금지 UI 패턴

다음을 금지한다:

- 버튼을 의미 없이 한 줄에 나열
- primary button 여러 개 동시 표시
- 같은 action을 여러 위치에 중복 노출
- "대기중"만 표시하고 이유를 설명하지 않음
- "확인 필요"만 표시하고 무엇을 확인할지 설명하지 않음
- Draft 생성과 공개 게시를 혼동시키는 문구
- article 원문 전송과 wordpress_blog 전송을 같은 것으로 보이게 하는 UI
- **의미상 같은 후보/항목을 별도 카드로 중복 노출**(예: 공통 테마 후보
  목록에서 같은 이슈가 표현만 다르게 여러 카드로 보이는 것) — 목록에는
  대표 항목만 표시하고, 병합된 항목은 대표 항목 카드 안의 접기 영역에서만
  확인하게 한다. 대표 항목에서만 다음 액션(예: "이 테마로 기사 작성
  시작")이 동작해야 하며, 병합된 항목에는 같은 액션 버튼을 두지 않는다
  (`app/trends/page.tsx`의 `groupThemeClustersForDisplay` +
  "병합된 후보 보기" 접기 영역이 실제 적용 사례 —
  `docs/phase-1-16-theme-candidate-deduplication.md` 참고). 이 그룹핑은
  화면 표시용일 뿐 원본 raw 데이터/근거는 삭제하지 않는다.

## 섹션 9. 카드 제목/설명 레이아웃 규칙

카드에 제목 + 점수(또는 다른 숫자 요약) + 긴 설명문을 함께 표시할 때,
설명문을 점수 옆 좁은 column 안에 가두지 않는다 — 한국어 설명문은
문장이 길어 좁은 폭에서 단어 중간에 줄바꿈되면 가독성이 크게
떨어진다(예: "인공지능 기술, 서 / 비스, 규제..." 처럼 잘려 보임).

- **헤더 row에는 제목 + 점수(숫자 요약)만 둔다.** 제목 영역은
  `min-w-0 flex-1`, 점수 영역은 `shrink-0`으로 좁아지지 않게 한다.
- **설명문은 헤더 아래 별도 요소로 분리하고, 카드 전체 폭(`w-full`,
  필요하면 `max-w-none`)을 사용하게 한다.** 점수/상태 column과 같은
  flex row 안에 넣지 않는다.
- **한국어 텍스트(제목/설명/하위 주제 등 긴 문장이 들어갈 수 있는
  곳)에는 `break-keep`(word-break: keep-all)을 우선 적용한다** —
  Tailwind 4의 내장 유틸리티이며 별도 CSS 추가가 필요 없다. 단어
  중간에서 끊기지 않고 어절 단위로 자연스럽게 줄바꿈된다.
- **배지(badge)/태그(tag) 목록은 설명문보다 아래(또는 명확히 분리된
  영역)에 두고, `flex-wrap`으로 자연스럽게 줄바꿈되게 한다.** 배지/태그가
  설명문과 같은 줄이나 같은 column에 끼어들어 설명 영역을 좁히지
  않게 한다.
- 카드 안 정보 순서 권장: 헤더(제목+점수) → 설명문(전체 폭) →
  상태 배지 → 부가 지표(건수/시각) → 태그/하위 정보(접기) →
  병합·근거 등 상세(접기) → 액션 버튼. `app/trends/page.tsx`의
  `ClusterCard`가 실제 적용 사례다(자세한 배경은
  `docs/phase-1-18-theme-card-description-layout.md`,
  `docs/phase-1-21-theme-selection-focused-ui.md` 참고).
- **카드당 primary action(주요 버튼)은 하나로 제한한다.** "근거 보기",
  "병합된 후보 보기", "하위 주제 보기" 같은 부가 정보 열람은 버튼이
  아니라 `<details>`의 secondary link 스타일(색이 있는 텍스트, 배경/
  테두리 없음)로 표시해 primary button과 시각적으로 구분한다.
- **원자료(raw) 목록과 최종 후보(final candidate) 목록이 함께 있는
  화면에서는 최종 후보를 우선 표시한다.** 최종 후보는 더 넓은 폭/먼저
  오는 DOM 순서를 갖고, 원자료는 근거 확인용 보조 정보로 compact하게
  (배지+제목+순위만 기본 표시, 긴 요약은 접기 안에) 표시하며 기본
  접힘 상태로 둘 수 있다. 좁은 화면(모바일)에서는 최종 후보가 항상
  먼저 보이게 한다.

## 섹션 10. 상단 내비게이션 규칙

- **상단(전역) 내비게이션에는 핵심 작업 2~3개만 항상 노출한다.** 나머지
  대시보드/운영 메뉴는 역할별로 묶은 드롭다운 하나로 통합한다(`대시보드
  ▾`, 모바일에서는 `메뉴 ▾`). 드롭다운은 새 UI 라이브러리 없이 순수
  React state(또는 `<details>`)로 구현하고, 열림 트리거에는
  `aria-haspopup`/`aria-expanded`/`aria-controls`를 붙이며 `Escape`와
  바깥 클릭으로 닫히게 한다.
- **위험/운영 성격 메뉴(예: 자동화 안전 점검)는 상단에 상시 노출되는
  강한 색(빨강 등) 버튼으로 두지 않는다.** 드롭다운 안에서만, 옅은
  색(테두리/배경 없는 텍스트 색상 정도)으로 구분한다.
- 버튼 라벨은 가능하면 한국어로 통일한다(도메인에서 굳어진 영문
  약어, 예: API,는 예외로 허용한다).
- 실제 사례: `components/navigation/dashboard-top-nav.tsx`
  (`docs/phase-1-22-dashboard-top-nav-simplification.md` 참고).

## 섹션 11. 선택 중심 작업 화면(워크스페이스) 규칙

- 화면의 핵심 작업이 "여러 항목 중 하나를 선택해 다음 작업을 진행하는
  것"이라면(예: 테마를 고르고 출처를 등록해 기사를 생성), 화면을
  **선택 대상 목록(사이드바) + 선택된 대상 작업 영역(메인)** 구조로
  나눈다.
- **입력 폼(생성 폼, 상세 등록 폼)은 기본 접기 또는 compact 형태로
  둔다.** 새 항목을 만드는 폼은 `+ 새 OO` 트리거 뒤에 숨기고, 목록/다음
  작업이 그 아래로 밀리지 않게 한다. 순수 HTML `<details>`/`<summary>`로
  충분하면 JS 없이 구현한다(Tailwind의 `group-open:` variant로 트리거
  라벨을 토글할 수 있다).
- **사용자가 다음에 해야 할 작업은 별도의 "다음 작업" 카드로 명시한다.**
  상태(예: 조건 미충족/충족/이미 완료)에 따라 문구와 버튼이 달라지며,
  이 카드의 버튼이 화면의 유일한 primary action이어야 한다 — 같은
  화면의 다른 곳에 있는 동일/유사 액션 버튼은 secondary 스타일로
  낮춘다.
- **긴 URL과 긴 요약/본문은 기본 노출하지 않는다.** URL은 도메인만
  보여주고 "원문 열기" 링크로 전체를 대체하며, 요약은 `line-clamp-2`
  등으로 제한하고 전체 텍스트는 `<details>`("요약 전체 보기"/"본문
  보기")로 분리한다.
- **raw 상태값(pending/success/failed/skipped 등)은 사용자에게 그대로
  노출하지 않고, 상태 배지 컴포넌트를 통해 사용자 친화적 문구로
  변환한다**(예: `success`→"본문 수집 완료", `failed`→"수집 실패").
- 새 기능(예: 항목 삭제)이 기존 원칙(DB schema 변경 금지, hard delete
  금지)과 충돌하면, 구현을 보류하고 그 사유를 코드 주석과 문서에 남긴다
  — 억지로 스키마를 바꾸거나 hard delete로 우회하지 않는다.
- 실제 사례: `app/dashboard/page.tsx`
  (`docs/phase-1-23-dashboard-theme-workspace.md` 참고).
- **Server Action 버튼 클릭 후 무반응 상태를 만들지 않는다.** 계약 검사
  실패 등으로 저장을 진행하지 않을 때도 아무 메시지 없이 같은 화면으로
  조용히 `redirect`하지 않는다 — 항상 성공/실패/차단 사유 중 하나를
  화면에 표시한다(`TransientNotice` 등). 이미 생성된 결과물(기사초안 등)이
  있는 상태에서 다른 옵션으로 재생성하면, 조용히 덮어쓰지 않고 사용자
  확인을 먼저 거친다. 실제 사례: `app/dashboard/actions.ts`의
  `generateArticleDraft` (`docs/phase-2-22-article-generation-regeneration-confirmation.md` 참고).
- **같은 영어 값(예: `"reviewed"`)을 서로 다른 필드에 재사용할 때는
  화면 라벨을 다르게 붙이지 않는다(또는 명확히 구분되는 문구를 쓴다).**
  마스터 승인 게이트(`article.status`)와 하위 항목의 선택적 검토 플래그
  (`wpMetadataStatus`/`seoPluginMetadataStatus`/`featuredImageStatus`)가
  우연히 같은 값 `"reviewed"`를 쓰면서 한쪽은 "승인됨", 다른 쪽은 "검토
  완료"로 다르게 번역되어 있으면, 사용자는 이를 서로 다른 승인 단계로
  오해한다. 실제 사례: `lib/publish/publish-service.ts`/
  `app/articles/[id]/blog/page.tsx`
  (`docs/phase-2-23-wordpress-draft-approval-status-clarity.md` 참고).
- **게시용 본문과 내부 관리 정보(quality_status/approval_status/
  export_status/성과/Rewrite/A-B Test/API readiness/metadata/localhost
  링크 등)를 같은 화면에 나란히 펼쳐 보여주지 않는다.** 게시용 본문
  미리보기는 항상 눈에 바로 보이게 하고, 내부 관리 정보는 "관리 정보
  보기" 같은 접힌(collapsed) accordion 안에 모아 관리자용임을
  표시한다. export/copy/handoff payload에는 내부 관리 정보를 절대
  포함하지 않는다. 실제 사례: `app/social-posts/[id]/page.tsx`,
  `lib/social/social-export-builder.ts`
  (`docs/phase-3-20-naver-cafe-plain-text-cleanup.md` 참고).
- **"게시용 본문"과 "본문 미리보기"처럼 같은 본문을 가리키는 영역을
  한 카드 안에 두 번 펼쳐 보여주지 않는다.** 본문 확인 영역은 카드
  하나당 한 곳만 두고, 그 안에서 게시용 미리보기/편집용 원문/복사용
  텍스트 같은 보기 모드를 전환한다(동시에 여러 보기를 펼치지 않는다).
  플랫폼별 기본 보기 모드는 다를 수 있다(WordPress/네이버 블로그·
  기사형은 게시용 미리보기 기본, 네이버 카페/SNS는 복사용 텍스트
  기본). 실제 사례: `app/articles/[id]/blog/page.tsx`의
  wordpress_blog 카드(카드 상단 `SocialPostBodyPanel`과 탭 안
  "게시용 미리보기"/"편집용 원문"이 동시에 보이던 문제를
  `hideBodyWhenNotEditing`으로 해소) —
  (`docs/wordpress-blog-card-ui-rules.md`의 "wordpress_blog 카드는
  본문을 두 번(카드 상단 + 탭) 중복 표시하지 않는다 (Phase 4-23)"
  섹션 참고).
- **본문 관련 버튼([본문 복사]/[전체 보기]·[본문 접기]/[본문
  수정])은 카드마다 다른 위치에 흩어놓지 않고, 항상 같은 줄·같은
  순서로 모아 둔다.** 순서는 [본문 복사] → [전체 보기]/[본문
  접기](필요할 때만) → [본문 수정]. 본문이 짧아 펼칠 필요가 없으면
  [전체 보기]는 비활성화가 아니라 아예 렌더링하지 않는다. 실제 사례:
  `components/social/post-body-action-row.tsx`
  (`docs/wordpress-blog-card-ui-rules.md`의 "본문 관련 버튼은 항상
  한 줄, 같은 순서로 배치한다 (Phase 4-27)" 섹션 참고).
- **자동 검토 "수정 필요" 중, AI가 사용자 확인 없이 안전하게 고칠
  수 있는 문제(auto_fixable)는 사람에게 먼저 고치라고 요구하지
  않는다.** 남은 문제 전부가 auto_fixable(+ 실제 구현된 자동
  수정기)이면 글 생성 직후 자동으로 정리·재검토하고, 카드의 기본
  버튼도 [자동 수정 후 재검토]로 승격한다. 출처/수치/날짜/기관명처럼
  사실 확인이 필요한 문제(user_confirmation_required)는 AI가 임의로
  채우지 않고 항상 사용자 확인 항목으로 남긴다. 자동 수정·재검토는
  시스템이 하고, 최종 승인은 항상 사용자가 한다(approval_status를
  자동으로 바꾸지 않는다). 실제 사례:
  `lib/social/review-issue-fixability.ts`,
  `lib/social/post-auto-fix-service.ts`
  (`docs/phase-3-operation-manual.md`의 "자동 검토 '수정 필요'를 글
  생성 직후 자동으로 정리 (Phase 4-28)" 섹션 참고).
- **승인 완료(approval_status === "approved") 상태에서는 [승인] 버튼을
  다시 primary로 보여주지 않는다 — 승인 완료 카드에는 반드시 "다음
  작업" 버튼을 함께 표시한다.** "아래에서 다음 작업을 진행하세요"처럼
  실제 버튼 위치가 불명확한 문구만 남기지 않는다 — 안내 문장과 버튼을
  같은 카드 안에 붙여 놓는다. 다음 작업은 플랫폼별로 다르게 계산하고
  (`getPostApprovalNextActions`), 계산 결과가 있어도 [본문 복사]는
  항상 안전한 fallback으로 포함해 승인 완료 상태에서 버튼이 하나도
  없는 화면이 생기지 않게 한다. 아직 구현되지 않은 기능(예: 네이버
  카페/X/Threads/Instagram 실제 API 게시)을 가리키는 동작하지 않는
  버튼은 만들지 않는다 — 대신 실제로 존재하는 화면(API 게시 준비
  상태 확인 등)으로 안내한다. 실제 사례:
  `lib/social/post-approval-next-actions.ts`,
  `app/social-posts/[id]/page.tsx`.
- **플랫폼마다 "게시용 본문"의 실제 형식이 다르면(markdown 허용
  플랫폼 vs plain text 전용 플랫폼), 저장/표시/export 시점에 각
  플랫폼에 맞는 형식으로 정리한다.** naver_cafe처럼 plain text 전용
  플랫폼에 AI가 markdown 습관(escape된 `#`/`**`, HTML entity 등)을
  남기는 것은 프롬프트만으로 100% 막을 수 없다 — 별도의 정리 함수를
  저장 전/표시 전/export 전 모든 지점에 일관되게 적용한다. 실제 사례:
  `lib/social/naver-cafe-plain-text-sanitizer.ts`
  (`docs/phase-3-20-naver-cafe-plain-text-cleanup.md` 참고).
- **"전체 생성"/"전체 게시"처럼 API 사용량이나 비용이 커질 수 있는
  일괄 작업은 메인 버튼으로 두지 않는다.** 기본 흐름은 항상 "필요한
  항목만 선택"이며, 전체 처리는 고급 옵션(secondary/outline 버튼, 접힌
  섹션)으로 제공하고 실행 전 확인 모달로 비용/영향 범위를 안내한다.
  플랫폼(어디에 올릴 글인가)과 문체/톤(어떤 방식으로 말할 것인가)도
  서로 다른 축으로 분리해서 선택하게 한다 — 기본값은 "추천 값 자동
  적용"이다. 실제 사례: `app/articles/[id]/page.tsx`의 "플랫폼별 글
  생성" 섹션 (`docs/phase-3-21-platform-generation-flow.md` 참고).
- **내부 상태값(quality_status/approval_status/export_status 등)을
  화면에 그대로 나열하지 않는다.** 사용자가 이해할 수 있는 한 줄
  문구("현재 검토가 필요합니다")로 바꾸고, 지금 눌러야 할 버튼 하나만
  강조(primary 스타일)하며 나머지는 secondary로 낮춘다. 원문 상태값과
  보조 작업(Publishing Guard/Dry-run/Handoff 등)은 "상세 상태 보기"
  접힘 안으로 옮기되 삭제하지 않는다. 콘텐츠 생성 흐름 화면
  (테마/원고/블로그/SNS) 상단에는 "테마 선택 → 출처 입력 → 글 생성 →
  검토/승인 → 게시 준비" 5단계 진행 표시를 공통으로 둔다(성과/rewrite
  화면은 별도 작업이라 이 표시에서 제외한다). 실제 사례:
  `lib/social/social-post-user-facing-status.ts`,
  `components/articles/content-progress-steps.tsx`
  (`docs/phase-3-22-user-facing-status-simplification.md` 참고).

## 관련 문서

- [`docs/ui-review-agent-checklist.md`](./ui-review-agent-checklist.md) — UI 수정 후 자체 점검 체크리스트
- [`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) — wordpress_blog 카드 전용 UI 구조 규칙
- [`docs/ui-audit-wordpress-blog-card.md`](./ui-audit-wordpress-blog-card.md) — 현재 wordpress_blog 카드 UI 점검 결과
- [`docs/article-blog-wordpress-workflow.md`](./article-blog-wordpress-workflow.md) — wordpress_blog 게시 준비 워크플로우 구현 상세
- [`docs/phase-1-16-theme-candidate-deduplication.md`](./phase-1-16-theme-candidate-deduplication.md) — 공통 테마 후보 중복 방지(저장 단계 upsert + 화면 표시 단계 대표 후보 그룹핑)
- [`docs/phase-1-18-theme-card-description-layout.md`](./phase-1-18-theme-card-description-layout.md) — 테마 후보 카드 제목/설명 레이아웃 개선
- [`docs/phase-1-21-theme-selection-focused-ui.md`](./phase-1-21-theme-selection-focused-ui.md) — 자동 테마 추출 화면을 "대표 테마 선택 중심 UI"로 개편
- [`docs/phase-1-22-dashboard-top-nav-simplification.md`](./phase-1-22-dashboard-top-nav-simplification.md) — 상단 내비게이션 단순화(드롭다운 메뉴 구조)
- [`docs/phase-1-23-dashboard-theme-workspace.md`](./phase-1-23-dashboard-theme-workspace.md) — 대시보드를 "선택한 테마 중심 작업형 대시보드"로 개편
- [`docs/phase-2-22-article-generation-regeneration-confirmation.md`](./phase-2-22-article-generation-regeneration-confirmation.md) — 기사초안 재생성 무반응 방지 + article mode 전환 확인 배너
- [`docs/phase-2-23-wordpress-draft-approval-status-clarity.md`](./phase-2-23-wordpress-draft-approval-status-clarity.md) — WordPress Draft 반영 승인 조건 명확화(reviewed/승인 용어 혼동 정리)
- [`docs/phase-2-20-article-wordpress-publish-preparation-automation.md`](./phase-2-20-article-wordpress-publish-preparation-automation.md) — article 고급 기능 WordPress 게시 준비 자동화(여러 클릭 → 자동 실행 1회 + 검토/승인)
- [`docs/phase-2-24-monetized-blog-structure-enhancement.md`](./phase-2-24-monetized-blog-structure-enhancement.md) — 수익형 블로그 구조 강화(요약 박스 HTML/표/체크리스트/FAQ 4개/기준일 안내)
- [`docs/phase-3-20-naver-cafe-plain-text-cleanup.md`](./phase-3-20-naver-cafe-plain-text-cleanup.md) — naver_cafe plain text 정리 + 게시용 본문/관리 정보 분리(관리 정보 accordion)
- [`docs/phase-3-21-platform-generation-flow.md`](./phase-3-21-platform-generation-flow.md) — "테마 → 출처 → 플랫폼별 글 생성" 흐름 재정의(선택/전체 생성, 추천 플랫폼/문체)
- [`docs/phase-3-22-user-facing-status-simplification.md`](./phase-3-22-user-facing-status-simplification.md) — 사용자 플랫폼 UI를 "행동 중심"으로 정리(진행 단계 표시, 상태 문구 번역, 카드당 주요 버튼 하나)
- [`docs/phase-3-23-dashboard-workflow-ui.md`](./phase-3-23-dashboard-workflow-ui.md) — 대시보드를 "작업 흐름 중심 화면"으로 재구성(현재 상태/다음 작업 카드 확장, 대시보드 내 플랫폼별 글 생성 섹션 신설, 4순위 정보 접힘 이동)
- [`docs/phase-3-23-2-dashboard-workflow-state-unification.md`](./phase-3-23-2-dashboard-workflow-state-unification.md) — 대시보드 상태 판단을 workflowState 하나로 통합, 이전 단계 섹션 접힘, 대시보드 내 플랫폼 생성 결과 표시, 중복 CTA 제거, 색상 체계/접근성/article! 제거
- [`docs/phase-3-23-4-dashboard-current-step-spotlight.md`](./phase-3-23-4-dashboard-current-step-spotlight.md) — 대시보드를 "현재 단계 스포트라이트 + 다른 단계 접힘" 구조로 재구성, 게시 준비 섹션 신설, 플랫폼별 글 생성 카드화, 출처 목록/새 초안 폼 축소, 테마 목록 구분(출처/단계/날짜)

**현재 단계 스포트라이트 원칙(Phase 3-23-4, 반드시 준수)**:
- 화면에는 항상 "지금 사용자가 봐야 하는 현재 단계" 관리 영역 하나만
  크게 펼쳐서 보여준다(`getDashboardCurrentStepArea`). 나머지 관리
  영역은 삭제하지 않고 하나의 접힘 accordion으로 모은다.
- 목록류 정보(출처 목록 등)는 워크플로 상태와 무관하게 항상 기본
  압축(개수 + 최근 1~2개 미리보기 + "전체 보기" 토글)으로 표시한다.
- 이미 결과물이 있는 조작 폼(예: 이미 초안이 있을 때의 기사 생성
  라디오)은 기본 숨김이고, 사용자가 명시적으로 펼쳐야 다시 보인다.
- 비용이 늘어날 수 있는 일괄/전체 실행 옵션은 항상 접힘(고급 옵션)
  안에 두고, 실행 전 확인 모달을 유지한다.

**대시보드 상태 판단 원칙(Phase 3-23-2, 반드시 준수)**:
- 대시보드의 상태 판단 기준은 `resolveDashboardWorkflowState`(과 그 결과인
  `DashboardWorkflowState`) 하나뿐이어야 한다. 이와 별도로 중복되는 상태
  판단 함수/변수(예전의 `resolveNextActionState`류)를 새로 만들지 않는다.
- "현재 상태 / 다음 작업" 카드의 문구/색상/CTA는 반드시
  `lib/dashboard/dashboard-workflow-presentation.ts`의 순수 함수
  (`getDashboardStatusSummary`/`getWorkflowStateTone`/
  `getDashboardSectionExpansion`)를 거쳐서만 렌더링한다. 페이지 컴포넌트에
  상태별 문구를 하드코딩하지 않는다.
- 현재 단계 이전 섹션(이미 끝난 작업의 조작용 폼/목록)은 삭제하지 않고
  `<details open={...}>`로 감싸 기본 접힘 처리한다.
- 화면 안에서 실행한 액션의 결과는 원칙적으로 같은 화면으로 돌아와
  확인할 수 있어야 한다(`returnTo` allowlist는 필요한 만큼만, 내부
  경로로만 넓힌다 — `lib/navigation/return-to.ts` 참고).
- 같은 의미의 CTA를 한 화면에 두 번 강조하지 않는다.
- 앵커(`#...`)로 이동하는 대상 요소는 `tabIndex={-1}`을 부여해 키보드/
  스크린리더 사용자도 이동을 인지할 수 있게 한다.

## 섹션 12. 준비 단계 자동화 규칙

여러 개별 생성/준비 버튼(metadata 생성, SEO 생성, 이미지 생성 등)을
순서대로 눌러야 하는 화면은, 그 전체를 한 번에 실행하는 자동화
오케스트레이터 + 버튼 하나로 통합할 수 있다. 이때 지킬 것:

- **자동 실행은 이미 있는 값을 기본적으로 덮어쓰지 않는다.** 값이
  없을 때만 생성하고, 재생성/덮어쓰기는 명시적 옵션(체크박스 등)으로
  분리한다.
- **선택 사항(대표 이미지 등) 하나가 준비되지 않았다는 이유만으로
  전체 자동 실행을 실패로 표시하지 않는다.** 실패해도 되는 단계는
  warning으로 남기고, 자동으로 안전한 대체 상태(예: "이미지 없음으로
  진행 가능" waiver)를 적용한다.
- **실제 외부 시스템에 반영(공개 게시 등 되돌리기 어려운 작업)은 이
  자동화 범위에 포함하지 않는다.** 자동 실행은 항상 "준비" 단계까지만
  다루고, 실제 반영은 사람이 별도 버튼으로 눌러야 한다.
- **자동 실행 버튼은 기존 개별 버튼들 위(먼저 보이는 위치)에 둔다.**
  기존 개별 버튼은 삭제하지 않고 "자동 실행이 사용하는 개별 기능/고급
  옵션"으로 안내 문구만 바꾼다.
- 실제 사례:
  [`docs/phase-2-20-article-wordpress-publish-preparation-automation.md`](./phase-2-20-article-wordpress-publish-preparation-automation.md).

## 페이지 간 일관성 원칙 (Phase 3-24, 반드시 준수)

`/dashboard`, `/articles/[id]/blog`, `/trends`처럼 이미 다듬어진 페이지가
있어도, 그 패턴이 자동으로 다른 페이지에 퍼지지 않는다 — 새 페이지를
만들거나 기존 페이지를 고칠 때마다 아래 원칙을 명시적으로 적용해야 한다
(`docs/ui-review-agent-checklist.md`의 체크리스트로 기계적으로도 확인한다).

1. **raw enum/DB 컬럼명을 기본 UI에 그대로 노출하지 않는다.** 플랫폼/
   문체는 `lib/social/platform-generation-recommendations.ts`의
   `PLATFORM_LABELS`와 `lib/social/tone-style-config.ts`의
   `TONE_STYLE_CONFIGS[...].label`을 쓴다. 그 외 상태값/DB 필드명은
   `lib/social/status-labels.ts`의 `describeStatusValue`/
   `describeStatusField`를 쓴다 — 새 상태값이 필요하면 각 페이지에서
   개별적으로 문자열을 나열하지 않고 이 파일 하나에 추가한다.
2. **내부 상태값/로그/raw payload/DB 필드명은 "내부 상태값 보기" 또는
   "상세 상태 보기" 접힘 영역 안에 둔다.** 접힘 안이라 해도 라벨은
   1번 규칙대로 한국어로 바꾼다(숨겨져 있다고 raw 그대로 둬도 되는 것은
   아니다).
3. **disabled 버튼은 반드시 이유를 표시한다.** `title` 속성(hover)뿐
   아니라 항상 보이는 텍스트로도 알려준다 — 하나의 카드에 disabled
   버튼이 여러 개면 어떤 버튼의 이유인지 라벨을 붙여 구분한다(예:
   "재승인 요청: 이미 재승인 요청이 진행 중입니다.").
4. **`placeholder`/`dry-run`/`handoff`/`readiness`/`metrics` 같은
   개발자 용어를 사용자 친화적 한국어로 바꾼다**(예: dry-run → 게시 전
   미리보기, handoff → 수동 게시 준비, placeholder 초안 → 임시 초안).
   완전히 없앨 수 없는 경우(예: "성과 입력"처럼 metrics의 의미를
   대체하기 애매한 경우) 최소한 사용자 안내 문장에서는 원어를 쓰지
   않는다.
5. **페이지 제목(`<h1>`)과 섹션 제목(`<h2>`)은 한국어로 통일한다.**
   "관리자/개발자용 화면이라 영어여도 된다"는 예외를 두지 않는다 —
   `/dashboard/*` 서브 대시보드 6개도 예외가 아니다.
6. **각 카드의 주요 버튼은 하나만 강조한다.** 상태별 다음 작업을
   계산하는 `getXxxNextAction` 류 순수 함수(예:
   `lib/social/social-post-user-facing-status.ts`,
   `lib/social/rewrite-version-user-facing-status.ts`)를 만들어 그
   결과로 `primaryClass`/`secondaryClass`를 나눈다 — 상태별로 매번
   직접 조건문을 나열하지 않는다.
7. 위 원칙을 페이지 전체에 한 번에 적용하기 부담스러우면, 최소한
   **새로 만들거나 지금 수정 중인 페이지에는 반드시 적용**한다 — "좋은
   패턴이 일부에만 있고 퍼지지 않는" 문제를 새로 만들지 않는다.

실제 적용 사례(무엇이 왜 부족했고 어떻게 고쳤는지):
[`docs/phase-3-24-cross-page-ux-consistency.md`](./phase-3-24-cross-page-ux-consistency.md).

## 검토는 "자동 검토 + 사람은 편집자" 원칙 (Phase 3-25)

글 생성 후 검토는 사람이 quality_status/approval_status 등 모든 raw
상태값을 하나씩 직접 확인하는 방식이 아니라, 시스템이 먼저 자동
검토하고(`lib/social/social-post-auto-review.ts`의 `summarizeAutoReview`)
사람은 "통과/확인 필요/수정 필요/차단" 리포트와 게시용 본문을 확인한
뒤 최종 승인하는 흐름을 따른다.

- 승인 가능 여부는 raw `quality_status === 'ready'` 정확히 일치가
  아니라, checklist에 blocked/fail 항목이 있는지로 판단한다(경고만
  있는 "확인 필요"는 승인을 막지 않는다) —
  `lib/social/social-post-approval-service.ts`의 `checkApprovable`.
- 자동 검토 리포트는 항상 이미 저장된 quality gate checklist로부터
  다시 계산하는 순수 함수로 만든다 — 검토 결과를 저장하는 새 테이블/
  컬럼을 만들지 않는다.
- 자동 검토가 통과해도 최종 승인은 여전히 사람이 버튼을 눌러야 한다
  — 자동 검토는 승인을 대체하지 않는다.
- 실제 적용 사례: [`docs/phase-3-25-auto-review-editor-workflow.md`](./phase-3-25-auto-review-editor-workflow.md).

## 단일 글 최종 검토·수정·승인 화면 원칙 (Phase 3-26)

`/social-posts/[id]`는 social_post 하나의 상세 정보를 보여주기만 하는
읽기 전용 화면이 아니라 **단일 글을 최종 검토·수정·승인하는 화면**이다.
같은 성격의 화면(글 하나를 확정하는 화면)을 만들 때는 다음 원칙을
따른다.

- 기본으로 보여주는 본문 화면은 항상 **게시용 미리보기**다(raw
  markdown/HTML/JSON을 그대로 보여주지 않고, 실제 게시 형태에 가깝게
  렌더링한다). 내부 원문(raw body/상태값)은 기본 노출하지 않고, 사용자가
  명시적으로 선택해야 보이는 탭/접힘 안에 둔다.
- 자동 검토 리포트는 반드시 수정 흐름과 연결한다 — 각 이슈에 "수정하기"
  같은 다음 행동 링크가 있어야 한다.
- 수정 후에는 재검토가 필요하다는 사실을 화면에 명확히 표시한다(가능하면
  기존 서비스 로직이 이미 상태를 초기화하는지 먼저 확인하고, 새 상태
  저장소를 만들기 전에 그 기존 동작을 표시만 하는 방법을 먼저 찾는다).
- 자동 검토는 최종 승인을 대체하지 않는다 — 승인 버튼은 항상 사람이
  직접 눌러야 한다.
- 최종 승인 전에는 export/Draft 반영을 차단한다.
- 자동 public publish는 이번에도, 앞으로도 추가하지 않는다.
- 실제 적용 사례: [`docs/phase-3-26-social-post-review-workspace.md`](./phase-3-26-social-post-review-workspace.md).

## 비동기 작업(검색/수집 등) 버튼은 결과 요약 + 다음 행동을 반드시 보여준다 (Phase 3-27)

시간이 걸리는 작업(외부 API 검색/수집 등)을 실행하는 버튼은 눌러도
"조용히 페이지가 다시 그려지는" 것으로 끝내지 않는다. 관련 기사 URL
수집처럼 "실행 → 완료까지 몇 초 걸리는 → 몇 건 찾았는지 알아야
다음 행동을 정할 수 있는" 작업은 항상 다음 3단계를 갖춘다.

- **실행 중 상태**: 버튼을 disabled로 바꾸고 "OO 중..." 문구를
  보여준다(`components/ui/pending-submit-button.tsx`의
  `useFormStatus` 기반 최소 클라이언트 래퍼 재사용 — 폼/페이지
  자체를 클라이언트 컴포넌트로 바꾸지 않는다).
- **결과 요약**: 성공/부분 성공/결과 없음/실패를 각각 다른 문구로
  보여준다. 새로 찾은 개수/중복 개수 같은 숫자는 보여주되, raw
  status나 API 응답 원문은 노출하지 않는다.
- **다음 행동 선택**: "추가로 실행"/"이 결과 확인"/"다음 단계로
  진행"/"이전 화면으로 돌아가기" 같은 선택지를 버튼으로 제시하고,
  상황에 맞는 것 하나만 primary로 강조한다(여러 개가 동시에
  강조되지 않게 한다).
- 결과는 DB에 새로 저장하지 않고 action의 redirect query string으로
  페이지에 전달한다(새로고침하면 결과 카드가 사라지는 것이 의도된
  동작이다) — 이 화면 전용 저장소를 새로 만들지 않는다.
- 실제 적용 사례: [`docs/phase-3-27-related-url-collection-feedback.md`](./phase-3-27-related-url-collection-feedback.md).

## "article"이 아니라 "마스터 원고"라는 사용자 표현을 쓴다 (Phase 4-1)

사용자에게 보이는 화면에서는 내부 개념 `article`/`article mode`
대신 "마스터 원고"/"원고 생성 방향"이라는 표현을 쓴다. 마스터
원고는 그 자체로 최종 게시글이 아니라, 플랫폼별 글을 만들기 위한
출처 기반 편집 자료라는 점을 안내문으로 분명히 한다.

- 여러 생성 방향 중 하나를 처음부터 강제로 고르게 하지 않는다 —
  기본값은 "자동 추천"이고, 세부 방향 선택은 "고급 옵션" 뒤에 둔다
  (버튼/라디오가 많아 보이는 화면을 피한다).
- 내부 enum/DB 값은 이 원칙 때문에 함부로 늘리거나 바꾸지 않는다 —
  "자동 추천" 같은 UI 전용 선택지는 서버가 실제 값으로 변환한 뒤에만
  저장한다(`resolveMasterManuscriptDirection` 참고).
- 기존 내부 라벨(`ArticleModeConfig.label`, eval/prompt 파일과
  짝지어진 표기)은 그대로 두고, 사용자 표현은 별도 매핑 함수로
  분리한다 — 한쪽을 바꾼다고 다른 쪽(문서/파일명 참조)이 깨지지
  않게 하기 위함이다.

## 자동테마 후보(merged/duplicate)는 "선택 불가"로 끝내지 않는다 (Phase 1-24)

`/trends`의 공통 테마 후보는 항상 4가지 상태 중 하나로 분류되어 표시된다
(내부 값은 사용자에게 노출하지 않고 한국어 라벨만 보여준다):
신규 테마 / 기존 테마 업데이트 / 중복 테마 / 확인 필요. 자세한 판단
기준은 [`docs/theme-candidate-deduplication.md`](./theme-candidate-deduplication.md)를 따른다.

- **병합된(merged) 후보를 클릭했을 때 아무 반응도 없거나 disabled
  버튼만 보여주는 것을 금지한다.** 이 후보가 대표 테마로 병합된
  이유를 문장으로 보여주고, [대표 테마 선택]/[대표 테마 보기] 같은
  대체 행동을 반드시 함께 제공한다(`MergedCandidateRow`).
- **중복(duplicate) 후보도 숨기지 않는다.** 왜 중복으로 판단했는지
  보여주고, [기존 테마 보기]/[다시 표시하지 않기]를 제공한다.
  "다시 표시하지 않기"는 soft 처리(`theme_clusters.status =
  'dismissed'`)이며 raw 데이터를 삭제하지 않는다.
- **확인 필요(needs_review) 후보는 사람이 판단할 수 있게 차이를
  보여준다.** 기존 테마와 오늘 후보의 설명/공통 키워드/차이 키워드를
  나란히 보여주고, [기존 테마에 추가]/[새 테마로 만들기]/[기존 테마
  보기] 중에서 사용자가 직접 고르게 한다 — 자동으로 병합하거나
  자동으로 새 테마로 만들지 않는다.
- 카드 하나에는 상태에 맞는 primary action **하나만** 강조한다(나머지는
  보조 버튼).
- 같은 제목의 테마가 여러 개 보일 수 있는 화면(테마 목록, 자동테마
  결과)에서는 항상 출처 수/상태/최근 갱신일 같은 구분 정보를 함께
  보여준다 — 제목만으로 구분하게 하지 않는다.
- 실제 적용 사례: [`docs/phase-4-1-master-manuscript-terminology.md`](./phase-4-1-master-manuscript-terminology.md), [`docs/phase-4-2-platform-brief-structuring.md`](./phase-4-2-platform-brief-structuring.md)(마스터 원고를 구조화된 platformBrief로 계산 — AI를 다시 호출하지 않는 결정적 계산이라는 점이 특히 이 원칙과 관련 있다), [`docs/phase-4-3-news-article-platform.md`](./phase-4-3-news-article-platform.md)(플랫폼 하나를 추가할 때 exhaustive `Record`/`switch`를 그대로 따라가며 채우는 방법), [`docs/phase-4-4-master-manuscript-cost-and-rollout.md`](./phase-4-4-master-manuscript-cost-and-rollout.md)(마스터 원고 구조화 데이터를 처음으로 화면에 노출하면서도 개수 요약 + 펼치기로만 보여준 사례), [`docs/master-manuscript-generation-strategy.md`](./master-manuscript-generation-strategy.md)(사실과 해석을 분리하고, 확인 필요 사항을 확인된 사실과 절대 섞지 않는 구조 — "확인되지 않은 내용을 단정하지 않는다" 원칙을 데이터 구조 수준에서 강제한 사례).

## 글 유형(platform/contentType)별로 다른 검토 기준을 적용한다 (Phase 4-5)

하나의 기준으로 모든 글을 평가하지 않는다. 자동 검토(quality gate,
`lib/social/social-quality-gate.ts`)는 이미 `switch (platform)`로 완전히
분리되어 있고, 마스터 원고(원고) 레벨도 `ArticleMode`별 별도 eval
기준 파일을 쓴다 — 새 플랫폼/모드를 추가할 때도 이 분리를 깨지 않는다.

- **기사 본문(news_article)에는 FAQ, 체크리스트, 광고 배치 기준을
  강제하지 않는다** — 그 기준은 wordpress_blog 전용이다.
- **칼럼(opinion_column)에는 중립적 사실 전달 기준(리드문/육하원칙)만
  으로 평가하지 않는다** — 관점/사실-의견 구분/반론·한계를 본다.
- **블로그 글(wordpress_blog)에는 기사 기준(리드문/육하원칙)만 보고
  통과 처리하지 않는다** — SEO 구조/요약 박스/FAQ/체크리스트를 본다.
- 자동 검토 리포트에는 **글 유형과 적용된 검토 기준을 항상 먼저**
  보여준다(`getPlatformReviewCriteria`, "글 유형: OO · 검토 기준: ...").
  raw enum(`opinion_column` 등)을 그대로 노출하지 않고 `PLATFORM_LABELS`
  한국어 라벨만 쓴다.
- 글 유형과 실제 본문 형태가 서로 다른 기준을 요구하는 조합으로 보이면
  (예: news_article로 설정했는데 본문이 칼럼형 해설문) "글 유형 확인
  필요"로 표시하고, 무반응으로 끝내지 않고 수정 탭 등 다음 행동을
  제공한다(`detectContentTypeMismatch`). 불확실한 경우까지 매번
  경고하지 않는다 — 정반대 기준을 요구하는 조합만 다룬다.
- 자동 검토는 최종 승인을 대체하지 않는다 — 새 플랫폼(opinion_column
  등)을 추가해도 이 원칙과 자동 public publish 금지 원칙은 그대로다.
- 실제 적용 사례: [`docs/phase-4-5-content-type-review-separation.md`](./phase-4-5-content-type-review-separation.md).

## 개발자·운영자용 정보는 기본 글쓰기 UI에 노출하지 않는다 (Phase 4-6)

기능은 유지하되, 일반 사용자가 글을 작성·검토·승인하는 기본 화면에는
"준비됐는지 / 반영됐는지 / 다음에 무엇을 할지"만 보여준다.

- raw env 이름(`SEO_PLUGIN_PROVIDER`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED`
  등), provider enum, endpoint path, internal id, raw DB status, raw
  payload/JSON은 기본 화면에 그대로 노출하지 않는다.
- "SEO Plugin Actual Write", "Custom Endpoint" 같은 개발자용 기능
  이름은 영어 그대로 기본 화면 제목으로 쓰지 않는다 — "SEO 정보 반영
  상태"처럼 사용자 친화적 표현으로 바꾸고, 원래 이름/raw 값은 "SEO
  반영 상세 보기"/"내부 상태값 보기"/"고급 설정 보기" 같은 `<details>`
  (기본 닫힘) 안에서만 보여준다.
- 상태 카드 하나에는 primary action **하나만** 강조한다(상태별로
  [SEO 정보 생성]/[SEO 정보 반영하기]/[반영 상태 확인]/[WordPress
  Draft 보기]/[다시 시도] 중 하나).
- 기능 자체(actual write/custom endpoint 등)는 절대 삭제하지 않는다 —
  화면 배치만 "요약 먼저, 상세는 접어서"로 바꾼다.
- 실제 적용 사례: [`docs/phase-4-6-developer-info-hiding.md`](./phase-4-6-developer-info-hiding.md).

## WordPress Media Upload / Connection Test도 같은 원칙으로 숨긴다 (Phase 4-7)

"Step 2. WordPress Media Upload", "WordPress Connection Test" 같은
개발·운영자용 테스트 영역도 Phase 4-6과 동일한 원칙을 따른다.

- 기본 화면에는 "대표 이미지 업로드 상태"/"WordPress 연결 상태"라는
  사용자 친화적 제목과 짧은 안내 문장만 보여준다.
- `WORDPRESS_MEDIA_UPLOAD_ENABLED`, `WORDPRESS_PUBLISH_ENABLED`, base
  URL, `publish enabled`/`media upload enabled` raw 값, WordPress
  media id/upload payload 같은 raw 정보는 "이미지 업로드 상세
  보기"/"WordPress 연결 상세 보기" `<details>`(기본 닫힘) 안으로
  옮긴다.
- "WordPress 이미지 업로드 테스트", "WordPress 연결 테스트" 같은
  개발자용 버튼명은 기본 화면의 primary action으로 쓰지 않는다 —
  기본 화면에는 "연결 상태 확인" 같은 사용자 표현을 쓰고, 원래
  버튼은 접힘 안에서 그대로 동작한다.
- Application Password, Authorization header, API key는 기본 화면은
  물론 접힘 영역 안에서도 절대 표시하지 않는다.
- WordPress 연결/승인/대표 이미지/SEO 상태를 하나로 묶은 "WordPress
  게시 준비" 요약 카드에는 primary action 하나만 강조한다.
- 실제 적용 사례: [`docs/phase-4-7-wordpress-media-connection-test-hiding.md`](./phase-4-7-wordpress-media-connection-test-hiding.md).

## 상태 배지가 "다음 행동 패널"을 가리지 않게 한다 (Phase 1-25)

`isSelected`/`isDismissed`처럼 카드 자체의 상태를 나타내는 플래그와,
`classification`처럼 "지금 무엇을 할 수 있는지"를 나타내는 분류는
서로 다른 축이다 — 하나가 다른 하나를 무조건 가려서는 안 된다.

- "이미 저장됨/선택됨" 같은 완료 배지는 **정보로만** 표시하고, 그
  때문에 다른 분류(기존 테마 업데이트/중복/확인 필요)에 맞는 행동
  패널이 통째로 사라지게 하지 않는다 — 예: 어떤 후보에서 이미 테마가
  만들어졌어도, 오늘 그 테마에 추가할 새 자료가 있으면 "기존 테마에
  추가" 패널은 계속 보여야 한다.
- "완료됨" 하나만 표시하고 끝나는 화면(예: "✓ 테마로 저장됨" 단독
  문구)은 만들지 않는다 — 완료 배지 + 분류별 다음 행동 패널을 함께
  보여주거나, 정말 더 할 일이 없을 때만 완료 화면에도 최소 하나의
  링크(예: 대시보드로 이동)를 둔다.
- 실제 적용 사례: [`docs/theme-candidate-deduplication.md`](./theme-candidate-deduplication.md)의 "Phase 1-25" 섹션(existing_theme_update 후보가 "✓ 테마로 저장됨"으로만 끝나던 버그 수정).

## 마스터 원고는 최종 게시글이 아니다 (Phase 4-8)

마스터 원고(`MasterManuscript`) 화면 표시는 항상 "이건 참고 자료일
뿐, 그대로 게시하지 않는다"는 사실을 안내 문구로 함께 보여준다.

- "마스터 원고 정보" 섹션에는 출처 요약/확인된 사실/근거 연결
  (evidenceMap)/확인 필요 사항/쟁점 개수와 함께, 마스터 원고 자체의
  자동 검토 상태(아직 없음/출처 부족/재생성 권장/확인 필요/준비
  완료 · 플랫폼 변환 가능)를 한국어 배지로 보여준다
  (`reviewMasterManuscript`, raw status 값을 직접 노출하지 않는다).
- 이 검토가 "준비 완료"여도 플랫폼별 글(social_posts)의 자동 검토와
  최종 승인은 각각 별도로 진행한다 — 하나의 검토가 다른 검토나 사람의
  승인을 대체하지 않는다.
- 플랫폼별 글 생성에는 마스터 원고 전체가 아니라 해당 플랫폼의
  `platformBrief` + 근거 하이라이트(evidenceHighlights, 최대 4건)만
  전달한다 — 다른 플랫폼 brief나 마스터 원고 전체를 반복 투입하지
  않는다.
- 실제 적용 사례: [`docs/phase-4-8-master-manuscript-evidence-quality.md`](./phase-4-8-master-manuscript-evidence-quality.md).

## AI 응답/마스터 원고의 배열 필드는 항상 누락될 수 있다고 가정한다 (Phase 4-9)

마스터 원고 구조는 앞으로도 계속 확장될 수 있고, 이미 저장된 원고는
새 필드를 갖고 있지 않다 — "지금 타입에 있으니 항상 값이 있다"고
가정하지 않는다.

- `sourceSummaries`, `verifiedFacts`, `evidenceMap`, `issues`,
  `readerMeaning`, `verificationNeeded`, `reviewIssues`/`checklist`
  같은 배열 필드는 사용하기 전에 항상 `Array.isArray`로 검증한다
  (`lib/utils/safe-array.ts`의 `asArray()` 재사용). `value || []`만으로
  처리하지 않는다 — 객체나 문자열처럼 falsy가 아닌 잘못된 값에는
  안전하지 않기 때문이다.
- 저장된 값을 읽는 지점(예: `readArticleMasterManuscript`)에서
  정규화 함수(`normalizeMasterManuscript`)를 한 번 거치게 해서, 이후
  모든 소비자가 "필드가 없을 수도 있다"를 매번 확인하지 않아도 되게
  한다.
- undefined/null 값 때문에 페이지 전체가 깨지면 안 된다 — 서비스
  계층은 예외를 throw해서 화면을 죽이지 않고, 항상 `{ success:
  false, message }` 같은 구조화된 결과를 반환한다.
- raw JavaScript 에러 메시지("Cannot read properties of undefined
  (reading 'filter')" 등)는 기본 화면에 그대로 노출하지 않는다 —
  `describeUnexpectedError()`로 사용자 친화적 메시지로 바꾸고, 원문은
  로그에만 남긴다.
- 실제 적용 사례: [`docs/phase-4-9-master-manuscript-undefined-filter-fix.md`](./phase-4-9-master-manuscript-undefined-filter-fix.md).

## 여러 버튼으로 나뉜 승인/실행 흐름은 안전하게 합칠 수 있으면 합친다 (Phase 4-10)

승인 → 실행이 각각 별도 버튼으로 나뉘어 있으면 사용자가 매번 같은
순서를 반복 클릭해야 한다. 뒤 단계가 앞 단계의 상태를 그대로
확인하는 구조라면(승인 실패 시 실행을 시도하지 않는 등), 두 동작을
하나의 버튼/함수로 합쳐 클릭 수를 줄인다.

- 합친 버튼도 각 단계의 개별 안전 조건(quality gate, approval 조건
  등)을 그대로 거쳐야 한다 — 합쳤다고 조건을 느슨하게 하지 않는다.
- 부가적인(실패해도 안전한) 단계는 전체를 막지 않고 "부분
  성공"으로 표시하되, 핵심 단계는 여전히 전체를 막는다.
- 합친 버튼은 이미 완료된 상태(예: 이미 승인됨)에서는 화면에서
  숨기고, 그 상태에 맞는 기존 버튼만 남긴다 — 같은 화면에 중복되는
  두 버튼을 동시에 보여주지 않는다.
- 실제 적용 사례: [`docs/phase-4-10-wordpress-auto-publishing-preparation.md`](./phase-4-10-wordpress-auto-publishing-preparation.md).

## 게시 준비 화면은 "현재 상태 + 남은 작업 + 다음 버튼 1개"로 정리한다 (Phase 4-13)

여러 단계를 거쳐야 하는 게시 준비 화면(WordPress 등)에서 버튼을
전부 나열하면 사용자가 순서를 기억해야 한다. 대신:

- 완료된 작업은 버튼이 아니라 상태 배지로 표시한다(`approval_status
  === "approved"`처럼 이미 끝난 조건의 버튼은 기본 화면에 다시
  보여주지 않는다).
- 차단 이유(guard blocked 등)가 있으면 "반영/게시" primary 버튼
  대신 그 이유를 해결하는 버튼을 primary로 보여준다.
- primary action은 항상 하나만 계산한다(우선순위 규칙으로 첫 번째
  미충족 조건을 고른다). 나머지 미충족 조건은 secondary action으로
  낮춘다.
- 고급/수동/개발자용 기능은 삭제하지 않고 접힘 영역("고급 작업
  보기" 등)으로 옮긴다.
- 상단 버튼 목록과 중간 primary 버튼의 의미가 겹치면 하나로
  합친다(같은 화면에 사실상 같은 일을 하는 버튼 두 개를 두지 않는다).
- 실제 적용 사례: [`docs/phase-4-13-wordpress-publish-prep-simplification.md`](./phase-4-13-wordpress-publish-prep-simplification.md).

## 짧은 글은 목록 카드 안에서 전체 본문을 보여준다 (Phase 4-14)

SNS/커뮤니티 글처럼 대체로 짧은 콘텐츠는 목록 카드에서 본문을
몇백 자로 잘라 보여주고 "상세 보기"로 강제 이동시키지 않는다.

- 본문이 짧으면(기준: 1,200자 이하) 카드 안에 전체를 그대로
  표시한다.
- 기준을 넘는 긴 글만 카드 안에서 접기/펼치기로 처리한다(전체
  보기 클릭 시 페이지 이동이나 서버 action 호출 없이 같은 카드
  안에서 펼쳐진다).
- 본문은 자동 검토 결과/상태 배지보다 먼저 보여준다 — 사용자가
  내용을 먼저 읽고 판단할 수 있어야 한다.
- 상세 페이지는 삭제하지 않되, 기본 검토 흐름(읽기 → 승인 →
  export 준비)의 필수 경유지가 되지 않게 한다.
- 실제 적용 사례: [`docs/phase-4-14-social-post-list-inline-body.md`](./phase-4-14-social-post-list-inline-body.md).

## 짧은 글은 목록 카드 안에서 수정·검토·승인·복사까지 끝낼 수 있어야 한다 (Phase 4-15)

"본문 수정"이 다른 페이지로 이동시키면, 사용자는 수정 후 다시 돌아와
검토·승인해야 해서 클릭 수가 늘어난다.

- [본문 수정]은 기본적으로 페이지 이동 없이 카드 안에서 textarea
  편집 모드를 연다(단일 텍스트 필드로 안전하게 수정할 수 없는
  구조라면 예외적으로 상세 페이지로 보낸다 — 이 경우도 그 사실과
  이유를 코드 주석에 남긴다).
- [저장 후 승인]처럼 여러 단계를 묶는 버튼은 반드시 "저장 → 자동
  검토 → (통과 시) 승인" 순서를 지킨다. 자동 검토가 통과하지
  못하면 승인하지 않는다 — 승인 가능 여부는 기존 승인 서비스의
  게이트를 그대로 재사용하고 새로 판단 로직을 만들지 않는다.
- 본문을 클립보드로 복사하는 버튼은 화면에 보이는 축약문이 아니라
  항상 전체 본문을 복사한다.
- 페이지 이동이 없어야 하는 순수 클라이언트 상호작용(편집창 열기/
  닫기, 복사)을 로그로 남길 때는 `redirect()`를 호출하지 않는 별도
  action을 만든다 — 폼 제출이 아니라 일반 함수처럼 호출한다.
- 실제 적용 사례: [`docs/phase-4-15-social-post-inline-edit-copy.md`](./phase-4-15-social-post-inline-edit-copy.md).

바로 위 두 규칙(Phase 4-14/4-15)은 SNS/커뮤니티 글 카드에만 한정되지
않는다 — 블로그 글(WordPress 블로그/네이버 블로그)과 기사형 글
(언론 기사/칼럼) 카드도 게시용 본문이 있는 이상 같은 규칙을 따르며,
같은 공통 컴포넌트(`SocialPostBodyPanel`/`getSocialPostDisplayBody`/
`getSocialPostEditableField`)를 재사용한다 — 카드 유형마다 표시/편집
로직을 새로 만들지 않는다(Phase 4-18,
[`docs/wordpress-blog-card-ui-rules.md`](./wordpress-blog-card-ui-rules.md) 참고).

## 모든 글 카드는 상태 기반 "다음 작업" 버튼 1개를 둔다 (Phase 4-19)

품질검사/승인 요청/승인/수동 export 만들기 같은 버튼을 같은 줄에
나열하면 사용자가 지금 무엇을 눌러야 하는지 직접 판단해야 한다.

- 모든 글 카드(블로그/SNS·커뮤니티/기사형)는 지금 상태에 맞는
  primary action 1개 + secondary action 몇 개로 정리한다 — 카드
  유형마다 새 계산 로직을 만들지 않고 이미 있는 공용 helper
  (`getWordPressPublishPrepState`, `getSocialPostCardActionState`)를
  재사용한다.
- WordPress는 Draft 생성/업데이트까지만 자동화한다("WordPress Draft
  만들기"/"WordPress Draft 최종 반영"/"WordPress Draft 보기").
- 그 외 플랫폼(네이버 카페/네이버 블로그/X/Threads/Instagram)은
  이 프로젝트에 OAuth/토큰 저장 인프라가 없는 한 "승인 후 본문
  복사/export 준비"로 안내한다 — 구현되지 않은 자동 업로드 버튼을
  만들지 않는다.
- 실제 적용 사례: [`docs/phase-4-19-post-card-primary-publish-action.md`](./phase-4-19-post-card-primary-publish-action.md).

## 화살표 링크를 작업 순서처럼 쓰지 않는다 (Phase 4-20)

"상세 보기 → 성과 보기 → 기사 개요 →"처럼 화살표로 이어붙인 이동
링크는 실제 작업 순서가 아닌데도 순서처럼 보인다. 특히 마지막
링크 뒤에 붙는 화살표는 의미가 없다.

- 상세 보기/성과 보기/기사 개요처럼 다른 화면으로 이동만 시키는
  보조 링크는 라벨에 화살표를 붙이지 않는다.
- 이런 보조 링크를 primary/secondary action 버튼과 같은 줄, 또는
  그보다 위에 두지 않는다 — 항상 주요 작업 버튼 아래에 둔다.
- 여러 개면 공통 컴포넌트 `RelatedPostLinks`
  (`components/navigation/related-post-links.tsx`)로 "▸ 관련 화면
  보기" 접힘 하나에 묶는다(기본 접힘 상태).
- 성과 보기(확인)는 게시 전이고 성과 데이터도 없으면(`performance_status
  === "not_measured"`) 목록에서 뺀다 — 링크 자체를 삭제하는 게
  아니라 조건에 안 맞을 때 강조하지 않는 것뿐이다.
- 실제 적용 사례: [`docs/phase-4-20-related-post-links-cleanup.md`](./phase-4-20-related-post-links-cleanup.md).

## 게시용 소제목에 마스터 원고 내부 구성 항목 이름을 그대로 쓰지 않는다 (Phase 4-21)

"리드문"/"본문"/"배경 설명"/"쟁점"/"향후 확인할 점"/"출처"는 마스터
원고가 글을 구성할 때 참고하는 내부 항목 이름이지, 독자가 보는
게시용 소제목이 아니다. "리드문"은 소제목 없이 제목 아래 첫 문단으로
배치하고, 나머지는 그 문단이 실제로 다루는 내용을 보여주는 문장형
제목으로 바꾼다("본문" → "왜 지금 이 문제가 주목받는가" 등). 이
규칙은 프롬프트에서 먼저 안내하고, 저장 직전 sanitizer가 한 번 더
정리하며, 자동 검토가 남은 경우를 "수정 필요"로 표시한다. 실제
적용 사례: [`docs/phase-4-21-internal-section-heading-cleanup.md`](./phase-4-21-internal-section-heading-cleanup.md).

## AI가 안전하게 고칠 수 있는 검토 문제는 자동으로 고치고 재검토한다 (Phase 4-22)

자동 검토(quality gate)에서 "수정 필요"가 나왔다고 모두 사용자에게
직접 고치라고 요구하지 않는다.

- 검토 issue는 `auto_fixable`(AI/시스템이 사용자에게 묻지 않고
  고쳐도 되는 표현·구조·형식 문제)/`user_confirmation_required`
  (출처·수치·기관명·날짜 등 사실 판단이 필요한 문제)/`blocking`
  (게시/승인 자체를 막아야 하는 문제) 3종류로 분류한다.
- `auto_fixable`이어도 실제로 구현된 자동 수정기가 있는 항목만
  자동으로 고친다("고칠 수 있는 유형"과 "지금 실제로 고칠 수
  있음"을 구분한다) — 구현되지 않은 자동 수정 버튼을 만들지 않는다.
- 자동 수정 후에는 반드시 자동 재검토를 실행한다.
- 자동 수정과 자동 재검토는 최종 승인을 대체하지 않는다 —
  `approval_status`는 사용자가 [승인]을 눌렀을 때만 바뀐다.
- 사실 확인이 필요한 문제는 새로운 사실/수치/기관명을 만들어
  채우지 않고, 사용자 확인을 기다린다.
- 실제 적용 사례: [`docs/phase-4-22-auto-fix-and-recheck.md`](./phase-4-22-auto-fix-and-recheck.md).

## 플랫폼 선택과 문체 설정은 별도 개념이다 (Phase 4-23)

플랫폼은 "어디에 올릴 글인가"를, 문체는 "어떤 말투와 구성으로 쓸
것인가"를 정한다. 이 둘을 같은 화면에서 함께 조정할 수 있게 하되
개념은 섞지 않는다.

- 기본값은 "추천 문체 자동 적용"이다 — 플랫폼마다 어울리는 문체가
  자동으로 적용된다.
- 사용자는 "전체 플랫폼에 같은 문체 적용"(단일 tone_style을 선택한
  모든 플랫폼에) 또는 "플랫폼별 문체 직접 선택"(플랫폼마다 다른
  tone_style)을 선택할 수 있다.
- 기본 화면은 간단하게 유지한다 — "전체 같은 문체"/"플랫폼별 직접
  선택"의 세부 드롭다운은 그 옵션을 선택했을 때만 펼쳐진다.
- raw tone_style enum(`explanatory`, `story` 등)을 기본 UI에 그대로
  보여주지 않는다 — 항상 한국어 라벨(`TONE_STYLE_CONFIGS[...].label`)
  로 표시한다.
- 플랫폼에 맞지 않는 강한 문체가 선택되어도 각 플랫폼 prompt가
  안전하게 완화해서 해석한다(예: 네이버 카페의 강한 설득형 →
  질문 유도형) — 새 UI가 이 완화 로직을 우회하지 않는다.
- 실제 적용 사례: [`docs/phase-4-23-platform-tone-selection-ui.md`](./phase-4-23-platform-tone-selection-ui.md), 완성 내역은 [`docs/phase-4-24-platform-tone-selection-completion.md`](./phase-4-24-platform-tone-selection-completion.md).

## 같은 종류의 카드가 여러 개면 "목록(compact) + 선택한 것 1개의 상세"로 나눈다 (Phase 4-16)

같은 종류의 상세 패널(게시 준비, 검토 결과 등)을 모든 카드에
반복해서 보여주면 페이지가 길어지고 "무엇을 먼저 봐야 하는지"
판단하기 어려워진다.

- 목록의 각 카드는 비교에 필요한 요약 정보(제목, 상태 요약, 완료된
  작업, 남은 작업 1줄)와 최소한의 버튼(선택/미리보기/삭제 등)만
  보여준다.
- 상세 패널(상태 전체, 여러 단계로 이어지는 작업 흐름)은 사용자가
  선택한 항목 1개에 대해서만 표시한다.
- 선택 상태를 위해 새 전용 파라미터를 만들기 전에, 이미 있는
  하이라이트/딥링크 파라미터로 재사용할 수 있는지 먼저 확인한다.
- 기본 미리보기는 렌더링된 결과(HTML 등)를 보여주고, 원문(markdown/
  raw 데이터)은 별도의 보조 탭으로 분리한다.
- 실제 적용 사례: [`docs/phase-4-16-wordpress-blog-list-detail-split.md`](./phase-4-16-wordpress-blog-list-detail-split.md).

## 여러 단계로 이루어진 내부 작업은 진행 상황을 화면에서 확인할 수 있어야 한다 (Phase 4-17)

버튼 클릭 후 내부적으로 여러 단계가 실행되는데 화면에 변화가 없으면
사용자는 다시 눌러야 할지 기다려야 할지 알 수 없다.

- 여러 단계로 이루어진 내부 작업은 공통 `job_run`(`lib/job-progress/*`)
  으로 등록해 상태/현재 단계/완료 단계 수/마지막 진행 시각을 기록한다.
- 화면은 "대기 중/진행 중/완료/실패/차단/확인 필요/멈춤 가능성 있음"
  같은 사용자 친화적 문구로 보여주고, raw status/raw error는 "상세
  단계 보기" 접힘 영역에만 둔다.
- `running`/`retrying` 상태가 오래 지속되면(2분 이상 heartbeat 없음)
  즉시 실패로 단정하지 않고 "멈춤 가능성 있음"으로만 표시한다.
- 1차 구현은 polling(2~3초 간격)이다 — 실시간(Realtime) 연동은 이후
  과제로 남긴다.
- 실제 적용 사례: [`docs/job-progress-system.md`](./job-progress-system.md).

## env 변수명·실제 외부 반영 action·provider 노출 금지 원칙 (Phase UX-02A)

`docs/ux/full-ux-audit.md` 전체 UX 감사(Phase UX-01)에서 확인된 Critical
문제(`app/articles/[id]/page.tsx`에 집중)를 바탕으로, 다음 4가지를 모든
화면에 적용되는 금지/필수 규칙으로 못박는다.

1. **env 변수 이름을 일반 사용자 화면에 그대로 렌더링하지 않는다.**
   `WORDPRESS_BASE_URL`, `WORDPRESS_MEDIA_UPLOAD_ENABLED`,
   `WORDPRESS_PUBLISH_ENABLED`, `SEO_PLUGIN_PROVIDER`,
   `SEO_PLUGIN_WRITE_ENABLED`, `WORDPRESS_SEO_CUSTOM_ENDPOINT_ENABLED` 같은
   env 변수명은 "연결됨/연결 안 됨", "사용 가능/비활성화됨" 같은
   사용자 친화적 문구로 바꾸거나, 꼭 필요하면 기본 접힘
   `<details>`(가능하면 "고급 기능" 같은 상위 접힘 안에 한 번 더 접힌
   "~상세 보기"/"고급 설정 보기")로 감싼다. env 변수명을 한국어 문장
   옆에 그냥 병기하지 않는다.
2. **실제로 외부 시스템을 변경하는 action에는 "테스트"라는 단어를
   쓰지 않는다.** 버튼 라벨이 "테스트"라고 말하면서 실제로는 WordPress
   공개 게시처럼 되돌릴 수 없는 변경이 일어나면 안 된다(사용자가
   "테스트니까 안전하다"고 오해해 실수로 실행할 수 있다). 라벨은
   실제로 일어나는 일을 있는 그대로 설명해야 한다(예: "WordPress
   실제 공개 게시 실행"). 실제 적용 사례:
   `app/articles/[id]/page.tsx`의 "WordPress 공개 게시 테스트 실행
   (실제 공개 게시)" → "WordPress 실제 공개 게시 실행" 수정
   (`docs/ux/ux-02a-critical-safety-cleanup.md` 참고).
3. **되돌릴 수 없는 실제 공개 게시(public publish) 기능은 일반 사용자
   기본 흐름에 노출하지 않는다.** 이런 기능을 완전히 제거할 수 없다면
   (기존 fallback/관리자 경로로 유지해야 한다면), 다음 두 조건을 모두
   만족해야 한다: (a) 일반적인 "고급 기능" 접힘 하나만으로는 부족하고,
   그 안에서 한 번 더 별도의 "⚠ 관리자 전용" 접힘으로 격리한다. (b) 그
   접힘을 열면 "일반 사용자는 사용하지 않아야 하며 되돌릴 수 없다"는
   경고 문구가 버튼보다 먼저 보인다. 자동 public publish는 이 규칙과
   무관하게 여전히 어떤 경우에도 새로 추가하지 않는다(섹션 3-26 원칙
   그대로 유지).
4. **provider/endpoint/ID 같은 Level 3 정보는 기본 화면에 select/입력
   폼으로 제공하지 않는다.** provider가 사이트 전체 env 설정으로
   이미 정해지는 값이라면(예: `SEO_PLUGIN_PROVIDER`), 기본 화면에는
   현재 연결된 provider 이름만 사용자 친화적으로 보여주고, provider를
   직접 바꾸는 select는 "OO 직접 선택 (고급)" 같은 별도 접힘 안에
   둔다. WordPress Post ID/Media ID/endpoint path 등도 마찬가지로
   기본 화면 dt/dd로 나열하지 않고 접힘 안에만 둔다.

이 4가지는 `docs/ux/ui-information-levels.md`의 Level 3 분류와
`docs/ux/ux-refactor-roadmap.md`의 UX-02A 단계에 대응한다. 새 화면을
만들거나 기존 화면에 WordPress/SEO/공개 게시 관련 기능을 추가할 때는
이 절을 먼저 확인한다.

## raw DB 필드명·내부 ID 노출 금지, disabled 이유 자연어 원칙 (Phase UX-02B)

`docs/ux/full-ux-audit.md`의 C3/C4/C6(`app/articles/[id]/blog/page.tsx`,
`components/wordpress/wordpress-publishing-panel.tsx`)에서 확인된 패턴을
바탕으로, 위 Phase UX-02A 원칙에 다음을 추가한다.

1. **버튼 disabled 사유·안내 문구에 `field_name=value` 형태의 raw DB
   필드명을 절대 섞지 않는다.** `"quality_status=ready 필요"`,
   `"approval_status=approved 필요"`, `"publish_guard=blocked"` 같은
   표현은 개발자에게는 정확하지만 일반 사용자에게는 의미 없는 코드
   조각이다. 항상 "품질검사를 먼저 완료해 주세요.", "최종 승인이
   필요합니다." 같은 자연어 문장으로 바꾼다. 조건이 이미 자명하면
   (예: "아직 승인되지 않았을 때만 보이는 경고") 굳이 현재 값을 괄호로
   덧붙이지 않는다 — 조건과 안내만으로 충분하다.
2. **"내부 상태값 보기" 같은 접힘 영역 안에서도 dt 라벨은 raw 필드명이
   아니라 `describeStatusField`를, dd 값은 `describeStatusValue`를
   거친다.** 접혀 있다는 이유로 raw 그대로 두지 않는다(섹션 "페이지 간
   일관성 원칙" 2번과 동일한 원칙을 여기서도 지킨다).
3. **WordPress Post ID/Media ID/Media URL/provider/raw publish guard
   값 같은 Level 3 정보를 재사용 컴포넌트(`WordPressPublishingPanel`
   등)의 기본(비접힘) 렌더링에 두지 않는다.** 공통 컴포넌트는 기본
   화면에 "지금 상태를 5줄 내외로 요약"만 보여주고, ID/URL/raw
   status/timestamp 같은 세부 정보는 컴포넌트 내부의 "상세 상태
   보기" 접힘 안에 모은다. 여러 화면이 공유하는 컴포넌트를 수정할
   때는 모든 사용처(예: `/articles/[id]`의 `article` targetType과
   `/articles/[id]/blog`의 `wordpress_blog` targetType)에서 정적
   소스 검사 테스트를 함께 갱신해 회귀를 방지한다.
4. **같은 값(`"reviewed"` 등)이 필드마다 다른 의미로 쓰이면, 그 필드
   전용 라벨 헬퍼를 따로 둔다.** 예를 들어 `article.status ===
   "reviewed"`는 항상 "승인됨"으로 번역해야 하는데, 공용
   `describeStatusValue`의 `"reviewed"`는 다른 맥락(SEO/이미지 등
   하위 항목의 선택적 검토 플래그)에서 "검토 완료"로도 쓰인다. 이런
   충돌이 있으면 공용 맵을 억지로 하나로 통일하지 말고,
   `describeArticleStatus`처럼 그 필드 전용의 작은 헬퍼를 추가해 각
   필드의 실제 의미에 맞는 라벨을 고정한다(`lib/social/status-labels.ts` 참고).
5. **공통 컴포넌트 안에서 같은 이름의 섹션 제목이 그 컴포넌트를 쓰는
   페이지의 다른 영역과 중복되지 않게 한다.** 예: `WordPressPublishingPanel`은
   `isPrimaryWorkflow`(wordpress_blog) 화면에서는 호출부가 이미 자체
   "WordPress 게시 준비" 다음 작업 카드를 children으로 렌더링하므로,
   패널 자신의 제목은 다른 문구("게시 상태 요약")를 써서 같은 이름이
   화면에 연속으로 두 번 나오지 않게 한다.

실제 적용 사례: `docs/ux/ux-02b-wordpress-blog-cleanup.md` 참고.

## 공통 UX 기반 컴포넌트 — 새로 만들기 전에 먼저 확인한다 (Phase UX-03A)

다음 공통 컴포넌트가 이미 존재한다. 비슷한 UI가 필요하면 페이지에
새로 구현하지 말고 이 컴포넌트를 먼저 확인한다(신설 필요 여부는
`docs/ux/ux-03a-common-ux-foundation.md`의 조사 근거를 먼저 본다).

- **`components/common/advanced-details.tsx` (`AdvancedDetails`)** — Level
  2/3 정보(내부 상태값/raw status/ID/로그)를 기본 접힘으로 보여주는
  공통 `<details>` 래퍼. `title`(기본 "상세 상태 보기")/`defaultOpen`
  (기본 false)/`className`/`testId`를 받는다. "raw"/"internal"/"debug"
  같은 개발자 용어를 title에 쓰지 않는다. API key/token/password,
  전체 raw body/prompt 원문은 이 컴포넌트 안에도 넣지 않는다.
- **`components/review/auto-review-summary-card.tsx`
  (`AutoReviewSummaryCard`)** — `lib/social/social-post-auto-review.ts`의
  `summarizeAutoReview()` 결과(`AutoReviewSummary`)를 받아 톤 색상 박스 +
  통과/확인 필요/수정 필요/차단 카운트 + 승인 가능 안내 + issue 목록을
  렌더링한다. 페이지마다 다른 문구/액션은 `contextNote`/
  `renderIssueActions`/`extraBanner`/`footer` slot으로 넘긴다 — 고정
  레이아웃으로 강제하지 않는다.
- **`components/review/human-review-panel.tsx` (`HumanReviewPanel`)** —
  "사람이 실제로 판단해야 하는 항목"만 보여준다(`HumanReviewItem[]`).
  이 컴포넌트 자신은 어떤 항목이 auto_fixable인지 판단하지 않는다 —
  호출 측이 `lib/social/review-issue-fixability.ts`의
  `summarizeReviewIssues()`로 분류한 뒤 `userConfirmationRequired` +
  `blocking`만 넘긴다(`autoFixable`은 별도 안내로 이미 다룬다). 항목이
  0개면 "확인할 사항 없음"만 compact하게 보여주고, severity는 항상
  한국어 배지("참고"/"확인 필요"/"승인 불가")로 표시한다 — raw
  fixability enum을 그대로 노출하지 않는다.
- **`components/social/inline-post-body-editor.tsx`
  (`InlinePostBodyEditor`)** — 카드/화면 안에서 페이지 이동 없이 본문
  하나(단일 문자열)를 편집하는 UI(`SocialPostBodyPanel`이 내부에서
  재사용). Server Action form(`<form action={saveAction}>`) 기반이며
  저장 방식(저장만/저장+검토/저장+승인)은 버튼의 `name="saveMode"`
  value로 구분한다 — client-side `value`/`onChange` 콜백으로 강제
  통합하지 않는다. **X/Threads처럼 배열 기반 콘텐츠(threadItems)는
  `mode="thread"`(discriminated union prop)로 지원한다(Phase
  UX-03B2)** — 항목마다 별도 `<textarea name="threadItemText">`를
  렌더링하고 `FormData.getAll("threadItemText")`로 순서를 그대로
  보존한다. 여러 항목을 하나의 textarea로 억지로 합치지 않는다. 기존
  단일 문자열 사용처(`mode` 생략 시 기본값)의 동작/계약은 그대로
  유지한다.

**상태 라벨 semantic 원칙(Phase UX-03A에서 검증)**: `article.status`의
`"reviewed"`는 "승인됨"이 맞다(마스터 승인 게이트, `lib/harness/approval-gate.ts`가
강제) — `wpMetadataStatus` 등 하위 항목의 `"reviewed"`("검토 완료",
비강제 참고용 플래그)와 의도적으로 다른 라벨을 쓴다. 같은 raw 값이
필드마다 다른 의미면, 공용 `describeStatusValue`를 억지로 통일하지
말고 그 필드 전용 헬퍼(`describeArticleStatus`처럼)를 따로 둔다 —
근거는 `docs/ux/ux-03a-common-ux-foundation.md`의 semantic audit 참고.

실제 적용 사례: `docs/ux/ux-03a-common-ux-foundation.md` 참고.

## 현재 상태 + 다음 작업 공통 표시 원칙 (Phase UX-03B1)

사용자가 어떤 화면에 들어가더라도 기본적으로 "지금 이 글은 어떤
상태인가?"와 "지금 내가 해야 할 다음 작업은 무엇인가?"에 즉시 답할 수
있어야 한다. 이를 위해 다음 원칙을 지킨다.

- **기본 화면에는 현재 상태와 다음 작업을 명확히 표시한다.** 가능하면
  `components/workflow/workflow-status-card.tsx`(`WorkflowStatusCard`)와
  `components/workflow/next-action-panel.tsx`(`NextActionPanel`)를
  재사용한다 — 상태 계산 로직은 새로 만들지 않고, 기존 helper
  (`getWordPressPublishPrepState`/`getSocialPostCardActionState`/
  `getPostApprovalNextActions` 등)의 결과를 `lib/ui/next-action-view-model.ts`/
  `lib/ui/workflow-status-view-model.ts`의 어댑터로 변환해서 넘긴다.
- **primary action은 원칙적으로 화면/카드당 하나다.** 여러 helper의
  결과를 조합할 때도(예: autoFix action처럼 helper가 모르는 화면 전용
  action을 끼워 넣을 때) 최종적으로 하나의 `NextActionViewModel`에 담아
  primary가 항상 하나만 강조되게 한다.
- **사용자에게 다음 행동을 요구하는 문구("다음 작업", "확인이
  필요합니다" 등)에는 반드시 실제 action(버튼/링크)이 함께 있어야
  한다.** 문구만 있고 action이 없는 dead-end를 만들지 않는다 —
  `NextActionPanel`은 primary/secondary가 모두 없을 때 자동으로
  "다음 작업을 자동으로 결정하지 못했습니다" + 안전한 fallback
  action(또는 "추가로 필요한 작업이 없습니다")을 보여준다.
- **완료된 action은 반복 표시하지 않는다.** 품질검사가 이미
  통과했으면 품질검사 버튼을 다시 primary로 보여주지 않고, 승인이
  완료됐으면 승인 버튼을, Draft가 이미 있으면 새 Draft 생성 버튼
  대신 "Draft 보기"/"Draft 업데이트"를 보여준다 — 기존 helper들이
  이미 이 규칙을 구현하고 있으므로 새로 만들지 않는다.
- **Related links(`RelatedPostLinks` 등)는 primary workflow와 시각적으로
  분리한다.** `NextActionPanel`/`WorkflowStatusCard`보다 강조되면 안
  되고, 화살표를 이어붙여 단계 진행처럼 보이는 표현은 쓰지 않는다.
- **긴 작업이 진행 중이면 NextActionPanel에 새 실행 버튼을 또 보여주지
  않는다.** `NextActionPanel`의 `progressContent` prop으로
  `JobProgressCard` 등을 대신 보여줄 수 있다 — 동일 작업의 중복 실행을
  막는다.

실제 적용 사례: `docs/ux/ux-03b1-workflow-next-action.md` 참고.

## 동일 기능 상호작용 일관성 + "승인" 용어 원칙 (Phase UX-03B2)

같은 기능(예: 본문 수정)은 플랫폼/카드가 달라도 항상 같은 방식으로
동작해야 한다. "다른 카드는 인라인 편집인데 이 카드만 상세 페이지로
이동한다" 같은 예외를 만들지 않는다.

1. **같은 라벨은 항상 같은 동작을 의미한다.** `[본문 수정]` 버튼은
   플랫폼과 관계없이 항상 카드 안에서 열리는 인라인 편집을 뜻한다 —
   페이지 이동으로 대체하지 않는다. 배열 기반 콘텐츠(X thread 등)라도
   예외를 두지 말고, 인라인 편집기 쪽을 확장해서 맞춘다(위
   `InlinePostBodyEditor`의 `mode="thread"` 참고).
2. **페이지/탭 이동을 뜻하는 버튼에는 "상세 보기"류 표현을 쓰고,
   "수정"이라는 단어를 페이지 이동에 쓰지 않는다.** "수정"은 항상
   그 자리에서 바로 편집 가능한 UI를 의미해야 한다.
3. **"승인"이라는 단어는 실제로 되돌릴 수 없는/최종 게이트 역할을
   하는 action에만 쓴다.** 같은 화면 안에 "제안을 선택/채택하는
   단계", "다시 검토해 달라고 요청하는 단계", "최종적으로 확정하는
   단계"처럼 성격이 다른 여러 action이 있으면, 라벨을 기계적으로
   통일하지 말고 각 action이 실제로 하는 일(DB에 어떤 필드가
   바뀌는지, 되돌리기 어려운 게이트인지)을 먼저 확인한 뒤 가장 정확한
   동사를 고른다(선택/적용/요청/승인 등). 상태 표시 라벨도 같은
   원칙을 따른다 — 같은 raw 값(`"approved"` 등)이 여러 필드에서 쓰이며
   의미가 다르면, 공용 `describeStatusValue`를 억지로 통일하지 말고
   그 필드 전용 헬퍼(`describeRewriteSuggestionStatus`처럼)를 따로
   둔다. 실제 사례: `app/articles/[id]/rewrite/page.tsx`의 "개선 제안
   승인"/"재승인 요청"/"재승인 승인하기" → "개선안 선택"/"재검토
   요청"/"최종 승인" 재정리(`lib/social/rewrite-version-user-facing-status.ts`).
   **주의: state machine/DB 필드/action 함수명은 이 재정리로 바꾸지
   않는다 — 사용자에게 보이는 라벨만 바꾼다.**
4. **한 화면에는 "지금 눌러야 할 action"을 계산하는 판단 로직이
   하나만 있어야 한다.** 여러 helper가 화면 여러 곳에서 각자
   "primary action"을 따로 계산하면(예: 페이지 상단 요약 카드와
   페이지 하단 워크플로 패널이 서로 다른 기준으로 "이게 지금 눌러야
   할 버튼"이라고 주장하는 것), 사용자에게는 primary action이 두 개
   있는 것처럼 보인다. 이런 helper를 발견하면: (a) 정말 순수하게
   "어느 섹션으로 스크롤/이동할지"만 알려주는 navigation 전용이면
   유지하되 버튼 스타일을 secondary(테두리)로 낮춰 진짜 primary
   action과 시각적으로 경쟁하지 않게 한다. (b) 같은 작업의 실행 여부를
   별도 기준으로 다시 계산한다면, 그 helper를 삭제하거나 business
   logic을 합치지 말고 `NextActionViewModel` 등 공통 adapter를 거쳐
   같은 결과를 쓰도록 바꾼다. 실제 사례:
   `lib/social/social-post-auto-review.ts`의
   `getSocialPostWorkspacePrimaryAction`은 `/social-posts/[id]`
   상단 "지금 상태 요약" 카드에서 "빠른 이동"(다음에 어느 섹션을
   보면 되는지) 용도로만 쓰고, 버튼 스타일을 secondary로 낮췄다 —
   실제 승인 action(강조 버튼)은 최종 승인 패널의
   `approveSocialPostAction` 폼 하나뿐이다.
5. **네비게이션 action(다른 화면/섹션으로 이동)과 워크플로 action(실제
   상태를 바꾸는 실행)은 시각적으로 분리한다.** 같은 버튼 스타일
   (강조색)을 공유하지 않는다 — 네비게이션은 옅은 테두리/배경의
   secondary 스타일을 쓰고, 실제 실행 버튼만 강조(primary) 스타일을
   쓴다.

실제 적용 사례: `docs/ux/ux-03b2-interaction-consistency.md` 참고.

## PlatformBadge/platform label 공통화 + 모든 상태 전환 버튼은 disabled 로직을 갖춰야 한다 (Phase UX-03C)

1. **"platform"이라는 이름의 값이 여러 개 있을 수 있다 — 개념이 다르면
   라벨 맵도 구분하되, 계산 진입점은 하나로 합친다.** 이 프로젝트에는
   콘텐츠 플랫폼(`SocialPlatform`: wordpress_blog/x/threads/...)과 트렌드
   검색 출처(naver/daum/mock)라는 서로 다른 두 "platform" 개념이 있었다.
   두 개를 억지로 하나의 enum으로 합치지 않되, "platform 문자열 → 사용자
   라벨/배지 스타일" 계산은 `lib/ui/platform-badge.ts` 하나에 모으고
   `components/common/platform-badge.tsx`(`PlatformBadge`)가 그 결과만
   렌더링한다. 페이지마다 별도 `PlatformBadge` 컴포넌트나 색상 `switch`를
   다시 만들지 않는다. 콘텐츠 플랫폼 라벨의 기존 source of truth
   (`lib/social/platform-generation-recommendations.ts`의 `PLATFORM_LABELS`)는
   그대로 재사용하고, 이 새 파일이 다시 정의하지 않는다.
2. **raw 문자열을 배지 텍스트로 그대로 렌더링하는 것은 금지한다(관용적
   배지라는 이유로도 예외를 두지 않는다).** `app/trends/page.tsx`/
   `app/themes/[themeId]/page.tsx`의 옛 `PlatformBadge`가 `{platform}`을
   그대로 렌더링해 "naver"/"daum"/"mock"이 화면에 그대로 보이던 것이
   실제 사례 — "관용적이라 괜찮다"고 판단하지 말고 항상 라벨 변환을
   거친다.
3. **상태에 따라 disabled/이유가 바뀌어야 하는 버튼은, 페이지의 다른
   버튼들과 마찬가지로 반드시 그 로직을 갖춰야 한다 — "이 버튼만
   예외"를 만들지 않는다.** `/articles/[id]/rewrite`의 "개선안 선택"
   버튼이 페이지의 다른 모든 버튼(재검토 요청/최종 승인/재내보내기
   등)과 달리 disabled 로직이 아예 없어서, 이미 선택/적용된 제안에도
   계속 클릭 가능한 상태로 남아 있던 실제 버그가 발견됐다. 새 action
   버튼을 추가할 때는 그 화면에 이미 있는 `describe*DisabledReason`류
   헬퍼 패턴을 확인하고 빠짐없이 따라간다.
4. **오류/실패 메시지도 disabled 이유 문구와 동일한 raw 필드명 금지
   원칙을 적용한다.** `field_name='value'(actual)` 형태의 raw 필드명은
   버튼 disabled 이유뿐 아니라, 서비스 레이어가 반환하는 실패
   메시지(화면의 `{error}` 배너 등)에도 나타날 수 있다 — 버튼 쪽만
   점검하고 서비스 레이어의 오류 문자열은 놓치기 쉬우므로, 새 기능을
   감사할 때는 disabled 조건뿐 아니라 그 조건이 실패할 때 실제로
   반환되는 오류 문자열까지 함께 확인한다.

실제 적용 사례: `docs/ux/ux-03c-route-adoption-platform-labels.md` 참고.

## AI가 처리할 수 있는 검토/수정을 사용자 작업으로 전가하지 않는다 (Phase UX-04A)

자동 검토(quality gate)가 발견한 문제 중에는 AI/시스템이 사람에게 묻지
않고 안전하게 처리할 수 있는 것(auto_fixable)과, 사실/출처/민감한
판단이 필요해 사람이 직접 확인해야 하는 것(user_confirmation_required,
blocking)이 섞여 있다. 이 둘을 UI에서 구분 없이 나열하면, 사람이
확인하지 않아도 되는 문제까지 "내가 해결해야 할 일"처럼 보여 검토
부담이 실제보다 커 보인다.

1. **AI가 안전하게 해결 가능한 문제(auto_fixable)를 사용자 작업으로
   전가하지 않는다.** 기본 화면의 "수정 필요" 목록에 auto_fixable
   issue를 나열하지 않는다 — 이미 자동으로 정리됐거나(구현된
   sanitizer가 있는 경우) 정리 대상으로 분류된 문제이지, 사람이 지금
   당장 판단할 문제가 아니다. 실제 사례:
   `lib/social/social-post-auto-review.ts`의 `summarizeUserFacingReview()`가
   `classifyReviewIssues()`(`review-issue-fixability.ts`)로 auto_fixable
   issue를 걸러낸다.
2. **사용자에게는 사람 판단이 필요한 사항만 기본 표시한다.**
   `HumanReviewPanel`은 `user_confirmation_required`/`blocking`으로
   분류된 항목만 받는다 — 호출 측이 반드시 이 분류를 거쳐서 넘긴다
   (auto_fixable을 실수로 섞어 넣지 않는다).
3. **자동 검토 결과는 raw 카운트가 아니라 사용자 상태 중심으로
   표시한다.** "통과 7 · 확인 필요 1 · 수정 필요 2 · 차단 0" 같은
   세부 카운트를 기본 화면에 항상 노출하지 않는다 — "자동 검토 완료 /
   확인할 사항 N건"처럼 사람이 실제로 해야 할 일의 개수 하나로
   요약한다. `AutoReviewSummaryCard`의 `userFacingSummary` prop이 이
   패턴을 구현한다.
4. **세부 issue count/전체 목록은 기본 UI보다 상세 정보(AdvancedDetails)에
   우선 배치한다.** 삭제하지 않는다 — "자동 검토 상세" 접힘 안에서는
   여전히 전체 목록(auto_fixable 포함)과 raw 카운트를 확인할 수 있어야
   한다.
5. **자동 검토/자동 수정은 최종 승인을 대체하지 않는다.** 자동 검토가
   전부 통과하고 자동 수정까지 완료돼도 `approval_status`를 자동으로
   `approved`로 바꾸지 않는다 — 승인 버튼은 항상 사람이 직접 눌러야
   한다(섹션 "검토는 자동 검토 + 사람은 편집자 원칙"의 연장).
6. **직접 수정 후에는 검토/안전 자동수정/재검토를 가능한 한 연속
   실행한다.** 사용자가 본문을 저장하면, 자동 검토 → (남은 문제가
   전부 auto_fixable이면) 자동 수정 → 재검토까지 한 번에 이어지게
   한다 — "저장 → 검토 버튼 클릭 → 수정 버튼 클릭 → 재검토 클릭"을
   사람이 세 번 반복하게 만들지 않는다. 이 흐름은 이미
   `lib/social/social-draft-generation-service.ts`(글 생성 직후,
   Phase 4-28)와 `runAutoFixAndRecheck()`(수동 재시도 경로)로
   구현되어 있다 — 새 오케스트레이션을 만들기 전에 먼저 기존 흐름이
   해당 화면에도 이미 연결되어 있는지 확인한다.
7. **이미 자동 실행되는 검토/수정 단계의 버튼을 기본 성공 흐름에서
   primary로 계속 보여주지 않는다.** 글 생성 직후 자동 검토가 이미
   끝났다면 `[자동 검토 실행]`을 기본 primary action으로 다시 보여줄
   필요가 없고, auto_fixable 문제가 자동 처리됐다면
   `[자동 수정 후 재검토]`도 마찬가지다. 이 버튼들은 검토 실패/사용자의
   본문 수정/명시적 재시도 같은 **실제로 필요한 상황에서만** 다시
   나타나야 한다(대부분의 기존 구현이 `qualityStatus`/checklist를
   매 렌더마다 다시 계산해서 이미 이 원칙을 만족하고 있었다 — 새
   조건을 만들기 전에 기존 계산이 이미 맞는지 먼저 확인한다).

실제 적용 사례: `docs/ux/ux-04a-human-review-simplification.md` 참고.

## 여러 생성 글을 한 번에 다뤄야 하는 화면의 원칙 (Phase UX-04B)

기사 하나에서 여러 플랫폼 글이 한꺼번에 생성되는 화면(현재는
`app/articles/[id]/social/page.tsx`)에 적용한다. 카드가 여러 개인
화면을 만들거나 고칠 때는 다음을 따른다.

1. **여러 생성 글은 문제 있는 항목을 우선 표시한다.** 차단(blocked) >
   확인 필요(needs_confirmation) > 검토 실패(failed) > 검토 중
   (checking) > 문제 없음(ready) 순으로 정렬한다 — 이미 승인된 글은
   항상 가장 마지막이다. 정렬 기준은 새로 계산하지 않고 이미 있는
   `summarizeUserFacingReview()`(UX-04A) 결과를 그대로 재사용한다
   (`lib/ui/multi-platform-review-summary.ts`의
   `getMultiPlatformReviewSortKey`).
2. **문제가 없는 글을 반복 확인하도록 강요하지 않는다.** 전체
   상태를 한눈에 보여주는 요약 카드("전체 N개 / 확인 필요 N개 /
   확인할 사항 없음 N개")를 화면 상단에 두고, 개별 카드를 하나씩
   열어보지 않아도 전체 그림을 파악할 수 있게 한다
   (`MultiPlatformReviewSummaryCard`). 본문 확인/복사/수정 같은 기존
   기능 자체는 삭제하지 않는다 — 기본 노출 순서/강조만 바꾼다.
3. **bulk approval(일괄 승인)은 사용자의 명시적 action으로만
   실행한다.** 자동으로 여러 글을 한꺼번에 승인하는 경로를 만들지
   않는다 — 반드시 사람이 버튼을 누르고, 확인 대화상자
   (`ConfirmSubmitButton` 등 기존 컴포넌트 재사용)를 거쳐야 한다.
4. **bulk approval은 기존 개별 승인 validation을 절대 우회하지
   않는다.** `UPDATE ... WHERE id IN (...)` 같은 일괄 update로 검증을
   건너뛰지 않는다 — 대상마다 기존 단일 승인 함수(guard 포함)를 그대로
   호출한다(`bulkApproveSocialPosts`가 `approveSocialPost`를 루프
   호출하는 방식 참고). 일부가 실패해도 나머지는 계속 진행하는 부분
   성공을 지원한다.
5. **bulk approval과 bulk publish(외부 게시)를 분리한다.** 일괄
   승인은 `approval_status`만 바꾸고, 어떤 경우에도 외부 플랫폼 API를
   자동 호출하지 않는다 — 게시 준비는 사용자가 다음 화면에서 별도로
   진행한다.
6. **blocked/confirmation-required 글은 bulk approval 대상에서
   제외한다.** 일괄 승인 가능 목록은 "검토 완료 + 확인할 사항 없음 +
   아직 미승인" 조건을 모두 만족하는 글만 포함하고, 제외된 글이 있으면
   그 이유를 자연어로 안내한다(예: "1개는 확인이 필요해 제외됩니다").

실제 적용 사례: `docs/ux/ux-04b-multi-platform-review.md` 참고.

## 승인·게시 준비·게시 완료는 서로 다른 단계다 (Phase UX-05A)

"검토 → 승인 → 게시 준비 → 게시"는 4개의 분리된 단계다. 화면 문구/
상태 계산에서 이 경계를 흐리지 않는다.

1. **승인 완료와 게시 완료는 별개다.** `approval_status === "approved"`가
   곧 게시가 끝났다는 뜻이 아니다 — 승인은 "다음 단계(게시 준비)로
   넘어가도 된다"는 사람의 판단일 뿐이다.
2. **게시 준비 완료는 외부 게시 완료가 아니다.** `PublishPreparationState`의
   `"ready"`(게시 준비 완료)는 "사용자가 다음 게시 action을 실행할 수
   있음"을 뜻하지 "이미 게시됨"을 뜻하지 않는다 — 실제 게시가 끝난
   상태는 반드시 `"completed"`로 별도 표시한다(실제 신호:
   `publishStatus === "published"` 또는 `manualPostStatus === "posted"`
   등 이미 저장된 값만 사용 — 새로 추정하지 않는다).
3. **외부 게시에는 항상 명시적 사용자 action이 필요하다.** 승인 완료,
   bulk approval, 페이지 렌더링/새로고침만으로 외부 게시(또는 게시
   준비를 넘어선 그 무엇)가 자동 실행되면 안 된다 — 실제 direct
   publish capability가 있는 플랫폼이 생기더라도 마찬가지다.
4. **게시 capability가 없거나 아직 구현되지 않은 플랫폼은 항상
   copy/export fallback을 제공한다.** 존재하지 않는 게시 기능을
   있는 것처럼 버튼으로 만들지 않는다 — 예: 이 프로젝트에는 2026-09-18
   기준 어떤 플랫폼에도 실제 "API 즉시 게시"가 구현되어 있지 않으므로,
   naver_cafe/x/threads/instagram의 primary action은 항상 "본문 복사"
   여야 한다("게시하기"라는 라벨은 실제로 그 capability가 구현된
   뒤에만 쓴다). 새 capability가 실제로 추가되면 그때
   `getPublishCapability`(`lib/ui/publish-preparation-view-model.ts`)에
   반영한다.
5. **게시 설정 부족을 기술 용어 대신 사용자 행동으로 안내한다.** "API
   readiness"는 "게시 설정 상태"로, "dry-run"/"feature flag"/"provider"
   같은 용어는 실제 의미에 맞는 한국어 문장으로 바꾼다.
6. **page load/승인/bulk approval은 외부 publish를 유발하지 않는다.**
   이 원칙은 화면 렌더링 시점에 발생하는 부수효과에도 적용된다 —
   Server Component가 데이터를 조회하는 것과, 사용자가 버튼을 눌러
   action을 실행하는 것을 절대 섞지 않는다.

실제 적용 사례: `docs/ux/ux-05a-publish-preparation.md` 참고.

## 게시 실행·완료 UX 원칙 (Phase UX-05B)

UX-05A의 "승인/게시 준비/게시 완료 분리" 원칙을 실제 게시 실행
단계까지 이어간다.

1. **UI는 실제 구현된 capability만 약속한다.** 2026-09-18 기준
   이 프로젝트에는 어떤 플랫폼에도 "즉시 API 게시"가 구현되어 있지
   않다 — `[네이버에 게시하기]`/`[X에 게시하기]`처럼 존재하지 않는
   기능을 약속하는 라벨을 만들지 않는다. 실제로 존재하는 capability는
   `draft`(WordPress Draft 생성/업데이트/보기)/`manual`(본문 복사 +
   수동 export)/`copy`(본문 복사) 3가지뿐이다
   (`lib/ui/publish-preparation-view-model.ts`의 `getPublishCapability`가
   source of truth).
2. **본문 복사는 실제 게시 완료가 아니다.** `CopyPostBodyButton` 같은
   클립보드 복사 action은 client-side로만 처리하고, 성공했다고 해서
   `manual_post_status`/`publish_status`를 자동으로 바꾸지 않는다.
   복사 성공 메시지 뒤에는 "외부 플랫폼에서 게시한 뒤 게시 완료로
   표시할 수 있습니다" 같은 안내만 덧붙인다(local UI 상태로 충분 —
   "복사했다"는 사실 자체를 DB에 영구 저장할 필요는 없다).
3. **수동 게시 완료는 사용자의 명시적 확인으로만 기록한다.** "게시
   완료로 표시" 버튼은 "AI가 게시를 수행했다"는 뜻이 아니라 "사용자가
   외부 플랫폼에서 직접 게시를 완료했다고 확인했다"는 뜻이다 — 버튼
   라벨/안내 문구에서 이 차이를 분명히 한다(`[게시 완료]`/`[게시
   성공]`/`[자동 게시 완료]`처럼 시스템이 뭔가 했다는 인상을 주는
   표현은 쓰지 않는다).
4. **WordPress Draft 완료를 공개 게시 완료로 표현하지 않는다.**
   "Draft 생성됨"과 "공개 게시됨"은 사용자 문구에서 항상 구분한다 —
   전체 요약에서도 사실과 다른 "게시 완료"라는 표현 대신 "게시 작업
   완료"처럼 capability에 맞는 표현을 쓴다.
5. **완료된 게시 작업의 action을 반복 노출하지 않는다.** 이미
   `publishStatus === "published"`이거나 `manualPostStatus === "posted"`인
   post는 다시 "본문 복사"/"게시 완료로 표시"를 primary로 보여주지
   않고, "게시글 보기"(URL이 있으면) 위주로 compact하게 표시한다.
6. **시스템 본문 수정이 외부 게시물 자동 수정으로 오해되지 않게
   한다.** 이미 게시 완료로 표시된 post는 인라인 편집 버튼을
   비활성화하고 "본문 수정은 외부 게시물에 자동 반영되지 않습니다"
   같은 안내로 대체한다. 이 프로젝트는 이미 저장소 레벨에서
   `publishStatus === "published"`인 post의 수정 자체를 차단하고,
   승인된 post를 수정하면 `quality_status`/`approval_status`/
   `publish_status`를 자동으로 초기화하는 안전장치를 갖고 있다
   (`lib/repositories/social-posts-repository.ts`의
   `saveSocialPostRevision`) — 새 정책을 만들기 전에 이미 있는 이
   안전장치를 먼저 확인한다.

실제 적용 사례: `docs/ux/ux-05b-publish-execution-completion.md` 참고.

## UX Governance 최종 원칙 (Phase UX-07, 이 프로젝트 UX 개선의 종료 기준)

UX-01부터 UX-07까지 이어진 전체 UX 개선 프로젝트를 마치며, 앞으로
새 기능을 추가할 때도 지켜야 하는 핵심 원칙을 최종 고정한다. 위
섹션들의 세부 규칙은 모두 아래 16개 원칙에서 파생된 것이다 — 새 화면을
설계할 때 세부 규칙이 애매하면 이 16개 원칙으로 되돌아가 판단한다.

1. 일반 사용자 화면은 현재 상태 → 본문/결과 → 사람이 확인할 사항 →
   다음 작업 순서를 기본으로 한다.
2. primary action은 화면/섹션당 원칙적으로 하나다.
3. AI가 처리 가능한 문제는 AI가 먼저 처리하고, 사람에게는 판단이
   필요한 것만 남긴다.
4. 사람 판단이 필요한 문제만 전면에 표시한다(자동 통과 항목을 다시
   확인시키지 않는다).
5. 기술 정보는 기본적으로 숨긴다(`AdvancedDetails`/카테고리 accordion
   등 접힘 영역 안에서만).
6. 동일한 의미의 동작에는 항상 동일한 라벨을 쓴다.
7. 승인(approval)과 게시(publish)는 서로 다른 상태다 — 혼동시키지
   않는다.
8. 복사(clipboard copy)는 게시가 아니다.
9. WordPress Draft는 공개 게시가 아니다.
10. UI는 실제로 존재하는 capability만 사용자에게 약속한다(동작하지
    않는 버튼을 만들지 않는다).
11. 완료된 action은 반복해서 다시 보여주지 않는다.
12. workflow action(상태를 바꾸는 버튼)과 navigation(화면 이동)은
    항상 구분한다 — 라벨로도 구분되게 한다(예: 본문 수정=inline
    editor, 상세 보기=이동).
13. 사용자에게 행동을 요구할 때는 항상 실제로 누를 수 있는 action을
    함께 제공한다(dead-end 금지).
14. raw enum/DB 필드명/env 변수 이름을 사용자 화면에 그대로 노출하지
    않는다.
15. 오래 걸리는 action에는 진행 상태(실행 중/결과 요약/다음 행동)를
    보여준다.
16. 외부 공개 게시처럼 되돌리기 어려운 action에는 항상 명시적인
    사용자 클릭이 필요하다 — 자동/일괄 처리 대상에 포함하지 않는다.

**UX 프로젝트 종료 판정(UX-07 기준)**: Critical open 0, High open 0,
핵심 Journey blocker 0, dead-end 0, 위험한 publish/approval 오해 0
— 이 5가지가 모두 충족되면 "UX 개선 프로젝트 완료"로 판정한다. Medium/
Low는 accepted(의도적 유지)/deferred(향후 QA·기능 단계)로 남을 수
있다. 자세한 최종 숫자와 판정 근거는
[`docs/ux/ux-final-report.md`](./ux/ux-final-report.md) 참고.

새 기능 추가 시 이 원칙이 다시 깨지지 않도록
[`docs/ux/ux-regression-checklist.md`](./ux/ux-regression-checklist.md)를
커밋 전에 확인한다.
