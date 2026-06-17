import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // evals/, contracts/, prompts/ 디렉터리는 readFileSync로 서버 런타임에 읽힌다.
  // Vercel 서버리스 번들에 자동 포함되지 않을 수 있으므로 명시적으로 추적 대상에 포함한다.
  outputFileTracingIncludes: {
    "**": ["./evals/**", "./contracts/**", "./prompts/**"],
  },
};

export default nextConfig;
