// Phase 2-6: WordPress Media Upload Preparation 타입 정의.
// 실제 이미지 생성/다운로드/업로드는 하지 않으며, WordPress media endpoint에
// 전달할 "준비된 payload" 구조만 다룬다.

import type { WordPressMediaSourceType, WordPressMediaUploadStatus } from "@/lib/types/domain";

export type { WordPressMediaSourceType, WordPressMediaUploadStatus };

/** WordPress media endpoint에 전달할 준비된 업로드 payload. */
export interface WordPressMediaUploadPayload {
  articleId: string;
  sourceType: WordPressMediaSourceType;
  sourceUrl?: string;
  localPath?: string;
  filename: string;
  mimeType: string;
  altText: string;
  caption: string;
  title: string;
  description: string;
  aspectRatio: string;
  /** 업로드 후 featured_media로 지정할지 여부 (기본 true) */
  shouldSetAsFeatured: boolean;
  /** 이 payload가 dry-run 확인 목적으로만 준비되었는지 여부 */
  dryRun: boolean;
  /** 실제 업로드 구현 후 채워질 필드 (현재는 항상 undefined) */
  wordpressMediaId?: number;
  wordpressUrl?: string;
}
