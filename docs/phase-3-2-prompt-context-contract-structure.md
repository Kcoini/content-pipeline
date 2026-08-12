# Phase 3-2: Prompt / Context / Contract Structure

## 목적

Phase 3-1에서 만든 `social_posts` 기반 구조 위에, 실제 AI 글 생성을
안정적으로 붙이기 위한 **prompt / context / contract** 3층 구조를
만든다. 이번 단계에서는 실제 플랫폼 자동 게시나 실제 X/Threads/
Instagram/네이버 API 연동을 하지 않으며, `SOCIAL_AI_GENERATION_ENABLED`
플래그로 실제 Claude API 호출을 통제하되 기본값은 항상 `false`
(mock/dry-run)로 유지한다.

## Phase 3-1과의 관계

Phase 3-1이 `social_posts` 테이블/타입/quality gate skeleton 등 **데이터
구조**를 만들었다면, Phase 3-2는 그 구조를 채울 **콘텐츠 생성 파이프라인**
(prompt → context → 출력 계약 검증 → 저장)을 만든다.

```
Phase 3-1: social_posts 스키마, quality gate skeleton, export builder
     ↓ (이번 단계가 위에 얹힘)
Phase 3-2: prompt 파일 + context builder 고도화 + prompt assembler
           + contract schema + contract validator + mock 생성 서비스
```

## 플랫폼별 prompt 구조

`prompts/social/*.md` 6개 파일이 플랫폼별 목적/독자/길이 기준/허용
필드/금지 표현/출력 JSON 형식/구조 원칙을 정의한다.

| 파일 | platform |
|---|---|
| `wordpress-blog.md` | wordpress_blog |
| `naver-blog.md` | naver_blog |
| `naver-cafe.md` | naver_cafe |
| `x-thread.md` | x |
| `threads.md` | threads |
| `instagram-caption.md` | instagram |

## tone prompt 구조

`prompts/tones/*.md` 8개 파일이 문체별 작성 기준과 주의점을 정의한다.
`warning`/`loss_aversion`은 명시적으로 "이 문체는 협박형이 아니다"라는
절을 포함해, 위험/손실을 알리되 공포를 조장하지 않도록 강조한다.

## safety prompt 구조

`prompts/safety/*.md` 6개 파일이 공통 금지 사항을 정의한다.

| 파일 | 금지 내용 |
|---|---|
| `no-threat.md` | 협박형 문장 |
| `no-fearmongering.md` | 공포 조장 |
| `no-ad-click-inducement.md` | 광고 클릭 유도 |
| `no-false-claim.md` | 허위 단정 / 보장성 수익 표현 |
| `no-copyright-copy.md` | 원문 기사 복사 |
| `no-sensitive-personal-data.md` | 개인정보 노출 / 플랫폼 정책 위반 표현 |

## contract schema 구조

`contracts/social/*.schema.json` 6개 파일이 JSON Schema(draft-07) 형식으로
platform별 출력 계약을 문서화한다. 공통 필드(`platform`, `tone_style`,
`post_title`, `post_body`, `caption`, `excerpt`, `hashtags`,
`thread_items`, `card_items`, `media_requirements`, `platform_metadata`,
`safety_notes`)를 모두 포함하며, `required` 목록만 플랫폼별로 다르다.

| 플랫폼 | required |
|---|---|
| wordpress_blog | post_title, post_body |
| naver_blog | post_title, post_body |
| naver_cafe | post_title, post_body |
| x | thread_items (1개 이상) |
| threads | post_body |
| instagram | caption, hashtags (1개 이상) |

이 프로젝트에는 JSON Schema 실행 라이브러리(ajv 등)를 새로 추가하지
않았다 — schema 파일은 계약의 **문서화된 정의**이며, 실제 검증 로직은
`lib/social/social-output-contract-validator.ts`에 TypeScript로 직접
구현되어 있다 (다른 검증 로직들과 동일한 이 프로젝트의 기존 관례를
따름).

## context builder 구조 (고도화)

`lib/social/social-writing-context-builder.ts`의 `buildSocialWritingContext()`가
Phase 3-1 대비 다음을 추가로 포함한다.

- `safetyRules`: 공통 + 플랫폼별 + 문체별 금지 표현을 하나의 목록으로 합침
- `outputContractName`: `contracts/social/*.schema.json` 파일명

**절대 포함하지 않는 것**: API key, auth token, Authorization header,
Application Password, 출처 원문 HTML, article 본문 전체(원문은 최대
600자 excerpt로 요약해서만 전달), image binary.

## prompt assembler 구조

`lib/social/social-prompt-assembler.ts`의 `assembleSocialWritingPrompt(context)`가:

1. `prompts/social/<platform>.md` 로드
2. `prompts/tones/<tone>.md` 로드
3. `prompts/safety/*.md` 6개 전부 로드
4. 위 3가지 + 출력 계약 이름을 systemPrompt로 조립
5. context(제목/키워드/excerpt/keyPoints/출처 요약)를 userPrompt로 조립
6. **prompt 전문을 포함하지 않는** 안전한 `contextSummary`(articleId/
   platform/toneStyle/contractName/sourceCount/hasTargetKeyword/
   keyPointCount/excerptLength만 포함)를 반환

파일은 최초 로드 시 메모리에 캐시된다(`evals/*.yaml`을 읽는
`lib/ai/eval-article.ts`와 동일한 패턴).

## mock generation 구조

`lib/social/social-draft-generation-service.ts`의 `generateSocialDraft(articleId, platform, toneStyle)`가:

1. context builder 실행
2. prompt assembler 실행 (`social_prompt_assembly_started/completed`)
3. mock output 생성 (`buildMockSocialOutput` — context의 excerpt/
   keyPoints만으로 플랫폼 구조에 맞는 값을 채움, `[mock]` 접두사로 실제
   AI 결과가 아님을 명시)
4. contract validator 실행 (`social_contract_validation_started/completed`)
5. 검증 통과 시에만 `social_posts`에 저장
6. `social_draft_generation_started/completed/failed` 기록

`SOCIAL_AI_GENERATION_ENABLED=true`로 설정해도 이번 단계는 실제 Claude
API를 호출하지 않는다 — 플래그와 mock 생성 로직만 준비되어 있으며,
실제 호출 구현은 다음 단계로 미룬다.

## 실제 AI 생성이 아직 아닌 이유

1. 먼저 prompt/context/contract 구조 자체가 안정적으로 동작하는지
   확인해야, 실제 AI 응답을 여기에 연결했을 때 발생하는 문제(형식
   오류, 필수 필드 누락 등)와 구조 자체의 문제를 구분할 수 있다.
2. 실제 API 호출은 비용이 발생하고, 검증되지 않은 상태에서 대량 호출
   시 안전 필터(금지 표현 등)가 뚫릴 위험이 있다.
3. mock 생성으로도 UI/승인/export까지 이어지는 전체 흐름을 충분히
   테스트할 수 있다.

## 금지 표현 정책

`lib/social/social-output-contract-validator.ts`와
`lib/social/social-quality-gate.ts`가 동일한 패턴 목록(협박/광고 클릭
유도/허위 수익 보장/개인정보 노출 의심)을 각각 독립적으로 검사한다 —
contract validator는 "AI 출력이 계약을 준수하는가"를, quality gate는
"저장된 social post가 게시 가능한 품질인가"를 검사하는 서로 다른
목적의 이중 안전장치다.

## 로그 보안 원칙

- `pipeline_logs.details_json`/`publish_logs.details_json`에는 카운트/
  불리언/짧은 식별자만 저장한다 (articleId, platform, toneStyle,
  contractName, valid, errorCount, warningCount, hasPostTitle,
  hasPostBody, hasCaption, threadItemCount, hashtagCount, cardItemCount 등).
- prompt 전문(systemPrompt/userPrompt), article 본문 전체, API key,
  auth token, Authorization header, Application Password는 어디에도
  저장하지 않는다.
- image binary도 저장하지 않는다 (이번 단계에 이미지 생성 자체가 없음).

## Supabase 확인 SQL

```sql
select
  id,
  article_id,
  platform,
  tone_style,
  post_title,
  caption,
  quality_status,
  approval_status,
  publish_status,
  generated_at,
  created_at
from social_posts
order by created_at desc
limit 20;

select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_%'
order by created_at desc
limit 30;
```

## 다음 단계 제안

- `SOCIAL_AI_GENERATION_ENABLED=true`일 때 실제 Claude API를 호출하는
  로직 구현 (mock 생성기와 동일한 인터페이스 유지)
- contract validator를 실제 JSON Schema 라이브러리(ajv 등) 기반으로
  전환할지 검토 (스키마와 TS 검증 로직의 이중 관리 부담 vs 실행 시
  스키마 자체를 신뢰 소스로 사용하는 이점 비교)
- 플랫폼별 실제 게시/manual export 경험 개선 (Phase 3-1의 export
  builder와 연계)
- X/Threads/Instagram 등 실제 게시 API 연동 검토 (항상 사람 승인을
  전제로)
