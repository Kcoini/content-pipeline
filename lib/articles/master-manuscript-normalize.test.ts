// Phase 4-9: "Cannot read properties of undefined (reading 'filter')"
// 재발 방지 — 신/구 버전 마스터 원고 JSON을 정규화해도 항상 완전한
// 배열/객체 shape이 나오는지 검증한다.

import { describe, expect, it } from "vitest";
import { normalizeMasterManuscript } from "./master-manuscript-normalize";

describe("normalizeMasterManuscript", () => {
  it("null/undefined/배열/원시값이면 null을 반환한다", () => {
    expect(normalizeMasterManuscript(null)).toBeNull();
    expect(normalizeMasterManuscript(undefined)).toBeNull();
    expect(normalizeMasterManuscript([])).toBeNull();
    expect(normalizeMasterManuscript("문자열")).toBeNull();
    expect(normalizeMasterManuscript(42)).toBeNull();
  });

  it("Phase 4-8 이전에 저장된 원고(evidenceMap/issues/readerMeaning이 없음)를 읽어도 배열로 채워진다", () => {
    // 실제로 이 문제로 화면이 죽었던 시나리오 재현: 이전 버전 빌더가
    // 만든 JSON에는 이 세 필드가 아예 없었다.
    const oldShapeManuscript = {
      theme: { title: "제목" },
      sourceSummaries: [{ sourceId: "s1", title: "출처1" }],
      verifiedFacts: [{ fact: "사실 A", sourceIds: ["s1"], confidence: "high" }],
      factInterpretationSplit: [],
      mainMessage: "핵심 메시지",
      supportingMessages: ["보조 메시지"],
      background: "배경",
      // evidenceMap, issues, readerMeaning 없음(구버전)
      verificationNeeded: ["확인 필요 사항 1"],
      prohibitedOrCarefulExpressions: { prohibited: ["금지1"], careful: [] },
      titleCandidates: { neutral: "제목" },
      platformBriefs: { wordpressBlog: { seoKeywords: ["kw"] } },
      // longFormSupport, optimizationSupport 없음(더 오래된 버전)
      autoReviewCriteria: ["기준1"],
      generatedFromMode: "source_based_explainer",
      builtAt: "2026-01-01T00:00:00.000Z",
    };

    const normalized = normalizeMasterManuscript(oldShapeManuscript);
    expect(normalized).not.toBeNull();

    // 실제 버그였던 호출들이 이제 안전하게 동작하는지 확인한다.
    expect(() => normalized!.evidenceMap.filter((e) => e.strength !== "weak")).not.toThrow();
    expect(() => normalized!.issues.filter(Boolean)).not.toThrow();
    expect(() => normalized!.readerMeaning.filter(Boolean)).not.toThrow();
    expect(normalized!.evidenceMap).toEqual([]);
    expect(normalized!.issues).toEqual([]);
    expect(normalized!.readerMeaning).toEqual([]);

    // 나머지 필드는 원래 값을 보존한다.
    expect(normalized!.mainMessage).toBe("핵심 메시지");
    expect(normalized!.verifiedFacts).toHaveLength(1);
    expect(normalized!.verificationNeeded).toEqual(["확인 필요 사항 1"]);

    // longFormSupport/optimizationSupport가 아예 없어도 object로 채워진다.
    expect(normalized!.longFormSupport.sectionPlan).toEqual([]);
    expect(normalized!.longFormSupport.evidenceMap).toEqual([]);
    expect(normalized!.optimizationSupport.eeatNotes).toEqual({});
  });

  it("platformBriefs의 특정 플랫폼 값이 null이어도 빈 객체로 채워진다", () => {
    const normalized = normalizeMasterManuscript({
      theme: {},
      platformBriefs: { naverCafe: null, wordpressBlog: undefined },
    });
    expect(normalized!.platformBriefs.naverCafe).toEqual({});
    expect(normalized!.platformBriefs.wordpressBlog).toEqual({});
    expect(normalized!.platformBriefs.newsArticle).toEqual({});
  });

  it("verifiedFacts 항목이 문자열 배열처럼 잘못된 모양이어도 죽지 않고 안전한 기본값으로 채운다", () => {
    const normalized = normalizeMasterManuscript({
      theme: {},
      verifiedFacts: ["이건 원래 object여야 하는데 문자열이 들어옴", null, { fact: "정상 사실", sourceIds: "문자열아님" }],
    });
    expect(normalized!.verifiedFacts).toHaveLength(3);
    expect(normalized!.verifiedFacts[0].sourceIds).toEqual([]);
    expect(normalized!.verifiedFacts[2].fact).toBe("정상 사실");
    expect(normalized!.verifiedFacts[2].sourceIds).toEqual([]);
  });

  it("완전한 마스터 원고는 필드를 그대로 보존한다(정규화가 데이터를 훼손하지 않는다)", () => {
    const complete = {
      theme: { title: "T", topic: "T", audience: "A", purpose: "P", referenceDate: "2026-01-01", region: "확인 필요", topicType: "해설" },
      sourceSummaries: [],
      verifiedFacts: [],
      factInterpretationSplit: [],
      mainMessage: "M",
      supportingMessages: [],
      background: "B",
      evidenceMap: [{ claim: "C", supportingSourceIds: ["s1"], strength: "strong", caution: "" }],
      issues: [{ issue: "I", positiveView: "PV", concern: "CN", readerCheckPoint: "RC", sourceIds: [] }],
      readerMeaning: ["RM"],
      verificationNeeded: [],
      prohibitedOrCarefulExpressions: { prohibited: [], careful: [] },
      titleCandidates: { neutral: "", explainer: "", seo: "", socialHook: "", cafeQuestion: "", newsArticle: "" },
      platformBriefs: {},
      longFormSupport: { recommendedLength: "", sourceSufficiency: "", sectionPlan: [], paragraphPoints: [], evidenceMap: [], expansionNotes: [], examplesAndAnalogies: [], tablesAndLists: [], faqBank: [], cautionBank: [], newsArticleExpansion: {}, monetizedBlogExpansion: {} },
      optimizationSupport: { eeatNotes: {}, seoSupport: {}, aeoSupport: {}, geoSupport: {}, agentReadiness: {} },
      autoReviewCriteria: [],
      generatedFromMode: "monetized_blog",
      builtAt: "2026-01-01T00:00:00.000Z",
    };
    const normalized = normalizeMasterManuscript(complete);
    expect(normalized!.evidenceMap).toEqual(complete.evidenceMap);
    expect(normalized!.issues).toEqual(complete.issues);
    expect(normalized!.readerMeaning).toEqual(["RM"]);
  });
});
