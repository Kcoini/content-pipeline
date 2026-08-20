"use client";

// wordpress_blog 카드 Step 5(대표 이미지)의 "내 컴퓨터에서 이미지 업로드" 폼
// 일부. 파일을 선택하면 업로드 API를 호출하기 전에 같은 카드 안에서
// 파일명/크기/형식/업로드 가능 여부와 (가능하면) 미리보기를 보여준다.
//
// 실제 업로드는 이 컴포넌트를 감싸는 부모 <form action={서버 액션}>이
// 처리한다 — 이 컴포넌트는 반드시 그 form의 자식으로 렌더링되어야 한다
// (제출 버튼이 이 컴포넌트 안에 있고, name="file" input의 값이 그대로
// 부모 form의 FormData에 포함된다).

import { useState, type ChangeEvent } from "react";

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — 기존 "최대 5MB" 안내 문구와 동일하게 맞춘다.

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function WordPressFeaturedImageFilePicker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      if (file && ALLOWED_FILE_TYPES.includes(file.type)) {
        return URL.createObjectURL(file);
      }
      return null;
    });
  }

  const isAllowedType = !selectedFile || ALLOWED_FILE_TYPES.includes(selectedFile.type);
  const isWithinSizeLimit = !selectedFile || selectedFile.size <= MAX_FILE_SIZE_BYTES;
  const canUpload = Boolean(selectedFile) && isAllowedType && isWithinSizeLimit;

  return (
    <>
      <label className="flex flex-col text-indigo-700">
        이미지 파일
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={handleFileChange}
          className="mt-1 text-[11px]"
        />
      </label>
      <label className="flex flex-col text-indigo-700">
        alt text (선택, 추후 지원 예정)
        <input
          type="text"
          name="altText"
          placeholder="대체 텍스트"
          className="mt-1 w-32 rounded border border-zinc-300 px-1.5 py-1"
        />
      </label>
      <label className="flex flex-col text-indigo-700">
        caption (선택, 추후 지원 예정)
        <input
          type="text"
          name="caption"
          placeholder="캡션"
          className="mt-1 w-32 rounded border border-zinc-300 px-1.5 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={!canUpload}
        className="rounded bg-indigo-700 px-2 py-1 font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        WordPress Media로 업로드
      </button>

      {selectedFile && (
        <div className="mt-1 w-full text-[10px] text-indigo-700">
          <p>선택된 파일: {selectedFile.name}</p>
          <p>파일 크기: {formatFileSize(selectedFile.size)}</p>
          <p>파일 형식: {selectedFile.type || "알 수 없음"}</p>
          {!isAllowedType && (
            <p className="text-red-600">지원하지 않는 파일 형식입니다. JPG, PNG, WebP만 사용할 수 있습니다.</p>
          )}
          {isAllowedType && !isWithinSizeLimit && (
            <p className="text-red-600">
              파일이 너무 큽니다({formatFileSize(selectedFile.size)}). 5MB 이하 파일만 업로드할 수 있습니다.
            </p>
          )}
          {canUpload && <p>업로드 전입니다. WordPress Media로 업로드 버튼을 눌러주세요.</p>}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="선택한 대표 이미지 미리보기"
              className="mt-1 h-20 w-20 rounded border border-indigo-200 object-cover"
            />
          )}
        </div>
      )}
    </>
  );
}
