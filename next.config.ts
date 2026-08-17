import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // evals/, contracts/, prompts/ 디렉터리는 readFileSync로 서버 런타임에 읽힌다.
  // Vercel 서버리스 번들에 자동 포함되지 않을 수 있으므로 명시적으로 추적 대상에 포함한다.
  outputFileTracingIncludes: {
    "**": ["./evals/**", "./contracts/**", "./prompts/**"],
  },
  experimental: {
    serverActions: {
      // 대표 이미지 로컬 업로드(saveLocalFeaturedImageAction)가 최대
      // 5MB(WORDPRESS_MEDIA_MAX_SIZE_MB 기본값)까지 허용한다고 안내하므로,
      // Next.js 기본 1MB 제한을 그보다 넉넉하게 올려둔다. 그렇지 않으면
      // 1MB~5MB 파일 업로드 시 서버 액션에 도달하기도 전에 요청이 끊겨
      // "Failed to fetch"로 실패한다(정상적인 크기 초과 에러 메시지 대신).
      // WORDPRESS_MEDIA_MAX_SIZE_MB를 올리면 이 값도 함께 올려야 한다.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
