import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageSource = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("trends 페이지 - 공통 테마 후보 중복 방지 UI (정적 소스 검사, Phase 1-16)", () => {
  it("groupThemeClustersForDisplay로 대표 후보만 목록에 표시한다", () => {
    expect(pageSource).toContain("groupThemeClustersForDisplay");
    expect(pageSource).toContain("displayGroups.map((group)");
  });

  it("하위 주제(subtopics)를 별도 후보가 아니라 대표 테마 카드 안에 표시한다", () => {
    expect(pageSource).toContain("하위 주제");
    expect(pageSource).toContain("aggregatedSubtopics");
  });

  it("원본 근거(raw evidence)는 기본 숨김(<details>) 안에서만 보여주고, 병합된 후보의 근거도 함께 합쳐서 보여준다", () => {
    expect(pageSource).toContain("근거 보기");
    expect(pageSource).toContain("<details");
    expect(pageSource).toContain("aggregatedEvidence");
  });

  it("반복 발견 횟수(seenCount)와 마지막 발견 시각(lastSeenAt)을 합산해 표시한다", () => {
    expect(pageSource).toContain("aggregatedSeenCount");
    expect(pageSource).toContain("latestLastSeenAt");
    expect(pageSource).toContain("반복 발견");
  });

  it("유사 후보가 병합된 경우 병합 개수와 함께 안내 배지를 표시한다", () => {
    expect(pageSource).toMatch(/유사 후보 \{mergedCandidates\.length\}개 병합됨/);
  });

  it("병합된 후보는 접기 영역(병합된 후보 보기)에서만 표시한다", () => {
    expect(pageSource).toContain("병합된 후보 보기");
    expect(pageSource).toContain("MergedCandidateRow");
  });

  it("병합된 후보 행(MergedCandidateRow)에는 기사 작성 시작 버튼이 없다", () => {
    const match = pageSource.match(/function MergedCandidateRow[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match?.[0]).not.toContain("이 테마로 기사 작성 시작");
  });

  it("기사 작성 시작 버튼은 대표 후보(representative.id)로만 동작한다", () => {
    expect(pageSource).toContain("selectClusterAsTheme(representative.id)");
    expect(pageSource).toContain("이 테마로 기사 작성 시작");
  });

  it("대표 후보 badge(대표 후보/기사 작성 가능)를 표시한다", () => {
    expect(pageSource).toContain("대표 후보");
    expect(pageSource).toContain("기사 작성 가능");
  });

  it("daum 근거 강도(daumEvidenceStrength)에 따라 안내 배지를 표시한다 (Phase 1-17)", () => {
    expect(pageSource).toContain("daumEvidenceStrength");
    expect(pageSource).toContain("네이버 중심 테마");
    expect(pageSource).toContain("다음 근거 약함");
  });
});

describe("trends 페이지 - 테마 후보 카드 제목/설명 레이아웃 (정적 소스 검사, Phase 1-18/1-19)", () => {
  function getClusterCardSource(): string {
    const match = pageSource.match(/function ClusterCard[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    return match![0];
  }

  it("헤더(제목+점수) row 안에는 description/병합 정보를 넣지 않는다", () => {
    const cardSource = getClusterCardSource();
    const headerMatch = cardSource.match(
      /<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">[\s\S]*?<\/div>\s*<\/div>/
    );
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![0]).not.toContain("representative.description");
    expect(headerMatch![0]).not.toContain("병합 후보");
  });

  it("병합 여부는 배지(유사 후보 N개 병합됨)만으로 표시하고, 중복되는 별도 문구를 헤더 근처에 두지 않는다(Phase 1-21 단순화)", () => {
    const cardSource = getClusterCardSource();
    expect(cardSource).not.toContain("대표 점수 · 병합 후보");
    expect(cardSource).toMatch(/유사 후보 \{mergedCandidates\.length\}개 병합됨/);
  });

  it("점수 영역에는 score와 '점수' 라벨만 표시한다(병합 문구를 표시하지 않는다)", () => {
    const cardSource = getClusterCardSource();
    const scoreBlockMatch = cardSource.match(/<div className="shrink-0 text-right sm:w-16">[\s\S]*?<\/div>/);
    expect(scoreBlockMatch).not.toBeNull();
    expect(scoreBlockMatch![0]).toContain("{representative.score}");
    expect(scoreBlockMatch![0]).toContain(">점수<");
    expect(scoreBlockMatch![0]).not.toContain("병합");
  });

  it("설명문은 헤더 아래 별도 <p>에서 w-full로 카드 전체 폭을 사용한다", () => {
    const cardSource = getClusterCardSource();
    expect(cardSource).toMatch(/<p className="mt-2 w-full max-w-none break-keep[^"]*">\s*\{representative\.description\}/);
  });

  it("제목 h3에는 min-w-0/flex-1/break-keep/leading-snug을 적용하고, max-w/truncate/line-clamp는 쓰지 않는다", () => {
    const cardSource = getClusterCardSource();
    const titleMatch = cardSource.match(/<h3 className="([^"]*)">\s*\{representative\.title\}/);
    expect(titleMatch).not.toBeNull();
    const titleClassName = titleMatch![1];
    expect(titleClassName).toContain("min-w-0");
    expect(titleClassName).toContain("flex-1");
    expect(titleClassName).toContain("break-keep");
    expect(titleClassName).toContain("leading-snug");
    expect(titleClassName).not.toMatch(/max-w-(?!none)/);
    expect(titleClassName).not.toContain("truncate");
    expect(titleClassName).not.toContain("line-clamp");
  });

  it("하위 주제 태그에도 break-keep을 적용한다", () => {
    const cardSource = getClusterCardSource();
    expect(cardSource).toContain("break-keep rounded border border-zinc-200 bg-zinc-50"); // 하위 주제 태그
  });

  it("헤더는 모바일에서 flex-col, sm 이상에서만 flex-row로 배치한다", () => {
    const cardSource = getClusterCardSource();
    expect(cardSource).toContain(
      'className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"'
    );
  });

  it("카드 내부 섹션 순서가 헤더 → 설명 → 배지 → count 정보 → 태그/하위 주제(접기) → 병합된 후보(접기) → 근거(접기) 순이다(Phase 1-21)", () => {
    const cardSource = getClusterCardSource();
    const headerIndex = cardSource.indexOf('sm:flex-row sm:items-start sm:justify-between sm:gap-4">');
    const descriptionIndex = cardSource.indexOf("{representative.description}");
    const badgeIndex = cardSource.indexOf("대표 후보</span>");
    const countIndex = cardSource.indexOf("네이버 {aggregatedNaverCount}건");
    const subtopicsDetailsIndex = cardSource.indexOf("하위 주제 보기");
    const mergedDetailsIndex = cardSource.indexOf("병합된 후보 보기");
    const evidenceDetailsIndex = cardSource.indexOf("근거 보기");

    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(headerIndex).toBeLessThan(descriptionIndex);
    expect(descriptionIndex).toBeLessThan(badgeIndex);
    expect(badgeIndex).toBeLessThan(countIndex);
    expect(countIndex).toBeLessThan(subtopicsDetailsIndex);
    expect(subtopicsDetailsIndex).toBeLessThan(mergedDetailsIndex);
    expect(mergedDetailsIndex).toBeLessThan(evidenceDetailsIndex);
  });

  it("기본 화면에서 숨기는 정보(하위 주제 전체/병합된 후보 전체/근거 전체/태그)는 <details>(기본 접힘) 안에만 있다", () => {
    const cardSource = getClusterCardSource();
    expect(cardSource).toMatch(/<details className="mt-2 text-xs">\s*<summary[^>]*>\s*하위 주제 보기/);
    expect(cardSource).toMatch(/<details className="mt-2 text-xs">\s*<summary[^>]*>\s*병합된 후보 보기/);
    expect(cardSource).toMatch(/<details className="mt-2 text-xs">\s*<summary[^>]*>\s*근거 보기/);
  });

  it("접기 영역 summary는 secondary link 스타일(text-blue-600)로 primary button과 구분된다", () => {
    const cardSource = getClusterCardSource();
    const summaryMatches = cardSource.match(/<summary className="[^"]*">/g) ?? [];
    expect(summaryMatches.length).toBeGreaterThan(0);
    for (const summary of summaryMatches) {
      expect(summary).toContain("text-blue-600");
    }
  });

  it("MergedCandidateRow의 제목도 break-keep과 min-w-0 flex-1을 적용해 카드 폭을 활용한다", () => {
    const match = pageSource.match(/function MergedCandidateRow[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/className="min-w-0 flex-1 break-keep text-sm font-medium text-zinc-700"/);
  });
});

describe("trends 페이지 - 대표 테마 선택 중심 UI 개편 (정적 소스 검사, Phase 1-21)", () => {
  it("상단에 수집 요약(네이버/다음/공통 테마/마지막 수집)을 한 줄로 표시한다", () => {
    expect(pageSource).toMatch(
      /수집 결과: 네이버 \{counts\.naver\}건 · 다음 \{counts\.daum\}건 · 공통 테마 \{displayGroups\.length\}건 · 마지막[\s\S]{0,20}수집 \{formatCollectedAt\(lastCollectedAt\)\}/
    );
  });

  it("공통 테마 후보 section이 수집된 트렌드 후보 section보다 DOM 순서상 먼저 온다(모바일 우선 표시)", () => {
    const themeSectionIndex = pageSource.indexOf("공통 테마 후보{\" \"}");
    const rawSectionIndex = pageSource.indexOf("수집된 트렌드 후보{\" \"}");
    expect(themeSectionIndex).toBeGreaterThanOrEqual(0);
    expect(rawSectionIndex).toBeGreaterThanOrEqual(0);
    expect(themeSectionIndex).toBeLessThan(rawSectionIndex);
  });

  it("데스크톱에서 공통 테마 후보 column이 수집된 트렌드 후보보다 넓다(3fr:2fr)", () => {
    expect(pageSource).toContain("lg:grid-cols-[3fr_2fr]");
  });

  it("수집된 트렌드 후보는 기본 접힘 상태(<details>)로 감싸져 있다", () => {
    const rawSectionMatch = pageSource.match(/<section>\s*<details>[\s\S]*?수집된 트렌드 후보/);
    expect(rawSectionMatch).not.toBeNull();
  });

  it("CandidateRow는 compact하게 표시하고, 긴 요약문은 요약 보기(details) 안에만 있다", () => {
    const match = pageSource.match(/function CandidateRow[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    const rowSource = match![0];
    expect(rowSource).toContain("요약 보기");
    expect(rowSource).toMatch(/<details className="mt-0\.5[^"]*">\s*<summary/);
    expect(rowSource).not.toMatch(/line-clamp/);
  });

  it("CandidateRow 제목에도 break-keep을 적용한다", () => {
    const match = pageSource.match(/function CandidateRow[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("break-keep");
  });

  it("raw trend 후보 목록(candidates.slice)은 그대로 유지된다 — 원자료를 삭제하지 않는다", () => {
    expect(pageSource).toContain("candidates.slice(0, 20).map((c)");
  });
});
