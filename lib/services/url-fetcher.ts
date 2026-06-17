// URL 본문 수집 서비스 (Phase 1-9)
// 서버 전용 - client component에서 import 금지.

import type { FetchStatus } from "@/lib/types/domain";

export interface FetchResult {
  status: FetchStatus;
  rawContent: string | null;
  extractedTitle: string | null;
  fetchError: string | null;
  fetchedAt: string | null;
}

/** 응답 크기 상한 (1 MB) */
const MAX_CONTENT_BYTES = 1024 * 1024;

/** 본문 텍스트 저장 상한 (50,000자) */
const MAX_CONTENT_CHARS = 50_000;

/** 요청 타임아웃 (10초) */
const TIMEOUT_MS = 10_000;

/**
 * private / loopback / link-local 주소를 차단한다.
 * SSRF(Server-Side Request Forgery) 방지.
 */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (h === "localhost" || h === "::1" || h === "0.0.0.0") return true;

  // IPv4: 127.0.0.0/8 loopback
  if (/^127\./.test(h)) return true;
  // IPv4: 10.0.0.0/8 private
  if (/^10\./.test(h)) return true;
  // IPv4: 172.16.0.0/12 private (172.16 ~ 172.31)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  // IPv4: 192.168.0.0/16 private
  if (/^192\.168\./.test(h)) return true;
  // IPv4: 169.254.0.0/16 link-local (AWS/GCP metadata 포함)
  if (/^169\.254\./.test(h)) return true;

  // IPv6: fc00::/7 private (fc**, fd**)
  if (/^(fc|fd)[0-9a-f]{2}/i.test(h)) return true;

  return false;
}

/**
 * 플랫폼별 URL 정규화.
 * JS 렌더링 전용 URL을 서버 사이드 렌더링 URL로 변환한다.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 네이버 블로그: desktop(SPA) → mobile(SSR)
    if (parsed.hostname === "blog.naver.com") {
      parsed.hostname = "m.blog.naver.com";
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/** http / https URL인지 확인한다. */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** HTML에서 <title> 태그 텍스트를 추출한다. */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() || null : null;
}

/**
 * HTML에서 script / style / nav / footer / header / aside를 제거하고
 * 남은 태그를 벗겨 순수 텍스트를 반환한다.
 */
export function extractText(html: string): string {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return text.replace(/\s+/g, " ").trim();
}

/**
 * 지정한 URL의 HTML 본문을 서버에서 가져온다.
 *
 * 실패해도 예외를 던지지 않고 status='failed' 결과를 반환한다.
 * 보안 제한: http/https 전용, private IP 차단, 1MB 크기 제한, 10초 타임아웃.
 */
export async function fetchUrlContent(url: string): Promise<FetchResult> {
  if (!url || !isValidUrl(url)) {
    return {
      status: "failed",
      rawContent: null,
      extractedTitle: null,
      fetchError: "유효하지 않은 URL입니다. http 또는 https URL만 지원합니다.",
      fetchedAt: null,
    };
  }

  const fetchUrl = normalizeUrl(url);
  const parsed = new URL(fetchUrl);
  if (isBlockedHost(parsed.hostname)) {
    return {
      status: "failed",
      rawContent: null,
      extractedTitle: null,
      fetchError: "접근이 차단된 주소입니다 (private/loopback IP).",
      fetchedAt: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "content-pipeline/1.0 (+https://github.com)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: "failed",
        rawContent: null,
        extractedTitle: null,
        fetchError: `HTTP ${response.status} ${response.statusText}`,
        fetchedAt: new Date().toISOString(),
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
      return {
        status: "failed",
        rawContent: null,
        extractedTitle: null,
        fetchError: `지원하지 않는 콘텐츠 타입입니다: ${contentType}`,
        fetchedAt: new Date().toISOString(),
      };
    }

    // 크기 제한을 지키며 본문을 읽는다
    const html = await readWithSizeLimit(response, MAX_CONTENT_BYTES);

    const extractedTitle = extractTitle(html);
    const rawContent = extractText(html).substring(0, MAX_CONTENT_CHARS);

    return {
      status: "success",
      rawContent,
      extractedTitle,
      fetchError: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timer);

    let fetchError = "URL 수집에 실패했습니다.";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        fetchError = `요청 시간이 초과되었습니다 (${TIMEOUT_MS / 1000}초).`;
      } else {
        fetchError = error.message;
      }
    }

    return {
      status: "failed",
      rawContent: null,
      extractedTitle: null,
      fetchError,
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function readWithSizeLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    chunks.push(value);
    if (totalBytes >= maxBytes) {
      await reader.cancel();
      break;
    }
  }

  const merged = new Uint8Array(totalBytes > maxBytes ? maxBytes : totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    const slice = offset + chunk.length > merged.length ? chunk.slice(0, merged.length - offset) : chunk;
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }

  return new TextDecoder().decode(merged);
}
