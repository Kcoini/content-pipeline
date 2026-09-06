import { describe, expect, it } from "vitest";
import { groupThemeClustersForDisplay } from "./theme-cluster-display";
import type { ThemeCluster } from "@/lib/types/domain";

function makeCluster(overrides: Partial<ThemeCluster> = {}): ThemeCluster {
  return {
    id: "cluster-1",
    title: "AI 산업 동향",
    description: "설명",
    keywords: ["AI"],
    naverCount: 10,
    daumCount: 5,
    score: 20,
    status: "candidate",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    normalizedKey: "ai 동향 산업",
    subtopics: [],
    evidence: [],
    seenCount: 1,
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupThemeClustersForDisplay", () => {
  it("같은 normalizedKey를 가진 후보 3개는 그룹 1개(대표 후보 1개)로 묶인다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 49, lastSeenAt: "2026-01-03T00:00:00.000Z" }),
      makeCluster({ id: "b", score: 43, lastSeenAt: "2026-01-02T00:00:00.000Z" }),
      makeCluster({ id: "c", score: 41, lastSeenAt: "2026-01-01T00:00:00.000Z" }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups).toHaveLength(1);
    expect(groups[0].mergedCandidates).toHaveLength(2);
  });

  it("대표 후보는 score가 가장 높은 후보로 선택된다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 41 }),
      makeCluster({ id: "b", score: 49 }),
      makeCluster({ id: "c", score: 43 }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups[0].representative.id).toBe("b");
    expect(groups[0].mergedCandidates.map((c) => c.id).sort()).toEqual(["a", "c"]);
  });

  it("score가 같으면 evidence 개수가 많은 후보가 대표가 된다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 40, evidence: [{ platform: "naver", title: "t1", url: null }] }),
      makeCluster({
        id: "b",
        score: 40,
        evidence: [
          { platform: "naver", title: "t2", url: null },
          { platform: "daum", title: "t3", url: null },
        ],
      }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups[0].representative.id).toBe("b");
  });

  it("score/evidence가 같으면 가장 최근 lastSeenAt 후보가 대표가 된다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 40, lastSeenAt: "2026-01-01T00:00:00.000Z" }),
      makeCluster({ id: "b", score: 40, lastSeenAt: "2026-01-05T00:00:00.000Z" }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups[0].representative.id).toBe("b");
  });

  it("normalizedKey가 비어 있어도(예: migration 이전 데이터) 제목으로 즉석 계산해 그룹핑한다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 49, normalizedKey: "" }),
      makeCluster({ id: "b", score: 43, normalizedKey: "" }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups).toHaveLength(1);
  });

  it("normalizedKey가 다르지만 candidate 상태이고 제목 유사도가 높으면 병합한다", () => {
    const clusters = [
      makeCluster({
        id: "a",
        title: "제주 신혼부부·청년 주거 지원 2026",
        normalizedKey: "신혼부부 주거 제주 청년",
        score: 10,
      }),
      makeCluster({
        id: "b",
        title: "제주 청년 신혼부부 주거지원 조건",
        normalizedKey: "다른키",
        score: 8,
      }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups).toHaveLength(1);
  });

  it("이미 selected/dismissed로 확정된 후보끼리는 제목 유사도만으로 병합하지 않는다", () => {
    const clusters = [
      makeCluster({
        id: "a",
        title: "제주 신혼부부·청년 주거 지원 2026",
        normalizedKey: "신혼부부 주거 제주 청년",
        status: "selected",
      }),
      makeCluster({
        id: "b",
        title: "제주 청년 신혼부부 주거지원 조건",
        normalizedKey: "다른키",
        status: "dismissed",
      }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups).toHaveLength(2);
  });

  it("서로 다른 주제는 별도 그룹으로 유지된다", () => {
    const clusters = [
      makeCluster({ id: "a", title: "AI 산업 동향", normalizedKey: "ai 동향 산업" }),
      makeCluster({ id: "b", title: "반도체 수출 동향", normalizedKey: "동향 반도체 수출" }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups).toHaveLength(2);
  });

  it("naver/daum count, seenCount를 그룹 전체 합산으로 계산한다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 49, naverCount: 27, daumCount: 13, seenCount: 1 }),
      makeCluster({ id: "b", score: 43, naverCount: 15, daumCount: 5, seenCount: 1 }),
      makeCluster({ id: "c", score: 41, naverCount: 11, daumCount: 3, seenCount: 1 }),
    ];

    const [group] = groupThemeClustersForDisplay(clusters);

    expect(group.aggregatedNaverCount).toBe(53);
    expect(group.aggregatedDaumCount).toBe(21);
    expect(group.aggregatedSeenCount).toBe(3);
  });

  it("병합된 후보의 subtopics를 대표 후보 subtopics에 합치고 중복은 제거한다", () => {
    const clusters = [
      makeCluster({ id: "a", score: 49, subtopics: ["신혼부부 대출이자 지원"] }),
      makeCluster({ id: "b", score: 43, subtopics: ["신혼부부  대출이자   지원", "청년 전세이자 지원"] }),
    ];

    const [group] = groupThemeClustersForDisplay(clusters);

    expect(group.aggregatedSubtopics).toContain("신혼부부 대출이자 지원");
    expect(group.aggregatedSubtopics).toContain("청년 전세이자 지원");
    expect(group.aggregatedSubtopics).toHaveLength(2); // 공백만 다른 중복은 하나로 합쳐짐
  });

  it("evidence는 URL 기준으로 중복 제거해 합산한다", () => {
    const clusters = [
      makeCluster({
        id: "a",
        score: 49,
        evidence: [{ platform: "naver", title: "기사1", url: "https://example.com/1" }],
      }),
      makeCluster({
        id: "b",
        score: 43,
        evidence: [
          { platform: "naver", title: "기사1(중복 URL)", url: "https://example.com/1" },
          { platform: "daum", title: "기사2", url: "https://example.com/2" },
        ],
      }),
    ];

    const [group] = groupThemeClustersForDisplay(clusters);

    expect(group.aggregatedEvidence).toHaveLength(2);
  });

  it("raw 후보 데이터(원본 ThemeCluster 객체) 자체는 변경하지 않는다", () => {
    const original = makeCluster({ id: "a", score: 49 });
    const clusters = [original, makeCluster({ id: "b", score: 43 })];

    groupThemeClustersForDisplay(clusters);

    expect(original.score).toBe(49);
    expect(original.id).toBe("a");
  });

  it("daum 근거가 0건이면 daumEvidenceStrength가 none이다(네이버 중심 테마)", () => {
    const [group] = groupThemeClustersForDisplay([makeCluster({ daumCount: 0 })]);
    expect(group.daumEvidenceStrength).toBe("none");
  });

  it("daum 근거가 1~2건이면 daumEvidenceStrength가 weak이다", () => {
    const [group] = groupThemeClustersForDisplay([makeCluster({ daumCount: 2 })]);
    expect(group.daumEvidenceStrength).toBe("weak");
  });

  it("daum 근거가 3건 이상이면 daumEvidenceStrength가 strong이다", () => {
    const [group] = groupThemeClustersForDisplay([makeCluster({ daumCount: 3 })]);
    expect(group.daumEvidenceStrength).toBe("strong");
  });

  it("daum 근거가 적다는 이유만으로 그룹 자체가 사라지지 않는다", () => {
    const groups = groupThemeClustersForDisplay([
      makeCluster({ id: "a", title: "AI", normalizedKey: "ai", daumCount: 0, naverCount: 10, score: 10 }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("결과는 대표 후보 score 내림차순으로 정렬된다", () => {
    const clusters = [
      makeCluster({ id: "a", title: "반도체", normalizedKey: "반도체", score: 10 }),
      makeCluster({ id: "b", title: "AI", normalizedKey: "ai", score: 30 }),
    ];

    const groups = groupThemeClustersForDisplay(clusters);

    expect(groups[0].representative.id).toBe("b");
    expect(groups[1].representative.id).toBe("a");
  });
});
