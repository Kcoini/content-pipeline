# Phase 3-23-4: 대시보드를 "현재 단계 스포트라이트 + 접힘 이력" 구조로 재구성

## 배경

Phase 3-23/3-23-2 이후에도 대시보드를 스크린샷 기준으로 다시 엄격히
검토한 결과, 여전히 다음 문제가 남아 있었다.

1. workflowState가 `ready_for_publish_prep`이어도 출처 추가/출처 목록/
   계약 검사 & 기사 초안 생성/플랫폼별 글 생성 섹션이 모두 크게
   펼쳐져 있었다 — 대시보드가 "현재 단계 중심 화면"이 아니라 "긴 폼을
   세로로 나열한 화면"처럼 보였다.
2. 게시 준비 단계 전용 요약 섹션이 없었다.
3. 플랫폼별 글 생성 영역이 여전히 체크박스 폼처럼 보였고, 플랫폼별
   상태/다음 작업/버튼이 카드로 강조되지 않았다.
4. 왼쪽 테마 목록에 동일 제목 테마가 있으면 구분할 수 없었다.
5. 출처 목록이 기본적으로 전체 펼쳐져 화면을 많이 차지했다.
6. 이미 초안이 있어도 기사 초안 생성 라디오 버튼이 계속 노출됐다.
7. 전체 생성/고급 옵션이 눈에 잘 띄어 API 비용 부담을 유발할 수 있었다.
8. 대시보드가 "기능 목록"처럼 보였다("판단 중심"이 아니었다).

## 핵심 아이디어: "현재 단계 스포트라이트 + 다른 단계 접힘"

`lib/dashboard/dashboard-workflow-presentation.ts`에 `getDashboardCurrentStepArea(state)`
를 추가했다 — `workflowState` 하나로부터 "출처 관리(`source`)/출처 기반
원고(`draft`)/플랫폼별 글 생성(`platform`)" 세 관리 영역 중 어느 것이
"지금 사용자가 봐야 하는 현재 단계"인지 하나만 골라준다
(`needs_theme`/`ready_for_publish_prep`은 셋 다 현재 단계가 아니므로
`null`).

```
needs_source           → "source"   (출처 관리가 현재 단계)
ready_to_generate      → "draft"    (출처 기반 원고 생성이 현재 단계)
needs_platform_posts   → "platform" (플랫폼별 글 생성이 현재 단계)
needs_review           → "platform" (검토도 플랫폼 카드에서 확인)
ready_for_publish_prep → null       ("게시 준비" 섹션이 현재 단계 역할)
needs_theme            → null
```

`app/dashboard/page.tsx`는 세 관리 영역을 각각 하나의 JSX 변수
(`sourceManagementBlock`/`draftManagementBlock`/`platformManagementBlock`)
로 미리 계산해 두고, 렌더링 순서를 다음과 같이 고정한다.

```
1. 테마 요약 카드
2. 현재 상태 / 다음 작업 카드
3. 게시 준비 섹션 (ready_for_publish_prep 전용, 그 외 상태면 렌더링 안 함)
4. currentStepArea와 일치하는 관리 영역 하나만 크게 펼쳐서 표시
5. "다른 단계 관리 보기" accordion (기본 접힘) — 나머지 관리 영역들
6. "상세 관리" accordion (기본 접힘, 기존과 동일)
```

이렇게 하면 어떤 workflowState에서도 화면에는 상단 요약 2개 + "지금
해야 할 일" 섹션 하나만 크게 보이고, 나머지는 전부 접혀 있다 — 폼을
삭제한 게 아니라 위치와 기본 펼침 상태만 바꿨다("기존 기능은 삭제하지
않는다" 원칙 유지).

## 1. 게시 준비 섹션 신설

`workflowState === "ready_for_publish_prep"`일 때만 렌더링되는 새
섹션. 승인된 글 개수, 플랫폼별 상태(생성 전 제외) 목록, "WordPress
Draft 반영"/"수동 export 보기"/"플랫폼 글 관리" 3개 버튼을 보여준다.
자동 public publish는 여전히 어디에도 없다 — 모든 버튼은 사람이
직접 확인/조작하는 페이지로 이동만 시킨다.

## 2. 플랫폼별 글 생성을 카드 중심으로 전환

`platformCards`(페이지 내부 계산, `PlatformCardInfo[]`)가 플랫폼마다
다음을 계산한다.

- **생성 전**(post 없음): 상태 "생성 전", 다음 작업 "글 생성", 버튼은
  `generateSelectedPlatformPostsAction`을 재사용하는 미니 폼(해당
  플랫폼 하나만 `platforms` hidden input으로 넘김) — "글 생성하기".
- **검토 대기**(post 있음, `approvalStatus !== "approved"`): 상태
  "검토 대기", 버튼은 `/articles/[id]/social`로 이동하는 "글
  검토하기" 링크.
- **승인 완료**(`approvalStatus === "approved"`): 상태 "승인 완료",
  wordpress_blog면 "WordPress Draft 반영"(→ `/articles/[id]/blog`),
  그 외 플랫폼이면 "수동 export 보기"(→ `/articles/[id]/social`).

각 카드는 플랫폼명, 추천 배지, 상태 배지(색상 3단계: 회색/노랑/초록),
다음 작업, 예상 비용, 버튼 1개만 보여준다.

기존 체크박스 기반 "여러 플랫폼 한 번에 선택해 생성" 폼은 삭제하지
않고 그대로 두되, 하나의 `<details>`(고급) 안으로 옮겼다. "전체 플랫폼
글 생성"은 여전히 그 안의 또 다른 `<details>`(고급 옵션)이고, 비용
경고 확인 모달(`ConfirmSubmitButton`)도 그대로 유지된다 — 어떤
액션/컴포넌트도 새로 만들지 않고 재사용만 했다.

## 3. 완료된 단계는 요약/접힘 처리

- **출처 관리**: 출처 상태 요약 + 출처 추가(기존 `<details>`) + 출처
  목록을 하나의 섹션으로 합쳤다.
- **출처 기반 원고**: "계약 검사 & 기사 초안 생성"과 "기사 초안" 두
  섹션을 하나로 합쳤다. article이 없으면 생성 폼을 그대로 보여주고,
  article이 있으면 "상태: 원고 생성 완료 · 유형: … · 제목: …" 요약 +
  "원고 보기" 버튼 + "재생성 옵션"(기본 접힘) 토글 안에 라디오
  폼(라벨: "기사 초안 재생성")을 넣었다 — 이미 초안이 있어도 라디오
  버튼이 상시 노출되지 않는다.
- 이 두 블록과 플랫폼별 글 생성 블록 중 `currentStepArea`와 일치하지
  않는 것들은 "다른 단계 관리 보기" accordion(기본 접힘) 안에 그대로
  들어간다.

## 4. 출처 목록 축소

출처 목록은 이제 **어떤 단계에서도** 기본으로 전체를 펼치지 않는다
(`sectionExpansion.sourceListExpanded` 필드 자체를 제거했다 — 상태에
따라 달라지는 값이 아니라 "항상 압축"으로 고정됐기 때문). 기본
표시는:

- 출처 개수/최소 개수 충족 여부, 본문 수집·요약 완료 개수(상단 요약
  줄, 기존과 동일)
- 최근 등록된 출처 1~2개 제목(새로 추가)
- "전체 출처 보기 (N개)" `<details>` 토글 — 펼치면 기존 전체 목록
  UI(도메인/뱃지/요약 2줄 제한/전체 보기/본문 보기/원문 열기)가
  그대로 나온다(로직 변경 없음, 위치만 토글 안으로 이동).

## 5. 왼쪽 테마 목록 개선

`lib/repositories/theme-repository.ts`의 `getThemeRelatedCounts()`가
이제 `socialPostCount`/`approvedSocialPostCount`도 함께 반환한다(해당
테마의 최신 article 기준). `lib/dashboard/dashboard-workflow-presentation.ts`
의 `describeThemeStageLabel()`이 이를 "생성 전"/"원고 생성됨"/"검토
대기"/"승인 N" 중 하나로 요약한다.

`ThemeSearchList`가 이제 각 테마 항목에 제목 아래 부제목 한 줄로
"출처 N · <단계> · <날짜>"를 표시한다 — 동일 제목 테마도 구분할 수
있다. 날짜는 `theme.createdAt`(등록일)을 사용했다 — DB에 별도
수정일 컬럼이 없고(schema 변경 금지 원칙), `updated_at` 컬럼은 있지만
도메인 타입(`Theme`)에 매핑되어 있지 않아 이번에는 손대지 않았다(향후
필요하면 별도 작업으로 `mapThemeRowToTheme`에 추가 검토).

새 테마 입력은 이미 Phase 1-23부터 `<details>`로 "+ 새 테마" 버튼만
기본 노출하도록 되어 있었다 — 이번 검토에서 추가로 축소할 필요는
없었다(이미 만족).

## 6. 접근성

`#generate-draft`/`#platform-generation`/`#theme-list`는 이미 Phase
3-23-2에서 `tabIndex={-1}` + focus outline을 적용해 뒀다. 이번에
"다른 단계 관리 보기" accordion 안으로 들어간 뒤에도 그대로 동작한다
— HTML 표준상 `<details>` 안에 있는 fragment 대상으로 이동하면
브라우저가 해당 `<details>`를 자동으로 펼치고 focus를 옮긴다(별도 JS
불필요). accordion 토글은 모두 네이티브 `<details>/<summary>`를
사용해 키보드(Enter/Space)로 여닫을 수 있고, 스크린리더에도 disclosure
위젯으로 인식된다.

## 반영하지 않은 것(의도적 범위 제외)

- **3열 레이아웃**: "3열 구현이 부담되면 기존 2열을 유지"라는 명시적
  허용에 따라 2열(사이드바 + 메인)을 유지했다. 대신 메인 열 안에서
  "현재 단계"가 항상 최상단에 오도록 재배치했다.
- **aria-expanded**: 네이티브 `<details>/<summary>`를 계속 사용했다
  (프로젝트 전체가 이미 이 패턴을 쓰고 있음). `<summary>`는 암묵적으로
  disclosure widget 역할을 브라우저가 노출하므로, 별도의
  `aria-expanded` 속성을 수동으로 추가하지 않았다.
- **테마 목록의 "수정일"**: 위 5번 항목 설명대로 `createdAt`(등록일)로
  대체했다 — 정확한 "최근 수정일"이 필요하면 `themes.updated_at`을
  도메인 타입에 매핑하는 별도 작업이 필요하다(스키마 변경은 아니고
  매핑 코드 추가만 필요하지만, 이번 작업 범위에서는 보수적으로
  손대지 않았다).

## 영향받지 않는 것

- naver_cafe/naver_blog/wordpress_blog/x/threads/instagram의 생성·검토·
  승인·export 로직은 전혀 건드리지 않았다 — 플랫폼 카드의 "글
  생성하기" 버튼도 기존 `generateSelectedPlatformPostsAction`을 그대로
  재사용한다(플랫폼 1개만 선택된 상태로 같은 액션을 호출할 뿐).
- WordPress는 이번에도 Draft 생성/업데이트까지만 다룬다. 게시 준비
  섹션의 "WordPress Draft 반영" 버튼도 `/articles/[id]/blog`로
  이동시킬 뿐, 그 자리에서 자동으로 아무것도 게시하지 않는다.
- 재생성 확인 배너(`showRegenerateConfirm`)와 "조용히 덮어쓰지
  않는다" 원칙은 그대로 유지된다.

## 테스트

- `lib/dashboard/dashboard-workflow-presentation.test.ts`:
  `getDashboardCurrentStepArea` 전체 케이스, `getDashboardSectionExpansion`
  반환값에 `sourceListExpanded`가 더 이상 없음을 검증.
- `lib/repositories/theme-repository.test.ts`: `getThemeRelatedCounts`가
  `socialPostCount`/`approvedSocialPostCount`를 반환하는 케이스, article이
  없을 때 0을 반환하는 케이스 추가.
- `components/dashboard/theme-search-list.test.ts`: 부제목(출처/단계/
  날짜) 표시 검증 추가.
- `app/dashboard/page.test.ts`: 현재 단계 스포트라이트 배치, 게시
  준비 섹션 우선 배치, 플랫폼 카드 구성, 고급 옵션/비용 경고 모달
  유지, 출처 목록 압축, 이미 초안이 있을 때 라디오 숨김 등 다수 추가
  (53개 테스트).
- 전체 `npx vitest run`: 208 files / 2599 tests 통과.
- `npx tsc --noEmit -p .`: 기존과 동일한 37건(무관한 기존 오류)만 존재.
- `npm run lint`: 0 오류.
- `npm run build`: 성공.

## 관련 문서

- [`phase-3-23-dashboard-workflow-ui.md`](./phase-3-23-dashboard-workflow-ui.md)
- [`phase-3-23-2-dashboard-workflow-state-unification.md`](./phase-3-23-2-dashboard-workflow-state-unification.md)
