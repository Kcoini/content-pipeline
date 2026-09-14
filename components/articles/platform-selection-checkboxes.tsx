"use client";

// Phase 3-21: "플랫폼별 글 생성" 섹션에서 사용하는 체크박스 그룹.
// "추천 플랫폼 선택"/"전체 선택"/"선택 해제" 버튼은 페이지 새로고침 없이
// 체크 상태만 바꾸면 되므로, 이 부분만 작은 client component로 분리했다.
// 실제 제출은 감싸는 <form action={...}>가 그대로 처리한다(이 컴포넌트는
// 폼 제출 로직을 갖지 않는다 — name="platforms" 체크박스만 렌더링한다).
//
// Phase 4-23: "문체 설정"(추천 문체 자동 적용/전체 같은 문체/플랫폼별
// 직접 선택)을 선택적으로 함께 렌더링한다. 플랫폼 체크 상태를 이미 이
// 컴포넌트가 들고 있어(플랫폼별 직접 선택 모드는 "지금 체크된 플랫폼"만
// 보여줘야 한다), 형제 컴포넌트로 분리하면 상태를 다시 끌어올려야 해서
// 여기 함께 두었다. `toneSelection` prop을 넘기지 않으면 기존과 완전히
// 동일하게 체크박스만 렌더링한다(대시보드의 두 사용처는 여전히 넘기지
// 않는다 — 대시보드는 "추천 문체 자동 적용" 고정 + 문체를 직접 고르고
// 싶으면 이 컴포넌트가 있는 기사 상세 페이지를 안내하는 기존 설계를
// 그대로 유지한다).

import { useState } from "react";
import { computeToneFormFields, type ToneSelectionUiMode } from "@/lib/social/platform-tone-selection-ui-state";

export interface PlatformCheckboxOption {
  value: string;
  label: string;
  description: string;
  costLevel: "low" | "medium" | "high";
  statusLabel: string;
  recommended: boolean;
}

export interface ToneStyleOption {
  value: string;
  label: string;
}

export type { ToneSelectionUiMode };

export interface ToneSelectionConfig {
  /** 문체 드롭다운에 보여줄 전체 tone_style 옵션(한국어 라벨 포함). */
  toneStyleOptions: ToneStyleOption[];
  /** platform value → 추천 tone_style value. "플랫폼별 직접 선택" 드롭다운의 기본값으로 쓴다. */
  recommendedToneByPlatform: Record<string, string>;
}

const RADIO_NAME = "_toneSelectionUiMode";

export function PlatformSelectionCheckboxes({
  options,
  toneSelection,
}: {
  options: PlatformCheckboxOption[];
  toneSelection?: ToneSelectionConfig;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.map((o) => [o.value, o.recommended]))
  );
  const [toneMode, setToneMode] = useState<ToneSelectionUiMode>("auto_recommended");
  const [uniformToneStyle, setUniformToneStyle] = useState<string>(toneSelection?.toneStyleOptions[0]?.value ?? "");
  const [perPlatformTone, setPerPlatformTone] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.value, toneSelection?.recommendedToneByPlatform[o.value] ?? ""]))
  );

  const setAll = (value: boolean) => {
    setChecked(Object.fromEntries(options.map((o) => [o.value, value])));
  };
  const applyRecommended = () => {
    setChecked(Object.fromEntries(options.map((o) => [o.value, o.recommended])));
  };

  const checkedOptions = options.filter((o) => checked[o.value]);
  const toneStyleLabelByValue = Object.fromEntries((toneSelection?.toneStyleOptions ?? []).map((opt) => [opt.value, opt.label]));
  // Phase 4-24: 실제 제출값 계산은 순수 함수(computeToneFormFields)에
  // 위임한다 — "체크 해제된 플랫폼의 문체는 절대 제출하지 않는다" 같은
  // 규칙이 이 한 곳에서만 결정되고, 별도 테스트로 직접 검증된다.
  const toneFormFields = computeToneFormFields({
    toneMode,
    uniformToneStyle,
    perPlatformTone,
    checkedPlatforms: checkedOptions.map((o) => o.value),
  });

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

      {toneSelection && (
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold text-zinc-700">문체 설정</p>
          <div className="mt-2 flex flex-col gap-2 text-xs">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name={RADIO_NAME}
                className="mt-0.5"
                checked={toneMode === "auto_recommended"}
                onChange={() => setToneMode("auto_recommended")}
              />
              <span>
                <span className="font-medium text-zinc-800">추천 문체 자동 적용</span>
                <span className="block text-[11px] text-zinc-500">플랫폼마다 어울리는 문체가 자동으로 적용됩니다.</span>
                {/* Phase 4-24: "추천 문체 자동 적용"이라도 결과를 예측할 수
                    있어야 한다 — 지금 체크된 플랫폼에 실제로 적용될 문체를
                    미리 보여준다(선택을 바꾸지 않고 확인만 하는 용도). */}
                {toneMode === "auto_recommended" && checkedOptions.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-zinc-500">
                    {checkedOptions.map((option) => (
                      <li key={option.value}>
                        {option.label}: {toneStyleLabelByValue[toneSelection.recommendedToneByPlatform[option.value]] ?? "-"}
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="radio"
                name={RADIO_NAME}
                className="mt-0.5"
                checked={toneMode === "same_for_all"}
                onChange={() => setToneMode("same_for_all")}
              />
              <span className="flex-1">
                <span className="font-medium text-zinc-800">전체 플랫폼에 같은 문체 적용</span>
                <span className="block text-[11px] text-zinc-500">선택한 모든 플랫폼 글을 같은 문체로 생성합니다.</span>
                {toneMode === "same_for_all" && (
                  <select
                    value={uniformToneStyle}
                    onChange={(e) => setUniformToneStyle(e.target.value)}
                    className="mt-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                  >
                    {toneSelection.toneStyleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="radio"
                name={RADIO_NAME}
                className="mt-0.5"
                checked={toneMode === "manual_per_platform"}
                onChange={() => setToneMode("manual_per_platform")}
              />
              <span className="flex-1">
                <span className="font-medium text-zinc-800">플랫폼별 문체 직접 선택</span>
                <span className="block text-[11px] text-zinc-500">플랫폼마다 다른 문체를 직접 선택합니다.</span>
                {toneMode === "manual_per_platform" && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    {checkedOptions.length === 0 && (
                      <span className="text-[11px] text-zinc-400">위에서 플랫폼을 먼저 선택하세요.</span>
                    )}
                    {checkedOptions.map((option) => (
                      <label key={option.value} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-zinc-700">{option.label}</span>
                        <select
                          value={perPlatformTone[option.value] ?? ""}
                          onChange={(e) => setPerPlatformTone((prev) => ({ ...prev, [option.value]: e.target.value }))}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          {toneSelection.toneStyleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </span>
            </label>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            플랫폼별 특성에 맞게 문체는 자동으로 완화됩니다. 예를 들어 네이버 카페에서는 강한 설득형 표현을 피하고
            자연스러운 질문형으로 바꿉니다.
          </p>

          {/* 서버 action(parseToneSelectionInputs)이 읽는 실제 폼 필드.
              화면에 보이는 라디오/드롭다운은 위 UI 상태일 뿐이고, 제출되는
              값은 computeToneFormFields가 계산한 이 hidden input들이다. */}
          <input type="hidden" name="toneMode" value={toneFormFields.toneMode} />
          {toneFormFields.uniformToneStyle !== null && (
            <input type="hidden" name="uniformToneStyle" value={toneFormFields.uniformToneStyle} />
          )}
          {toneFormFields.perPlatformEntries.map((entry) => (
            <input key={entry.platform} type="hidden" name={`toneStyle_${entry.platform}`} value={entry.toneStyle} />
          ))}
        </div>
      )}
    </div>
  );
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
