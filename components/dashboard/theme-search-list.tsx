"use client";

// Phase 1-23: 대시보드 좌측 사이드바 — 테마 검색 + 목록.
// 검색은 클라이언트에서 즉시 필터링한다(서버 왕복 없음). 삭제(archiveThemeAction)는
// 서버 액션을 그대로 prop으로 전달받아 사용한다 — 기능 로직은 변경하지 않는다.

import { useMemo, useState } from "react";
import { ConfirmSubmitButton } from "@/app/articles/[id]/confirm-submit-button";
import { filterThemesByQuery } from "@/lib/dashboard/theme-search";
import type { Theme } from "@/lib/types/domain";

export interface ThemeListEntry {
  theme: Theme;
  articleCount: number;
  sourceCount: number;
  /** Phase 3-23-3: 동일 제목 테마도 구분할 수 있도록 추가한 진행 단계 라벨(예: "승인 1"/"검토 대기"/"생성 전"). */
  stageLabel: string;
  /** 등록일(YYYY-MM-DD 등, 이미 포맷된 문자열). theme.createdAt 기준 — DB에 별도 수정일 컬럼을 추가하지 않았다. */
  dateLabel: string;
}

export interface ThemeSearchListProps {
  items: ThemeListEntry[];
  selectedThemeId?: string;
  archiveAction: (formData: FormData) => void | Promise<void>;
}

export function ThemeSearchList({ items, selectedThemeId, archiveAction }: ThemeSearchListProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterThemesByQuery(items, query, (entry) => entry.theme.title), [items, query]);

  if (items.length === 0) {
    return <p className="mt-2 text-xs text-zinc-500">아직 등록된 테마가 없습니다.</p>;
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="테마 검색"
        aria-label="테마 검색"
        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
      />

      {filtered.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">검색 결과가 없습니다.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {filtered.map(({ theme, articleCount, sourceCount, stageLabel, dateLabel }) => {
            const isSelected = selectedThemeId === theme.id;
            const confirmMessage = [
              "이 테마를 삭제하시겠습니까?",
              "",
              `연결된 기사 ${articleCount}개, 출처 ${sourceCount}개가 있습니다.`,
              "연결된 기사와 출처가 있을 경우 영향을 받을 수 있습니다.",
              "이미 생성된 WordPress 글은 자동 삭제되지 않습니다.",
            ].join("\n");

            return (
              <li
                key={theme.id}
                className={`flex items-center gap-1 rounded ${isSelected ? "border-l-4 border-zinc-900 bg-zinc-50" : ""}`}
              >
                {/* Phase 3-23-3: 제목만 보여주면 동일 제목 테마를 구분할 수
                    없었다 — 출처 수/진행 단계/등록일을 부제목으로 추가한다. */}
                <a
                  href={`/dashboard?themeId=${theme.id}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={`block min-w-0 flex-1 rounded px-2 py-1 ${
                    isSelected ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <span className={`block break-keep text-sm ${isSelected ? "font-medium text-white" : "text-zinc-800"}`}>
                    {theme.title}
                  </span>
                  <span className={`block text-[11px] ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                    출처 {sourceCount} · {stageLabel} · {dateLabel}
                  </span>
                </a>
                <form action={archiveAction}>
                  <input type="hidden" name="themeId" value={theme.id} />
                  <ConfirmSubmitButton
                    confirmMessage={confirmMessage}
                    className="shrink-0 rounded px-1.5 py-1 text-[10px] font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600"
                  >
                    삭제
                  </ConfirmSubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
