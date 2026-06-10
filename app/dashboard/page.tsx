import { addSource, createTheme, generateArticleDraft } from "./actions";
import { getLogs } from "@/lib/harness/logger";
import {
  getArticleByThemeId,
  getLatestContractCheck,
  getSourcesByThemeId,
  getStore,
} from "@/lib/store/memory-store";
import type { ContractViolation } from "@/lib/harness/types";

export const dynamic = "force-dynamic";

const MIN_SOURCE_COUNT = 3;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ themeId?: string }>;
}) {
  const { themeId } = await searchParams;
  const store = getStore();
  const themes = store.themes;

  const selectedTheme =
    (themeId && themes.find((theme) => theme.id === themeId)) ||
    themes[themes.length - 1];

  const sources = selectedTheme ? getSourcesByThemeId(selectedTheme.id) : [];
  const article = selectedTheme ? getArticleByThemeId(selectedTheme.id) : undefined;
  const sourceCheck = selectedTheme
    ? getLatestContractCheck(selectedTheme.id, "source")
    : undefined;
  const articleCheck = selectedTheme
    ? getLatestContractCheck(selectedTheme.id, "article")
    : undefined;

  const logs = getLogs().slice(0, 20);

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">content-pipeline 대시보드</h1>
          <p className="mt-1 text-sm text-zinc-600">
            테마 입력 → 출처 등록 → 계약 검사 → 기사 초안 생성(draft)까지의 흐름을 확인합니다.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* 좌측: 테마 목록 + 생성 폼 */}
          <aside className="flex flex-col gap-6">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">새 테마 입력</h2>
              <form action={createTheme} className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  제목 *
                  <input
                    name="title"
                    required
                    placeholder="예: 2026년 AI 에이전트 동향"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  설명
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="기사에서 다룰 내용을 간단히 설명하세요."
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  키워드 (쉼표로 구분)
                  <input
                    name="keywords"
                    placeholder="AI, 에이전트, 자동화"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-600">
                  언어
                  <select
                    name="language"
                    defaultValue="ko"
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="ko">한국어 (ko)</option>
                    <option value="en">English (en)</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="mt-1 rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  테마 생성
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">테마 목록</h2>
              {themes.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">아직 등록된 테마가 없습니다.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {themes.map((theme) => (
                    <li key={theme.id}>
                      <a
                        href={`/dashboard?themeId=${theme.id}`}
                        className={`block rounded px-2 py-1 text-sm ${
                          selectedTheme?.id === theme.id
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {theme.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          {/* 우측: 선택된 테마 상세 */}
          <main className="flex flex-col gap-6">
            {!selectedTheme ? (
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
                왼쪽에서 테마를 먼저 생성하세요.
              </section>
            ) : (
              <>
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">{selectedTheme.title}</h2>
                  {selectedTheme.description && (
                    <p className="mt-1 text-sm text-zinc-600">{selectedTheme.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {selectedTheme.keywords.map((keyword) => (
                      <span key={keyword} className="rounded-full bg-zinc-100 px-2 py-0.5">
                        #{keyword}
                      </span>
                    ))}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                      언어: {selectedTheme.language}
                    </span>
                  </div>
                </section>

                {/* 출처 등록 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">
                      출처 등록 ({sources.length}개 / 최소 {MIN_SOURCE_COUNT}개)
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sources.length >= MIN_SOURCE_COUNT
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {sources.length >= MIN_SOURCE_COUNT ? "조건 충족" : "출처 부족"}
                    </span>
                  </div>

                  <form action={addSource} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input type="hidden" name="themeId" value={selectedTheme.id} />
                    <label className="flex flex-col gap-1 text-xs text-zinc-600 sm:col-span-2">
                      URL
                      <input
                        name="url"
                        type="url"
                        placeholder="https://example.com/article"
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      제목
                      <input
                        name="title"
                        placeholder="출처 제목"
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      출판사 / 기관명
                      <input
                        name="publisher"
                        placeholder="예: OpenAI Blog"
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600">
                      발행일
                      <input
                        name="publishedAt"
                        type="date"
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-600 sm:col-span-2">
                      요약
                      <textarea
                        name="summary"
                        rows={2}
                        placeholder="출처 내용 요약"
                        className="rounded border border-zinc-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                      >
                        출처 추가
                      </button>
                    </div>
                  </form>

                  {sources.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {sources.map((source, index) => (
                        <li
                          key={source.id}
                          className="rounded border border-zinc-200 px-3 py-2 text-sm"
                        >
                          <div className="font-medium">
                            {index + 1}. {source.title || "(제목 없음)"}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {source.url || "(URL 없음)"}
                            {source.publisher && ` · ${source.publisher}`}
                            {source.publishedAt && ` · ${source.publishedAt}`}
                          </div>
                          {source.summary && (
                            <p className="mt-1 text-xs text-zinc-600">{source.summary}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* 기사 생성 + 계약 검사 결과 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">
                      계약 검사 &amp; 기사 초안 생성
                    </h2>
                    <form action={generateArticleDraft}>
                      <input type="hidden" name="themeId" value={selectedTheme.id} />
                      <button
                        type="submit"
                        disabled={sources.length < MIN_SOURCE_COUNT}
                        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                      >
                        기사 초안 생성
                      </button>
                    </form>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <ContractCheckResult
                      label="출처 계약 (source.contract.yaml)"
                      check={sourceCheck}
                    />
                    <ContractCheckResult
                      label="기사 계약 (article.contract.yaml)"
                      check={articleCheck}
                    />
                  </div>
                </section>

                {/* 기사 초안 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-zinc-700">기사 초안</h2>
                  {!article ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      아직 생성된 기사 초안이 없습니다.
                    </p>
                  ) : (
                    <div className="mt-2">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-base font-semibold">{article.title}</h3>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          status: {article.status}
                        </span>
                      </div>
                      <p className="mb-2 text-xs text-zinc-500">
                        인용된 출처: {article.citedSourceIds.length}개 · 본문 길이:{" "}
                        {article.content.length}자
                      </p>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                        {article.content}
                      </pre>
                    </div>
                  )}
                </section>

                {/* 파이프라인 로그 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-zinc-700">파이프라인 로그</h2>
                  {logs.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">아직 기록된 로그가 없습니다.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1">
                      {logs.map((log) => (
                        <li
                          key={log.id}
                          className="flex items-start gap-2 rounded px-2 py-1 text-xs"
                        >
                          <span
                            className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 font-medium ${
                              log.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : log.status === "success"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {log.type}
                          </span>
                          <span className="text-zinc-600">{log.message}</span>
                          <span className="ml-auto shrink-0 text-zinc-400">
                            {new Date(log.createdAt).toLocaleTimeString("ko-KR")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ContractCheckResult({
  label,
  check,
}: {
  label: string;
  check?: { result: { passed: boolean; violations: ContractViolation[] }; checkedAt: string };
}) {
  if (!check) {
    return (
      <div className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-500">
        {label}: 아직 검사하지 않았습니다.
      </div>
    );
  }

  const { passed, violations } = check.result;

  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${
        passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className={passed ? "text-green-700" : "text-red-700"}>
          {passed ? "통과" : `실패 (${violations.length}건)`}
        </span>
      </div>
      {!passed && (
        <ul className="mt-1 list-inside list-disc text-red-700">
          {violations.map((violation, index) => (
            <li key={`${violation.ruleId}-${index}`}>{violation.message}</li>
          ))}
        </ul>
      )}
      <div className="mt-1 text-zinc-400">
        검사 시각: {new Date(check.checkedAt).toLocaleTimeString("ko-KR")}
      </div>
    </div>
  );
}
