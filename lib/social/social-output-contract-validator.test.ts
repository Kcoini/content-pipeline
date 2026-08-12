import { describe, expect, it } from "vitest";
import {
  validateSocialOutput,
  validatePlatform,
  validateToneStyle,
  validateRequiredFieldsByPlatform,
  sanitizeSocialOutput,
} from "./social-output-contract-validator";

describe("validatePlatform / validateToneStyle", () => {
  it("invalid platform을 거부한다", () => {
    expect(validatePlatform("facebook")).toBe(false);
    expect(validatePlatform("wordpress_blog")).toBe(true);
  });

  it("invalid tone_style을 거부한다", () => {
    expect(validateToneStyle("threat")).toBe(false);
    expect(validateToneStyle("informational")).toBe(true);
  });
});

describe("validateSocialOutput", () => {
  it("wordpress_blog output validation을 통과한다", () => {
    const result = validateSocialOutput("wordpress_blog", {
      platform: "wordpress_blog",
      tone_style: "informational",
      post_title: "제목",
      post_body: "본문 내용입니다.",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("naver_blog output validation을 통과한다", () => {
    const result = validateSocialOutput("naver_blog", {
      platform: "naver_blog",
      tone_style: "story",
      post_title: "제목",
      post_body: "본문 내용입니다.",
      hashtags: ["키워드"],
    });

    expect(result.valid).toBe(true);
  });

  it("naver_cafe output validation을 통과한다", () => {
    const result = validateSocialOutput("naver_cafe", {
      platform: "naver_cafe",
      tone_style: "curiosity",
      post_title: "질문 있습니다",
      post_body: "본문 내용입니다.",
    });

    expect(result.valid).toBe(true);
  });

  it("x는 thread_items가 없으면 validation에 실패한다", () => {
    const result = validateSocialOutput("x", {
      platform: "x",
      tone_style: "curiosity",
      thread_items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("thread_items"))).toBe(true);
  });

  it("x는 thread_items가 있으면 통과한다", () => {
    const result = validateSocialOutput("x", {
      platform: "x",
      tone_style: "curiosity",
      thread_items: [{ order: 1, text: "첫 트윗" }],
    });

    expect(result.valid).toBe(true);
  });

  it("instagram은 caption이 없으면 validation에 실패한다", () => {
    const result = validateSocialOutput("instagram", {
      platform: "instagram",
      tone_style: "story",
      hashtags: ["태그"],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("caption"))).toBe(true);
  });

  it("instagram은 caption/hashtags가 있으면 통과한다", () => {
    const result = validateSocialOutput("instagram", {
      platform: "instagram",
      tone_style: "story",
      caption: "캡션",
      hashtags: ["태그"],
    });

    expect(result.valid).toBe(true);
  });

  it("invalid platform은 거부한다", () => {
    const result = validateSocialOutput("facebook", {
      tone_style: "informational",
      post_body: "본문",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("platform"))).toBe(true);
  });

  it("invalid tone_style은 거부한다", () => {
    const result = validateSocialOutput("naver_blog", {
      platform: "naver_blog",
      tone_style: "threat",
      post_title: "제목",
      post_body: "본문",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("tone_style"))).toBe(true);
  });

  it("협박/광고 클릭 유도 등 금지 표현이 포함되면 validation이 실패한다 (blocked)", () => {
    const result = validateSocialOutput("threads", {
      platform: "threads",
      tone_style: "persuasive",
      post_body: "지금 클릭 하시고 광고 클릭 유도하는 문구입니다.",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("광고 클릭"))).toBe(true);
  });

  it("빈 글은 validation에 실패한다", () => {
    const result = validateSocialOutput("threads", {
      platform: "threads",
      tone_style: "informational",
      post_body: "",
    });

    expect(result.valid).toBe(false);
  });

  it("hashtags/thread_items/card_items가 배열이 아니면 실패한다", () => {
    const result = validateSocialOutput("naver_blog", {
      platform: "naver_blog",
      tone_style: "informational",
      post_title: "제목",
      post_body: "본문",
      hashtags: "not-an-array",
    });

    expect(result.valid).toBe(false);
  });

  it("post_body가 비정상적으로 길면 warning을 남긴다 (원문 dump 의심)", () => {
    const result = validateSocialOutput("naver_blog", {
      platform: "naver_blog",
      tone_style: "informational",
      post_title: "제목",
      post_body: "가".repeat(13_000),
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("원문"))).toBe(true);
  });
});

describe("validateRequiredFieldsByPlatform", () => {
  it("threads는 post_body만 필수다", () => {
    expect(validateRequiredFieldsByPlatform("threads", { post_body: "본문" })).toHaveLength(0);
    expect(validateRequiredFieldsByPlatform("threads", {})).toHaveLength(1);
  });
});

describe("sanitizeSocialOutput", () => {
  it("배열이 아닌 필드를 안전하게 빈 배열로 정리한다", () => {
    const sanitized = sanitizeSocialOutput({
      platform: "naver_blog",
      tone_style: "informational",
      hashtags: "not-an-array",
      thread_items: null,
      card_items: undefined,
    });

    expect(sanitized.hashtags).toEqual([]);
    expect(sanitized.thread_items).toEqual([]);
    expect(sanitized.card_items).toEqual([]);
  });
});
