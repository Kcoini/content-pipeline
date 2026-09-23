// OPS-04-FIX1: Source Evidence Integrity.
//
// OPS-04에서 실제로 재현된 문제: AI가 생성한 source summary(keyPoints)
// 자체가 raw source content와 일치하지 않을 수 있다("2019년 SBS스페셜"
// 이라는 존재하지 않는 방송 귀속이 실제 영문 위키백과 출처에는 전혀
// 없었는데도 keyPoints에 포함되어, 이후 verifiedFacts/master manuscript/
// 5개 platform post 전체로 전파됐다).
//
// 기존 fact-grounding-validator.ts(lib/social/)는 "게시용 본문이
// verifiedFacts/evidenceMap과 일치하는가"만 검사한다 — verifiedFacts
// 자체가 오염되어 있으면 이 검사를 무의미하게 통과한다. 이 파일은 그
// 앞 단계, 즉 "candidate fact(AI가 추출한 keyPoint)가 raw source
// content로 실제 뒷받침되는가"를 검사하는 새로운 신뢰 경계(trust
// boundary)를 추가한다.
//
// 원칙(섹션 1): raw source content가 최종 evidence source of truth다.
// AI가 만든 summary/keyPoints/verifiedFacts/evidenceMap 설명 자체를
// 증거로 간주하지 않는다 — 항상 raw source와 다시 대조한다.
//
// 새로운 AI 호출이나 semantic matcher를 추가하지 않는다(섹션 7) —
// 결정적(deterministic) 문자열/정규식 대조만 사용한다. 새로운 사실
// 데이터베이스도 만들지 않는다 — 기존 sourceId/rawContent 구조만
// 재사용한다.

/** 판정 결과. 정확한 의미는 섹션 5 참고. */
export type SourceEvidenceIntegrityStatus = "supported" | "needs_review" | "unsupported" | "conflicting";

export interface SourceEvidenceIntegrityResult {
  status: SourceEvidenceIntegrityStatus;
  /** 판정 이유(사람이 읽는 짧은 설명 — 원문 전체를 복사하지 않는다). */
  reason: string;
  /** supported일 때만: rawContent에서 실제로 추출 가능한 근거 일부(새로 지어낸 문장이 아니다). */
  evidenceExcerpt?: string;
}

/** 숫자/퍼센트/연도/배수 등 핵심 numeric token. 단위는 무시(섹션 9 — 단위 환산을 임의 추론하지 않는다). */
const NUMBER_PATTERN = /\d[\d,]*(\.\d+)?/g;

/** rawContent와 대조하기 전에 formatting 차이(1,000 vs 1000)를 없앤다. */
function normalizeNumberToken(token: string): string {
  return token.replace(/,/g, "");
}

function extractNumericTokens(fact: string): string[] {
  const matches = fact.match(NUMBER_PATTERN) ?? [];
  return Array.from(new Set(matches.map(normalizeNumberToken))).filter((n) => n.length > 0);
}

/**
 * 정부/공공기관/학술/미디어로 흔히 쓰이는 접미사 — 기관명 뒤에 자주
 * 붙는다(섹션 8 — attribution integrity). 한국어는 어순이 자유로워
 * (주어가 동사에서 멀리 떨어질 수 있음) "귀속 표현 직전 단어"만으로는
 * 실제 entity를 안정적으로 잡을 수 없어서, trigger 위치 기반 추출 대신
 * 문장 전체에서 이 접미사 패턴을 스캔한다 — 덜 정교하지만 더 견고하다
 * (섹션 7 — 결정적 매칭만 사용, semantic matcher 금지).
 */
const ENTITY_SUFFIX_PATTERN =
  /[가-힣A-Za-z0-9]{2,20}(연구소|연구원|연구팀|학회|대학교|대학|협회|재단|공단|공사|위원회|정부|국립\S{0,10}(연구소|연구원)?|스페셜|다큐멘터리|방송|뉴스|저널|매거진|신문사|보건부|당국|기구)/g;

/** 영문 대문자 약어(예: SBS, USC, WHO) — 방송사/기관 약칭에 흔하다. */
const ACRONYM_PATTERN = /\b[A-Z]{2,6}\b/g;

/**
 * fact 문장 전체에서 "기관/방송/매체로 보이는 고유명사"를 스캔한다(문장
 * 내 위치는 신경 쓰지 않는다 — 어순 문제를 피하기 위해). ATTRIBUTION_TRIGGERS
 * 유무와 무관하게 항상 실행한다(섹션 10 — person/entity integrity는
 * 귀속 표현이 없는 문장에서도 중요한 신호다).
 */
function extractAttributionEntities(fact: string): string[] {
  const suffixMatches = fact.match(ENTITY_SUFFIX_PATTERN) ?? [];
  const acronymMatches = fact.match(ACRONYM_PATTERN) ?? [];
  return Array.from(new Set([...suffixMatches, ...acronymMatches]));
}

/** 2글자 이상 한글/영문 토큰(숫자 제외) — 근거 신호가 전혀 없는 문장의 최후 수단 대조용. */
function significantTokens(text: string): string[] {
  return Array.from(new Set(text.match(/[가-힣a-zA-Z]{2,}/g) ?? []));
}

function tokenOverlapRatio(fact: string, rawContent: string): number {
  const tokens = significantTokens(fact);
  if (tokens.length === 0) return 0;
  const found = tokens.filter((t) => rawContent.includes(t));
  return found.length / tokens.length;
}

/** rawContent가 한글보다 로마자 비중이 높으면 "번역 출처"로 본다(섹션 7 다국어 처리). */
function isPredominantlyLatinScript(text: string): boolean {
  const letters = text.match(/[A-Za-z가-힣]/g) ?? [];
  if (letters.length === 0) return false;
  const latinCount = letters.filter((c) => /[A-Za-z]/.test(c)).length;
  return latinCount / letters.length > 0.6;
}

function buildExcerpt(rawContent: string, anchor: string): string | undefined {
  const idx = rawContent.indexOf(anchor);
  if (idx === -1) return undefined;
  const start = Math.max(0, idx - 30);
  const end = Math.min(rawContent.length, idx + anchor.length + 30);
  return rawContent.slice(start, end).trim();
}

/**
 * candidate fact(예: source.keyPoints의 항목 하나) 하나가 rawContent
 * 하나로 실제 뒷받침되는지 검사한다. 순수 함수 — 새 AI 호출 없음.
 *
 * 우선순위(섹션 8/9): attribution(기관/방송 등 귀속) 검사를 숫자 검사보다
 * 먼저, 더 엄격하게 본다 — OPS-04의 실제 문제가 정확히 이 유형이었다.
 */
export function checkFactAgainstSource(fact: string, rawContent: string): SourceEvidenceIntegrityResult {
  const trimmedFact = fact.trim();
  if (!trimmedFact) {
    return { status: "unsupported", reason: "빈 문장입니다." };
  }
  if (!rawContent || !rawContent.trim()) {
    return { status: "needs_review", reason: "이 출처의 raw source content가 없어 자동으로 대조할 수 없습니다." };
  }

  const crossLanguage = isPredominantlyLatinScript(rawContent) && /[가-힣]/.test(trimmedFact);

  const entities = extractAttributionEntities(trimmedFact);
  const missingEntities = entities.filter((e) => !rawContent.toLowerCase().includes(e.toLowerCase()));

  const numbers = extractNumericTokens(trimmedFact);
  const normalizedRaw = normalizeNumberToken(rawContent);
  const missingNumbers = numbers.filter((n) => !normalizedRaw.includes(n));

  if (missingEntities.length > 0) {
    // 다국어(영문 출처 → 한국어 fact) 상황에서는 entity 표기가 번역되어
    // 문자열이 다를 수 있으므로 즉시 unsupported로 확정하지 않고
    // needs_review로 완화한다(섹션 7/25 — 과도한 차단 방지). 같은
    // 언어권인데 entity 자체가 원문에 없으면 unsupported로 본다(섹션 8 —
    // OPS-04의 "SBS" 사례처럼 위험 신호가 명확한 경우).
    const status: SourceEvidenceIntegrityStatus = crossLanguage ? "needs_review" : "unsupported";
    return {
      status,
      reason: `"${missingEntities.join(", ")}"라는 귀속(attribution)이 이 출처 원문에서 확인되지 않습니다.`,
    };
  }

  if (numbers.length > 0 && missingNumbers.length > 0) {
    if (missingNumbers.length === numbers.length) {
      return {
        status: "unsupported",
        reason: `숫자(${missingNumbers.join(", ")})가 이 출처 원문 어디에도 없습니다.`,
      };
    }
    return {
      status: "needs_review",
      reason: `일부 숫자(${missingNumbers.join(", ")})가 이 출처 원문에서 확인되지 않습니다.`,
    };
  }

  if (numbers.length > 0) {
    const anchor = numbers[0];
    return { status: "supported", reason: "숫자 근거가 출처 원문에서 확인되었습니다.", evidenceExcerpt: buildExcerpt(normalizedRaw, anchor) };
  }

  if (entities.length > 0) {
    const anchor = entities[0];
    return { status: "supported", reason: "귀속(attribution) 근거가 출처 원문에서 확인되었습니다.", evidenceExcerpt: buildExcerpt(rawContent, anchor) };
  }

  // 숫자도 귀속 표현도 없는 일반 서술문 — 결정적 매칭 신호가 약하므로
  // token overlap만으로 판단한다. 과도한 차단을 피하기 위해(섹션 24)
  // "근거 신호 자체가 없음"은 unsupported가 아니라 needs_review로 둔다.
  const overlap = tokenOverlapRatio(trimmedFact, rawContent);
  if (overlap >= 0.6) {
    return { status: "supported", reason: `문장의 핵심 단어 대부분(${Math.round(overlap * 100)}%)이 출처 원문에서 확인되었습니다.` };
  }
  return {
    status: "needs_review",
    reason: `숫자/귀속 표현이 없고, 출처 원문과의 단어 일치율도 낮습니다(${Math.round(overlap * 100)}%) — 자동으로 확신할 수 없습니다.`,
  };
}

/** 여러 fact를 한 rawContent와 한 번에 대조할 때 쓰는 편의 함수(섹션 11 — source summary 생성 직후). */
export function checkKeyPointsAgainstSource(
  keyPoints: readonly string[],
  rawContent: string
): (SourceEvidenceIntegrityResult & { fact: string })[] {
  return keyPoints.map((fact) => ({ fact, ...checkFactAgainstSource(fact, rawContent) }));
}

/** 여러 후보 중 가장 신뢰할 수 있는 판정을 고른다(supported > needs_review > unsupported). */
function pickBestResult(
  results: readonly SourceEvidenceIntegrityResult[]
): SourceEvidenceIntegrityResult {
  const supported = results.find((r) => r.status === "supported");
  if (supported) return supported;
  const needsReview = results.find((r) => r.status === "needs_review");
  if (needsReview) return needsReview;
  return results[0] ?? { status: "unsupported", reason: "판정할 수 없습니다." };
}

export interface SourceLike {
  id: string;
  keyPoints: readonly string[];
  rawContent: string | null;
}

export interface GroupedFactIntegrity {
  fact: string;
  sourceIds: string[];
  status: SourceEvidenceIntegrityStatus;
  reason: string;
  evidenceExcerpt?: string;
}

/**
 * 여러 출처의 keyPoints를 모아 "같은 문장이 몇 개 출처에 등장하는지"로
 * 그룹핑하고(기존 buildVerifiedFacts와 동일한 그룹핑 규칙), 각 그룹에
 * 연결된 출처(sourceIds)의 rawContent와 실제로 대조한다. 여러 출처 중
 * 하나라도 뒷받침하면 그 fact는 supported로 취급한다(섹션 11 — "출처
 * 요약 생성 직후, keyPoints의 각 fact가 실제 rawContent에 있는지 대조").
 *
 * 새 사실 데이터베이스를 만들지 않는다 — sources 배열 자체가 유일한
 * 입력이다.
 */
export function evaluateSourceKeyPoints(sources: readonly SourceLike[]): GroupedFactIntegrity[] {
  const bySentence = new Map<string, Set<string>>();
  for (const source of sources) {
    for (const point of source.keyPoints) {
      const key = point.trim();
      if (!key) continue;
      if (!bySentence.has(key)) bySentence.set(key, new Set());
      bySentence.get(key)!.add(source.id);
    }
  }

  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return Array.from(bySentence.entries()).map(([fact, sourceIdSet]) => {
    const sourceIds = Array.from(sourceIdSet);
    const perSourceResults = sourceIds.map((id) => checkFactAgainstSource(fact, sourceById.get(id)?.rawContent ?? ""));
    const best = pickBestResult(perSourceResults);
    return { fact, sourceIds, status: best.status, reason: best.reason, evidenceExcerpt: best.evidenceExcerpt };
  });
}

/**
 * source-summarizer.ts(기사 생성 프롬프트 입력)처럼 출처 1개의
 * keyPoints만 필터링할 때 쓰는 편의 함수. unsupported/needs_review인
 * keyPoint는 제외한 목록을 돌려준다(섹션 11 — article 생성 프롬프트에도
 * 오염된 fact가 들어가지 않게 가능한 한 upstream에서 차단).
 */
export function filterSupportedKeyPoints(source: SourceLike): string[] {
  const checks = checkKeyPointsAgainstSource(source.keyPoints, source.rawContent ?? "");
  return checks.filter((c) => c.status === "supported").map((c) => c.fact);
}
