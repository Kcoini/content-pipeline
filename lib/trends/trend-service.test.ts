import { describe, expect, it, vi, afterEach } from "vitest";
import { isTrendEnabled, isNaverKeySet, isDaumKeySet } from "./trend-service";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTrendEnabled", () => {
  it("TREND_COLLECTION_ENABLED=false이면 false를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "false");
    expect(isTrendEnabled()).toBe(false);
  });

  it("TREND_COLLECTION_ENABLED=true이면 true를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "true");
    expect(isTrendEnabled()).toBe(true);
  });

  it("환경변수가 없으면 false를 반환한다", () => {
    vi.stubEnv("TREND_COLLECTION_ENABLED", "");
    expect(isTrendEnabled()).toBe(false);
  });
});

describe("isNaverKeySet", () => {
  it("ID와 Secret이 모두 있으면 true를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "test-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-secret");
    expect(isNaverKeySet()).toBe(true);
  });

  it("ID가 없으면 false를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "");
    vi.stubEnv("NAVER_CLIENT_SECRET", "test-secret");
    expect(isNaverKeySet()).toBe(false);
  });

  it("Secret이 없으면 false를 반환한다", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "test-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "");
    expect(isNaverKeySet()).toBe(false);
  });
});

describe("isDaumKeySet", () => {
  it("KAKAO_REST_API_KEY가 있으면 true를 반환한다", () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    expect(isDaumKeySet()).toBe(true);
  });

  it("KAKAO_REST_API_KEY가 없으면 false를 반환한다", () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    expect(isDaumKeySet()).toBe(false);
  });
});
