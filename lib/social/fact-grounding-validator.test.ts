import { describe, expect, it } from "vitest";
import {
  buildEvidenceText,
  findUngroundedClaims,
  detectConflictingVerifiedFacts,
} from "./fact-grounding-validator";
import type { MasterManuscriptVerifiedFact } from "@/lib/articles/master-manuscript-types";

function fact(text: string, overrides: Partial<MasterManuscriptVerifiedFact> = {}): MasterManuscriptVerifiedFact {
  return { fact: text, sourceIds: ["source-1"], confidence: "high", ...overrides };
}

describe("findUngroundedClaims — OPS-02A fact-grounding validator", () => {
  it("OPS-01 Pilot C 재현: 등록된 source(배터리 전기차)에 없는 수소차 비교 수치를 탐지한다", () => {
    const verifiedFacts = [
      fact("리튬이온 전지는 배터리식 전기차에 널리 쓰인다."),
      fact("전기자동차는 배터리 관리 시스템(BMS)으로 충전 상태를 제어한다."),
    ];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const caption =
      "배터리식 전기차는 1회 충전 항속거리 200~300km, 수소 연료전지차는 600~700km 주행이 가능합니다. " +
      "하지만 수소 충전소 설치 비용은 30~50억 원, 차량 가격도 7~8천만 원 수준이에요.";

    const issues = findUngroundedClaims(caption, evidenceText);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.reason === "unsupported_number")).toBe(true);
  });

  it("evidence로 뒷받침되는 숫자는 오탐하지 않는다", () => {
    const verifiedFacts = [fact("한국은행 기준금리는 2026년 2월 기준 연 2.50%다.")];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const post = "기준금리는 2.50%로 유지되고 있습니다.";
    expect(findUngroundedClaims(post, evidenceText)).toEqual([]);
  });

  it("같은 숫자를 단위 표현만 다르게 써도 오탐하지 않는다(섹션 21 — 표현 차이는 오류 아님)", () => {
    const verifiedFacts = [fact("전기차의 1회 충전 주행거리는 약 300km다.")];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const post = "이 차량은 약 300킬로미터를 주행할 수 있습니다.";
    expect(findUngroundedClaims(post, evidenceText)).toEqual([]);
  });

  it("숫자가 없는 비수치 비교/최상급 표현도 근거가 없으면 탐지한다", () => {
    const verifiedFacts = [fact("이 배터리는 안전성 인증을 받았다.")];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const post = "이 제품은 업계 최고 성능을 자랑합니다.";
    const issues = findUngroundedClaims(post, evidenceText);

    expect(issues.some((i) => i.reason === "unsupported_comparison")).toBe(true);
  });

  it("비교 표현도 evidence에 동일하게 있으면 통과한다(오탐 방지)", () => {
    const verifiedFacts = [fact("이 배터리는 업계 1위 안전성 인증을 받았다.")];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const post = "이 제품은 업계 1위 안전성을 자랑합니다.";
    expect(findUngroundedClaims(post, evidenceText)).toEqual([]);
  });

  it("evidence가 정말 비어 있으면(근거 자료 없음) 수치/비교 주장을 보수적으로 확인 필요로 올린다 — 호출부(quality gate)는 verifiedFacts가 있을 때만 이 검사를 실행해 이 경로 자체를 피한다", () => {
    const post = "이 제품은 업계 최고입니다.";
    expect(findUngroundedClaims(post, "")).not.toEqual([]);
  });

  it("본문이 비어 있으면 issue가 없다", () => {
    expect(findUngroundedClaims("", "근거 텍스트")).toEqual([]);
  });

  it("OPS-04-FIX1(FP-E) 재현: 번호 목록('3. ...', '5. ...')이 숫자만 남은 별도 문장으로 잘못 분리되지 않는다", () => {
    const verifiedFacts = [fact("간헐적 단식은 여러 방식이 있다.")];
    const evidenceText = buildEvidenceText(verifiedFacts);

    const post = [
      "간헐적 단식 해보신 분 계신가요?",
      "1. 어떤 방식으로 하셨어요?",
      "2. 성공하신 분 있으면 비결 좀 알려주세요.",
      "3. 실패하신 분은 어떤 점이 힘드셨나요?",
      "4. 시작하기 전에 꼭 알아야 할 게 있을까요?",
      "5. 전문가 상담 받고 시작하는 게 나을까요?",
    ].join("\n");

    const issues = findUngroundedClaims(post, evidenceText);
    expect(issues.some((i) => i.sentence === "3.")).toBe(false);
    expect(issues.some((i) => i.sentence === "5.")).toBe(false);
  });
});

describe("detectConflictingVerifiedFacts — OPS-02A 상충 source 탐지", () => {
  it("같은 주제를 말하지만 숫자가 다른 두 사실을 충돌로 탐지한다", () => {
    const verifiedFacts = [
      fact("이 정책의 지원금은 월 30만원이다.", { sourceIds: ["source-a"] }),
      fact("이 정책의 지원금은 월 50만원이다.", { sourceIds: ["source-b"] }),
    ];

    const conflicts = detectConflictingVerifiedFacts(verifiedFacts);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].numbersA).not.toEqual(conflicts[0].numbersB);
  });

  it("같은 숫자를 다르게 표현한 경우는 충돌로 보지 않는다(표현 차이 오탐 방지)", () => {
    const verifiedFacts = [
      fact("전기차 주행거리는 300km다.", { sourceIds: ["source-a"] }),
      fact("전기차 주행거리는 300km 수준으로 확인된다.", { sourceIds: ["source-b"] }),
    ];

    expect(detectConflictingVerifiedFacts(verifiedFacts)).toEqual([]);
  });

  it("서로 관련 없는 주제의 사실은 충돌로 묶지 않는다", () => {
    const verifiedFacts = [
      fact("배터리 용량은 60kWh다.", { sourceIds: ["source-a"] }),
      fact("충전소 개수는 3000개다.", { sourceIds: ["source-b"] }),
    ];

    expect(detectConflictingVerifiedFacts(verifiedFacts)).toEqual([]);
  });
});
