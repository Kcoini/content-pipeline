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
