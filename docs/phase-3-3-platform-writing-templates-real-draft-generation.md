# Phase 3-3: Platform Writing Templates & Real Draft Generation

## 목적

Phase 3-2에서 만든 prompt/context/contract 구조를 기반으로, 기존
`articles` 데이터를 사용해 **실제로 동작하는** 플랫폼별 `social_posts`
초안 생성 기능을 완성한다. `SOCIAL_AI_GENERATION_ENABLED=false`(기본값)이면
mock 생성으로, `true`이면 실제 Claude API 호출로 초안을 만들고, 두
경우 모두 contract 검증 → quality gate 자동 실행 → 저장까지 이어진다.
실제 SNS/네이버 게시, 이미지 생성, 성과 분석은 이 단계에서 하지 않는다.

## Phase 3-2와의 관계

Phase 3-2가 prompt/context/contract "구조"를 만들고 mock 생성으로만
검증했다면, Phase 3-3은 그 구조에 다음을 추가한다.

- 플랫폼별 writing template(`platform-writing-templates.ts`)과 tone
  변환 규칙(`tone-transformer-rules.ts`)을 실제 mock 생성 로직에 반영
- `SOCIAL_AI_GENERATION_ENABLED=true`일 때 실제 Claude API를 호출하는
  client(`social-ai-client.ts`) 연결
- quality gate를 draft 생성 흐름에 자동으로 연결(생성 즉시 채점)
- quality gate 자체를 플랫폼별 세부 규칙으로 보강

## 플랫폼별 writing template

`lib/social/platform-writing-templates.ts`가 `prompts/social/*.md`의
구조 가이드를 코드에서 참조 가능한 형태로 정리한다. mock 생성기가
`minThreadItems`/`maxThreadItems`(x: 3~7)와 `minCardItems`/`maxCardItems`
(instagram: 3~5)를 실제로 사용해 개수를 맞춘다.

## tone transformer rules

`lib/social/tone-transformer-rules.ts`가 문체별 `opening`/`closing`
문구를 정의하고, `applyToneTransform(toneStyle, body)`가 mock 생성 본문에
결정론적으로 적용한다. 실제 AI 생성 시에는 `prompts/tones/*.md`가 이
역할을 대신하므로 이 함수를 사용하지 않는다. `warning`/`loss_aversion`도
"협박형이 아니다"라는 Phase 3-1/3-2의 원칙을 그대로 유지하며, opening/
closing 문구 자체에 협박성 표현이 없다.

## mock generation과 AI generation 차이

| 항목 | mock (`SOCIAL_AI_GENERATION_ENABLED=false`, 기본값) | AI (`true`) |
|---|---|---|
| 호출 대상 | 없음(로컬 함수) | Claude API (`lib/ai/anthropic-client.ts` 재사용) |
| 내용 품질 | 구조 검증용, `[mock]` 접두사 | 실제 생성 결과 |
| 비용 | 없음 | 발생 |
| pipeline_logs | `social_ai_generation_skipped_mock_mode` | `social_ai_generation_started/completed` |
| 실패 시 | 발생하지 않음(결정론적) | `social-ai-client`가 안전한 오류 반환 |

두 경우 모두 이후 흐름(contract validation → 저장 → quality gate)은
동일하다.

## SOCIAL_AI_GENERATION_ENABLED 사용법

```bash
SOCIAL_AI_GENERATION_ENABLED=false   # 기본값. mock 생성만 사용.
SOCIAL_AI_MODEL=claude-sonnet-4-5    # 실제 생성 시 사용할 모델
SOCIAL_AI_MAX_TOKENS=3000
SOCIAL_AI_TEMPERATURE=0.7
```

`ANTHROPIC_API_KEY`는 Phase 1-4에서 이미 설정한 서버 전용 값을 그대로
재사용한다(별도 key 불필요). 값을 바꾼 뒤에는 서버를 재시작해야 반영된다.

## Claude API actual generation 구조

`lib/social/social-ai-client.ts`의 `generateSocialPostWithAI(input)`가:

1. `SOCIAL_AI_GENERATION_ENABLED=false`면 API를 호출하지 않고 즉시 실패 반환
2. `true`면 `client.messages.create()`를 호출(도구 호출 없이 순수 텍스트 응답)
3. 응답 텍스트에서 markdown code fence(```json ... ```)가 있으면 제거
4. `JSON.parse()`로 파싱, 실패 시 안전한 오류 반환
5. 파싱 결과가 객체가 아니면 실패 반환
6. 성공 시 `{ ok, output, usage: { inputTokens, outputTokens } }` 반환
7. 예외 발생 시 오류 메시지에서 `sk-ant-...`/`Bearer ...`/`Basic ...` 패턴을 제거한 뒤 반환

prompt assembler(`social-prompt-assembler.ts`)는 이제 systemPrompt에
공통 출력 필드 예시(JSON)를 포함해 "JSON 객체 하나만, code fence
없이" 출력하도록 명시적으로 지시한다.

## contract validation 흐름

`generateSocialDraft()` 내부에서:

1. 출력(mock 또는 AI)을 `validateSocialOutput(platform, output)`으로 검증
2. **유효(valid=true)** → `social_posts`에 저장 후 quality gate 실행
3. **무효(valid=false)이지만 콘텐츠 일부 존재** → 그래도 저장하되
   `quality_status='blocked'`, `publish_status='blocked'`로 표시(사람이
   무엇이 잘못됐는지 확인할 수 있도록)
4. **무효이고 콘텐츠가 전혀 없음(critical)** → 저장하지 않고 생성 자체를
   실패로 반환

## quality gate 흐름

`social_posts` 저장 직후(3번 경로 제외) `runSocialPostQualityGate()`를
자동 실행하고, 결과를 `updateSocialPostQuality()`로 저장한다(이 함수가
`social_posts.quality_*`와 `social_post_quality_runs` insert를 동시에
처리).

공통 검사(Phase 3-1과 동일): platform/tone_style 유효성, 콘텐츠 존재,
협박/공포조장/광고클릭유도/허위수익보장/개인정보 패턴, 원문 복사 의심,
**문체 정합성**(tone-transformer-rules의 문체별 금지 표현 포함 여부).

플랫폼별 추가 검사(Phase 3-3 신규):

| 플랫폼 | 추가 검사 |
|---|---|
| wordpress_blog | excerpt 존재(가산) |
| naver_blog | 과도한 키워드 반복(동일 단어 8회 이상 warning) |
| naver_cafe | 광고성/도배성 표현(blocked), 질문/토론 유도 문장 존재(가산) |
| x | thread item 개별 280자 초과 시 **fail**(needs_revision 강제), 개수 3~7 권장 |
| instagram | `media_requirements.requiresImage=true` 명시 여부, card_items 존재(가산) |

점수 계산: `pass=1, warning=0.5, fail=0, blocked=0`을 체크리스트 항목
수로 평균해 0~100점. **blocked 항목이 하나라도 있으면 무조건 blocked**,
**fail 항목이 있거나 점수가 85 미만이면 needs_revision**, 그 외에는
**ready**.

## UI 사용법

article 상세 페이지의 "Multi-platform Writing" 섹션에서:

1. `SOCIAL_AI_GENERATION_ENABLED` 값에 따라 "AI 생성 모드"/"mock/dry-run
   생성 모드" 안내 배지가 자동으로 표시된다.
2. platform/tone_style을 선택하고 **"플랫폼 글 초안 생성"** 버튼을
   누르면 실제 생성 흐름(context → prompt → 생성 → 검증 → 저장 →
   quality gate)이 실행된다.
3. 생성 결과는 목록에 즉시 추가되며 platform/tone_style/quality_status/
   quality_score/approval_status/publish_status 배지가 표시된다.
4. "상세 보기"를 펼치면 본문/캡션/thread_items/card_items/해시태그와
   함께 quality gate의 **차단 사유**/**경고** 목록, export payload(있는
   경우)를 확인할 수 있다.
5. "새 플랫폼 글 초안 생성 준비" 버튼은 구조 테스트용 단순 placeholder만
   만드는 더 가벼운 버전으로 계속 남아 있다.
6. 실제 게시 버튼은 어디에도 없다 — `publish_status`는 이 단계에서
   `not_published` 또는 `blocked`까지만 사용된다.

## 로그 보안 원칙

- `pipeline_logs.details_json`에는 articleId/platform/toneStyle/
  contractName/aiEnabled/valid/qualityStatus/qualityScore/errorCount/
  warningCount/hasPostTitle/hasPostBody/hasCaption/threadItemCount/
  hashtagCount/cardItemCount/inputTokens/outputTokens **만** 저장한다.
- prompt 전문(systemPrompt/userPrompt), article 본문 전체, 생성된 글
  본문 전체, API key, auth token, Authorization header, Application
  Password, image binary는 **어디에도** 저장하지 않는다.
- `social-ai-client.ts`는 오류 메시지에서도 API key로 의심되는 패턴을
  제거한 뒤 반환한다.

## 아직 하지 않는 것

- 실제 X 게시
- 실제 Threads 게시
- 실제 Instagram API 게시(이미지 업로드 포함)
- 실제 네이버 블로그/카페 자동 게시
- 자동 public publish (사람의 승인/게시 버튼 클릭이 항상 필요)
- 성과 분석 자동화 (조회수/반응 등 수집 없음)
- 실제 이미지 생성 연동 (instagram `media_requirements`는 필요 조건만
  명시할 뿐 실제 이미지를 만들지 않음)

## Supabase 확인 SQL

```sql
-- social_posts 확인
select
  id,
  article_id,
  platform,
  tone_style,
  post_title,
  left(post_body, 120) as post_body_preview,
  left(caption, 120) as caption_preview,
  quality_status,
  quality_score,
  approval_status,
  publish_status,
  generated_at,
  created_at
from social_posts
order by created_at desc
limit 20;

-- quality runs 확인
select
  social_post_id,
  article_id,
  platform,
  tone_style,
  status,
  score,
  jsonb_array_length(checklist) as checklist_count,
  created_at
from social_post_quality_runs
order by created_at desc
limit 20;

-- pipeline logs 확인 (event_name 기준)
select
  event_name,
  status,
  message,
  details_json,
  created_at
from pipeline_logs
where event_name like 'social_%'
order by created_at desc
limit 50;
```

## 다음 단계 제안

- `approval_status='approved'` 이후 실제 export/게시 경험 고도화
  (Phase 3-1 export builder와 연계한 실제 다운로드/복사 UI)
- quality gate의 "문체 정합성" 검사를 AI 기반 평가로 고도화
- 실제 이미지 생성이 연결되면 instagram `media_requirements`를 실제
  파이프라인과 연동
- X/Threads/Instagram/네이버 실제 게시 API 연동 검토(항상 사람의 명시적
  승인/게시 버튼 클릭 전제)
- social post 성과 데이터 저장 스키마 및 수집 파이프라인
