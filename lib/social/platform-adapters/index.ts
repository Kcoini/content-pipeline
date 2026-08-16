// Phase 3-21: Platform API Publishing Preparation — adapter registry.
// platform 문자열로 알맞은 adapter를 찾아주는 얇은 registry다. 이
// 파일도 외부 API를 호출하지 않는다.

import { wordpressApiPublishAdapter } from "./wordpress-api-publish-adapter";
import { naverBlogApiPublishAdapter } from "./naver-blog-api-publish-adapter";
import { naverCafeApiPublishAdapter } from "./naver-cafe-api-publish-adapter";
import { xApiPublishAdapter } from "./x-api-publish-adapter";
import { threadsApiPublishAdapter } from "./threads-api-publish-adapter";
import { instagramApiPublishAdapter } from "./instagram-api-publish-adapter";
import type { PlatformPublishAdapter } from "../platform-publish-adapter";
import type { SocialPlatform } from "../social-platform-types";

const ADAPTERS: Record<SocialPlatform, PlatformPublishAdapter> = {
  wordpress_blog: wordpressApiPublishAdapter,
  naver_blog: naverBlogApiPublishAdapter,
  naver_cafe: naverCafeApiPublishAdapter,
  x: xApiPublishAdapter,
  threads: threadsApiPublishAdapter,
  instagram: instagramApiPublishAdapter,
};

export function getPlatformPublishAdapter(platform: SocialPlatform): PlatformPublishAdapter {
  return ADAPTERS[platform];
}

export {
  wordpressApiPublishAdapter,
  naverBlogApiPublishAdapter,
  naverCafeApiPublishAdapter,
  xApiPublishAdapter,
  threadsApiPublishAdapter,
  instagramApiPublishAdapter,
};
