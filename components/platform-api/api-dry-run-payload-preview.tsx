// Phase 3-21: Platform API Publishing Preparation.
// API dry-run payload를 preview 중심으로 보여준다. full post_body/
// caption은 <details>로 접어두고, payloadShape 원문은 JSON으로
// 보여주되 이 컴포넌트도 로그를 남기지 않는다(순수 렌더링).

import type { PlatformApiPublishDryRunPayload } from "@/lib/social/platform-api-publish-payload-builder";

export function ApiDryRunPayloadPreview({ payload }: { payload: PlatformApiPublishDryRunPayload }) {
  return (
    <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-xs">
      <p className="font-medium text-indigo-800">
        API Dry-run Payload ({payload.platform}) — {payload.validation.valid ? "유효함" : "유효하지 않음"}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-600">title</dt>
          <dd className="text-zinc-600">{payload.title || "-"}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-600">hashtags</dt>
          <dd className="text-zinc-600">{payload.hashtags.length > 0 ? payload.hashtags.map((h) => `#${h}`).join(" ") : "-"}</dd>
        </div>
      </dl>
      {payload.textPreview && (
        <div className="mt-2">
          <p className="font-medium text-zinc-600">text preview</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-600">{payload.textPreview}</p>
        </div>
      )}
      {payload.captionPreview && (
        <div className="mt-2">
          <p className="font-medium text-zinc-600">caption preview</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-600">{payload.captionPreview}</p>
        </div>
      )}

      {payload.validation.errors.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-red-700">validation errors</p>
          <ul className="mt-1 list-inside list-disc text-red-600">
            {payload.validation.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-zinc-500">payloadShape 원문 보기 (플랫폼 API 형태 모방, 실제 호출용 아님)</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-[11px] text-zinc-700">{JSON.stringify(payload.payloadShape, null, 2)}</pre>
      </details>

      <p className="mt-2 text-[11px] text-zinc-400">
        이 payload는 실제 API 호출에 쓰이는 최종 object가 아니며, 어떤 값도 pipeline_logs에 저장되지 않습니다.
      </p>
    </div>
  );
}
