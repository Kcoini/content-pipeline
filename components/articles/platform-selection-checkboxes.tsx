"use client";

// Phase 3-21: "플랫폼별 글 생성" 섹션에서 사용하는 체크박스 그룹.
// "추천 플랫폼 선택"/"전체 선택"/"선택 해제" 버튼은 페이지 새로고침 없이
// 체크 상태만 바꾸면 되므로, 이 부분만 작은 client component로 분리했다.
// 실제 제출은 감싸는 <form action={...}>가 그대로 처리한다(이 컴포넌트는
// 폼 제출 로직을 갖지 않는다 — name="platforms" 체크박스만 렌더링한다).

import { useState } from "react";

export interface PlatformCheckboxOption {
  value: string;
  label: string;
  description: string;
  costLevel: "low" | "medium" | "high";
  statusLabel: string;
  recommended: boolean;
}

const COST_LEVEL_LABEL: Record<PlatformCheckboxOption["costLevel"], string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
};

const COST_LEVEL_STYLE: Record<PlatformCheckboxOption["costLevel"], string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export function PlatformSelectionCheckboxes({ options }: { options: PlatformCheckboxOption[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.map((o) => [o.value, o.recommended]))
  );

  const setAll = (value: boolean) => {
    setChecked(Object.fromEntries(options.map((o) => [o.value, value])));
  };
  const applyRecommended = () => {
    setChecked(Object.fromEntries(options.map((o) => [o.value, o.recommended])));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={applyRecommended}
          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
        >
          추천 플랫폼 선택
        </button>
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
        >
          선택 해제
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-2 rounded border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50"
          >
            <input
              type="checkbox"
              name="platforms"
              value={option.value}
              checked={checked[option.value] ?? false}
              onChange={(e) => setChecked((prev) => ({ ...prev, [option.value]: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-zinc-800">{option.label}</span>
                {option.recommended && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">추천</span>
                )}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${COST_LEVEL_STYLE[option.costLevel]}`}>
                  예상 비용 {COST_LEVEL_LABEL[option.costLevel]}
                </span>
              </span>
              <span className="mt-0.5 block break-keep text-[11px] text-zinc-500">{option.description}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-400">{option.statusLabel}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
