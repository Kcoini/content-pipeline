import { describe, expect, it } from "vitest";
import {
  checkFactAgainstSource,
  checkKeyPointsAgainstSource,
  evaluateSourceKeyPoints,
  filterSupportedKeyPoints,
} from "./source-evidence-integrity-validator";

// ─── OPS-04 실제 사례 regression fixture (섹션 3/23) ────────────────────

describe("OPS-04 SBS regression fixture", () => {
  const RAW_SOURCE_EXCERPT =
    "Smith LA, O'Flanagan CH, Bowers LW, et al. (April 2018). " +
    "Translating Mechanism-Based Strategies to Break the Obesity-Cancer Link. " +
    "In one case study, a couple lost a combined 41 kilograms using time-restricted feeding.";

  it("SBS 귀속이 없는 원문 + SBS 귀속을 포함한 fact는 supported로 통과하면 안 된다", () => {
    const fact = "TRF 방식을 통해 라이언 스미스·킴스미스 부부가 총 41kg 감량에 성공한 사례가 2019년 SBS스페셜에서 소개되었다.";
    const result = checkFactAgainstSource(fact, RAW_SOURCE_EXCERPT);

    expect(result.status).not.toBe("supported");
    expect(["needs_review", "unsupported"]).toContain(result.status);
  });

  it("evaluateSourceKeyPoints로 그룹핑해도 SBS 귀속 fact는 verifiedFacts(=supported)에 들어가지 않는다", () => {
    const fact = "TRF 방식을 통해 라이언 스미스·킴스미스 부부가 총 41kg 감량에 성공한 사례가 2019년 SBS스페셜에서 소개되었다.";
    const graded = evaluateSourceKeyPoints([{ id: "src-1", keyPoints: [fact], rawContent: RAW_SOURCE_EXCERPT }]);

    expect(graded).toHaveLength(1);
    expect(graded[0].status).not.toBe("supported");
  });

  it("filterSupportedKeyPoints로 필터링하면 SBS 귀속 fact가 제거된다", () => {
    const fact = "TRF 방식을 통해 라이언 스미스·킴스미스 부부가 총 41kg 감량에 성공한 사례가 2019년 SBS스페셜에서 소개되었다.";
    const filtered = filterSupportedKeyPoints({ id: "src-1", keyPoints: [fact], rawContent: RAW_SOURCE_EXCERPT });

    expect(filtered).not.toContain(fact);
  });
});

// ─── 정상 fact 회귀(섹션 24) — 실제 지원되는 사실은 supported로 통과해야 한다 ───

describe("정상 supported fact 회귀", () => {
  it("숫자가 실제로 원문에 있으면 supported다", () => {
    const result = checkFactAgainstSource(
      "실내 습도를 40~60%로 유지하면 곰팡이 발생을 방지할 수 있다.",
      "실내 습도는 40%에서 60% 사이로 유지하는 것이 곰팡이 번식을 막는 데 도움이 된다."
    );
    expect(result.status).toBe("supported");
  });

  it("기관명이 실제로 원문에 있으면 supported다", () => {
    const result = checkFactAgainstSource(
      "기획재정부는 새 정책을 발표했다.",
      "기획재정부는 오늘 오전 새로운 부동산 정책을 발표했다."
    );
    expect(result.status).toBe("supported");
  });

  it("영어 출처 → 한국어 fact, 숫자/영문 약어가 원문에 있으면 supported다", () => {
    const raw =
      "The National Institute on Aging does not recommend intermittent fasting for the general public. " +
      "New Zealand's Ministry of Health notes it may help with weight loss.";
    const result = checkFactAgainstSource("미국 국립노화연구소는 일반 대중에게 간헐적 단식을 권고하지 않는다.", raw);
    // 영문 기관명이 한국어로 번역되어 literal 문자열이 다를 수 있으므로
    // unsupported로 확정하지 않는다(과도한 차단 금지 — 섹션 24/25).
    expect(result.status).not.toBe("unsupported");
  });
});

// ─── 합성 hallucination fixtures(섹션 26) ───────────────────────────────

describe("합성 hallucination fixtures", () => {
  const RAW = "국내 20세 이상 성인을 대상으로 한 여러 설문에서 수면 부족 문제가 꾸준히 보고되고 있다.";

  it("1. 없는 기관명 추가 — verified로 통과하면 안 된다", () => {
    const result = checkFactAgainstSource("한국보건사회연구원 조사에 따르면 수면 부족이 심각하다.", RAW);
    expect(result.status).not.toBe("supported");
  });

  it("2. 없는 사람 이름 추가 — verified로 통과하면 안 된다(숫자 결합 시 unsupported)", () => {
    const result = checkFactAgainstSource("김민수 박사 연구팀은 이 문제를 처음 보고했다.", "이 문제는 여러 해외 논문에서 보고된 바 있다.");
    expect(result.status).not.toBe("supported");
  });

  it("3. 있는 사실 + 없는 연도 추가 — verified로 통과하면 안 된다", () => {
    const raw = "수면 부족은 성인의 건강에 부정적 영향을 미친다.";
    const result = checkFactAgainstSource("2019년 연구에서 수면 부족이 성인 건강에 부정적 영향을 미친다고 밝혔다.", raw);
    expect(result.status).not.toBe("supported");
  });

  it("4. 있는 사실 + 없는 비율 추가 — verified로 통과하면 안 된다", () => {
    const raw = "수면 부족을 겪는 성인이 많다는 보고가 있다.";
    const result = checkFactAgainstSource("성인의 73.4%가 수면 부족을 겪는다는 보고가 있다.", raw);
    expect(result.status).not.toBe("supported");
  });

  it("5. 있는 숫자지만 잘못된 기관 attribution — verified로 통과하면 안 된다", () => {
    const raw = "2021년 한 메타분석에서 성인의 30%가 불면증을 경험한다고 보고했다.";
    const result = checkFactAgainstSource("미국수면의학회(AASM)는 2021년 메타분석을 통해 성인의 30%가 불면증을 경험한다고 밝혔다.", raw);
    expect(result.status).not.toBe("supported");
  });
});

// ─── false positive fixtures(섹션 27) — 과도한 차단 방지 ────────────────

describe("false positive fixtures — 과도한 차단 방지", () => {
  it("formatting만 다른 숫자(콤마)는 supported다", () => {
    const result = checkFactAgainstSource("작년 투자 규모는 1,000억원이었다.", "작년 투자 규모는 1000억원으로 집계되었다.");
    expect(result.status).toBe("supported");
  });

  it("단위 표기 차이(41kg vs 41 kg)는 숫자만 비교해 supported다", () => {
    const result = checkFactAgainstSource("총 41kg을 감량했다.", "참가자는 총 41 kg을 감량하는 데 성공했다.");
    expect(result.status).toBe("supported");
  });

  it("동일 수치가 다른 문장 구조로 쓰여도 supported다", () => {
    const result = checkFactAgainstSource("체중이 2.5~9.9% 감소할 수 있다.", "연구에 따르면 체중 감소 폭은 2.5%에서 9.9% 사이로 나타났다.");
    expect(result.status).toBe("supported");
  });

  it("source에 실제 있는 비교 내용은 supported다", () => {
    const result = checkFactAgainstSource(
      "HEPA 필터는 0.3μm 입자를 걸러낸다.",
      "HEPA 필터는 0.3마이크로미터 크기의 입자를 효과적으로 제거하도록 설계되었다."
    );
    expect(result.status).toBe("supported");
  });
});

// ─── source conflict(섹션 17 — 기존 정책 유지, 여기서는 그룹 결과 확인) ──

describe("복수 출처 그룹핑", () => {
  it("같은 fact가 2개 출처에 등장하고 그중 하나만 실제로 뒷받침하면 supported로 판정된다(evaluateSourceKeyPoints)", () => {
    const fact = "기준금리가 3%로 인상되었다.";
    const graded = evaluateSourceKeyPoints([
      { id: "s1", keyPoints: [fact], rawContent: "한국은행은 기준금리를 3%로 인상했다고 발표했다." },
      { id: "s2", keyPoints: [fact], rawContent: "관련 없는 다른 본문입니다." },
    ]);
    expect(graded[0].status).toBe("supported");
    expect(graded[0].sourceIds.sort()).toEqual(["s1", "s2"]);
  });

  it("두 출처 모두 뒷받침하지 못하면 unsupported/needs_review로 남는다", () => {
    const fact = "존재하지 않는 기관 XYZ연구소가 발표했다.";
    const graded = evaluateSourceKeyPoints([
      { id: "s1", keyPoints: [fact], rawContent: "관련 없는 본문 A." },
      { id: "s2", keyPoints: [fact], rawContent: "관련 없는 본문 B." },
    ]);
    expect(graded[0].status).not.toBe("supported");
  });
});

// ─── confidence와 무관하게 integrity 검증(섹션 18) ──────────────────────

describe("confidence는 source integrity 검증의 대체재가 아니다", () => {
  it("2개 출처에 등장해 confidence가 high가 될 조건이어도, 둘 다 근거가 없으면 unsupported/needs_review다", () => {
    const fact = "존재하지 않는 기관이 2019년에 발표했다.";
    const graded = evaluateSourceKeyPoints([
      { id: "s1", keyPoints: [fact], rawContent: "전혀 다른 내용." },
      { id: "s2", keyPoints: [fact], rawContent: "역시 다른 내용." },
    ]);
    expect(graded[0].status).not.toBe("supported");
  });

  it("1개 출처(confidence medium 조건)만 있어도 실제로 뒷받침되면 supported다", () => {
    const graded = evaluateSourceKeyPoints([
      { id: "s1", keyPoints: ["기준금리가 3%로 인상되었다."], rawContent: "기준금리가 3%로 인상되었다는 발표가 있었다." },
    ]);
    expect(graded[0].status).toBe("supported");
  });
});

// ─── checkKeyPointsAgainstSource — 배열 편의 함수 ───────────────────────

describe("checkKeyPointsAgainstSource", () => {
  it("각 keyPoint에 fact 필드를 포함해 결과를 반환한다", () => {
    const results = checkKeyPointsAgainstSource(["A는 3%다.", "존재하지 않는 B기관이 발표했다."], "A는 3%로 나타났다.");
    expect(results).toHaveLength(2);
    expect(results[0].fact).toBe("A는 3%다.");
    expect(results[0].status).toBe("supported");
    expect(results[1].status).not.toBe("supported");
  });
});

// ─── raw source content가 아예 없는 경우 ────────────────────────────────

describe("rawContent가 없는 경우", () => {
  it("verified로 잘못 승격되지 않고 needs_review로 처리된다", () => {
    const result = checkFactAgainstSource("어떤 사실 주장이다.", "");
    expect(result.status).toBe("needs_review");
  });
});
