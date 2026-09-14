import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const PLATFORM_PROMPT_FILES = [
  "wordpress-blog.md",
  "naver-blog.md",
  "naver-cafe.md",
  "x-thread.md",
  "threads.md",
  "instagram-caption.md",
  "news-article.md",
  "opinion-column.md",
];

const TONE_PROMPT_FILES = [
  "explanatory.md",
  "informational.md",
  "persuasive.md",
  "warning.md",
  "loss-aversion.md",
  "curiosity.md",
  "comparison.md",
  "story.md",
];

const SAFETY_PROMPT_FILES = [
  "no-threat.md",
  "no-fearmongering.md",
  "no-ad-click-inducement.md",
  "no-false-claim.md",
  "no-copyright-copy.md",
  "no-sensitive-personal-data.md",
];

const CONTRACT_SCHEMA_FILES = [
  "wordpress-blog.schema.json",
  "naver-blog.schema.json",
  "naver-cafe.schema.json",
  "x-thread.schema.json",
  "threads.schema.json",
  "instagram-caption.schema.json",
];

describe("prompts/social/*.md", () => {
  it.each(PLATFORM_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "social", fileName))).toBe(true);
  });
});

describe("prompts/tones/*.md", () => {
  it.each(TONE_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "tones", fileName))).toBe(true);
  });
});

describe("prompts/safety/*.md", () => {
  it.each(SAFETY_PROMPT_FILES)("%s 파일이 존재한다", (fileName) => {
    expect(existsSync(join(ROOT, "prompts", "safety", fileName))).toBe(true);
  });
});

describe("prompts/social/wordpress-blog.md 구조 강화 지시 (Phase 2-24)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "wordpress-blog.md"), "utf-8");

  it('핵심 요약 박스를 <div class="summary-box">HTML로 지시한다', () => {
    expect(content).toContain('<div class="summary-box">');
    expect(content).toContain("summary-box");
    expect(content).toContain("key-points-box");
    expect(content).toContain("checklist-box");
    expect(content).toContain("warning-box");
    expect(content).toContain("source-box");
  });

  it("inline style을 금지한다", () => {
    expect(content).toMatch(/inline\s*`?style/);
  });

  it("FAQ 최소 4개를 요구한다", () => {
    expect(content).toMatch(/FAQ는 최소 4개/);
  });

  it("경제/금융/정책/제도 주제에 자료 기준일 안내를 요구한다", () => {
    expect(content).toContain("기준일 안내");
  });

  it("최소 1개 이상의 markdown table을 요구한다", () => {
    expect(content).toMatch(/비교표\(최소 1개/);
  });
});

describe("prompts/social/naver-cafe.md 구조 강화 지시 (Phase 3-20)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "naver-cafe.md"), "utf-8");

  it("markdown heading/HTML 태그/굵게(**)/표 사용을 금지한다", () => {
    expect(content).toContain("markdown heading 금지");
    expect(content).toContain("HTML 태그 금지");
    expect(content).toContain("굵게 표시(`**`) 금지");
    expect(content).toContain("표(table) 금지");
  });

  it("plain text로 작성해야 한다고 명시한다", () => {
    expect(content).toContain("plain text");
  });

  it("700~1200자 권장 길이를 명시한다", () => {
    expect(content).toContain("700~1,200자");
  });

  it("제목은 질문형/공감형으로 작성하도록 안내한다", () => {
    expect(content).toContain("질문형 또는 공감형");
  });

  it("본문 마지막에 회원에게 묻는 질문 3~5개를 요구한다", () => {
    expect(content).toMatch(/질문[^\n]*3~5개/);
  });

  it("export/dry-run/handoff payload에 내부 관리 정보를 포함하지 않는다고 명시한다", () => {
    expect(content).toContain("quality_status/approval_status");
    expect(content).toContain("localhost 링크");
  });

  it("Phase 4-24: persuasive/loss_aversion이 지정되어도 강한 설득/협박이 아니라 질문형/경험 공유로 완화하도록 명시한다", () => {
    expect(content).toContain("**persuasive(설득형)**");
    expect(content).toContain("의견을 묻는 질문형");
    expect(content).toContain("**loss_aversion(손실회피형)**");
    expect(content).toContain("경험 공유 + 부드러운 안내");
  });
});

describe("prompts/social/wordpress-blog.md 내부 구성 항목 이름 금지 지시 (Phase 4-21)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "wordpress-blog.md"), "utf-8");

  it("리드문/본문/배경 설명/쟁점/향후 확인할 점/출처를 소제목으로 그대로 쓰지 말라고 명시한다", () => {
    expect(content).toContain('소제목에 마스터 원고 내부 구성 항목 이름("리드문", "본문", "배경');
    expect(content).toContain("그대로 쓰지 않는다");
  });

  it("리드문은 소제목 없이 첫 문단으로 배치하라고 안내한다", () => {
    expect(content).toContain('"리드문"은 아예 소제목 없이 제목 바로 아래 첫');
    expect(content).toContain("문단으로 둔다");
  });
});

describe("prompts/social/news-article.md 내부 구성 항목 이름 금지 지시 (Phase 4-21)", () => {
  const content = readFileSync(join(ROOT, "prompts", "social", "news-article.md"), "utf-8");

  it("리드문/본문/배경 설명/쟁점/향후 확인할 점/출처를 소제목으로 쓰지 말라고 명시한다", () => {
    expect(content).toContain('"리드문"/"본문"/"배경 설명"/');
    expect(content).toContain('"쟁점"/"향후 확인할 점"/"출처"라는 단어 자체를 `post_body`에 소제목');
    expect(content).toContain("(`##`, `**...**` 등)으로 넣지 않는다");
  });

  it("스트레이트 기사는 소제목 없이 문단 중심으로 구성할 수 있다고 안내한다", () => {
    expect(content).toContain("스트레이트 기사(단순 사실 전달)라면 소제목");
  });

  it("자동 검토 체크리스트에 내부 구성 항목 이름 잔존 여부 확인 항목이 있다", () => {
    expect(content).toContain('내부 구성 항목 이름이 소제목으로 그대로 남아 있지 않은가');
  });

  it("출력 JSON 예시에도 더 이상 '리드문 → 본문 → 배경 설명 → 쟁점 → 향후 확인할 점 → 출처' 형태를 그대로 쓰지 않는다", () => {
    expect(content).not.toContain('"post_body": "리드문 → 본문 → 배경 설명 → 쟁점 → 향후 확인할 점 → 출처 순서로 구성된 기사 본문"');
  });
});

describe("contracts/social/*.schema.json", () => {
  it.each(CONTRACT_SCHEMA_FILES)("%s 파일이 존재하고 유효한 JSON이다", (fileName) => {
    const filePath = join(ROOT, "contracts", "social", fileName);
    expect(existsSync(filePath)).toBe(true);

    const raw = readFileSync(filePath, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
