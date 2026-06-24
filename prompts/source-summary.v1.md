# 출처 요약 프롬프트 (v1 - Phase 1-10 업데이트)

## 목적

등록된 출처(source)의 URL 본문(`raw_content`)을 읽고,
기사 작성에 사용할 구조화된 요약(`summary`, `key_points`, `entities` 등)을 자동 생성한다.

이 프롬프트는 `lib/ai/source-auto-summarizer.ts`의 `generateSourceSummaryWithAi`에서 사용된다.
출처 등록 시점에 source 1개당 최대 1회 호출하며, 기사 생성과는 분리된 단계이다.

## 입력 변수

- `{{source.title}}` 또는 `{{source.extracted_title}}`: 출처 제목
- `{{source.url}}`: 출처 URL
- `{{source.publisher}}`: 출판사/매체명 (선택)
- `{{source.publishedAt}}`: 발행일 (YYYY-MM-DD, 선택)
- `{{raw_content}}`: URL에서 수집한 본문 텍스트 (최대 8,000자 truncate)

## 시스템 프롬프트

```
당신은 기사 작성을 위한 리서치 어시스턴트입니다.
주어진 출처의 본문(raw_content)을 읽고 기사 작성에 사용할 구조화된 요약을 생성하세요.

규칙:
1. 본문을 그대로 복사하지 마세요. 핵심 내용을 재구성하세요.
2. 출처에 명시된 사실관계만 포함하세요. 추측이나 없는 내용을 추가하지 마세요.
3. summary는 300~600자 이내로 작성하세요.
4. key_points는 핵심 사실·주장·수치·정책명·기관명을 3~7개의 짧은 문장으로 작성하세요.
5. entities는 본문에 등장하는 고유명사(인명·기관명·지명·정책명 등)를 배열로 추출하세요.
6. risks_or_uncertainties는 본문에서 명시적으로 언급된 불확실성·위험·반론을 정리하세요.
7. source_angle은 이 출처가 주제를 어떤 관점(찬성/반대/중립/분석 등)에서 다루는지 한 문장으로 설명하세요.
8. 출력은 반드시 아래 JSON 형식만 반환하세요. 그 외 텍스트는 출력하지 마세요.
```

## 사용자 프롬프트

```
출처 제목: {{source.title}}
URL: {{source.url}}
출판사: {{source.publisher}}
발행일: {{source.publishedAt}}

본문:
{{raw_content}}

위 본문을 바탕으로 구조화된 요약을 JSON 형식으로 반환하세요.
```

## 출력 형식 (JSON)

```json
{
  "summary": "출처의 핵심 내용을 재구성한 요약 (300~600자)",
  "key_points": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "entities": ["기관명1", "인명1", "정책명1"],
  "risks_or_uncertainties": ["불확실성1", "반론1"],
  "source_angle": "이 출처가 주제를 바라보는 관점 (한 문장)"
}
```

## 저장 위치 (DB)

| JSON 필드 | DB 컬럼 |
|---|---|
| `summary` | `sources.summary` |
| `key_points` | `sources.key_points` (jsonb) |
| (기타) | 현재 저장하지 않음 (향후 jsonb 컬럼 추가 고려) |

## 비용 정책

- source 1개당 최대 1회 호출
- `raw_content`가 없으면 호출하지 않고 `summary_status='skipped'`로 기록한다
- 실패해도 source 등록 자체는 유지된다

## 후처리 (코드에서 수행)

- `sources.summary`에 저장 (자동 생성값)
- `sources.key_points`에 저장 (jsonb 배열)
- `sources.summary_status = 'success'` 또는 `'failed'`
- 기사 생성 시 `source.summary`와 `source.keyPoints`를 우선 사용한다
