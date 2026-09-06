import Link from "next/link";
import { DashboardTopNav } from "@/components/navigation/dashboard-top-nav";
import { ThemeSearchList } from "@/components/dashboard/theme-search-list";
import { addSource, archiveThemeAction, createTheme, generateArticleDraft } from "./actions";
import { getLogs } from "@/lib/harness/logger";
import { getLatestContractCheck, type ContractCheckRecord } from "@/lib/repositories/log-repository";
import { getThemes, getThemeRelatedCounts } from "@/lib/repositories/theme-repository";
import { getSourcesByThemeId } from "@/lib/repositories/source-repository";
import { getArticleByThemeId } from "@/lib/repositories/article-repository";
import { extractDomain, summarizeSourceStatus, resolveNextActionState } from "@/lib/dashboard/source-display";
import type { Article, Source } from "@/lib/types/domain";
import { ARTICLE_MODE_LIST, DEFAULT_ARTICLE_MODE } from "@/lib/articles/article-modes";
import { TransientNotice } from "@/components/ui/transient-notice";

export const dynamic = "force-dynamic";

const MIN_SOURCE_COUNT = 3;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ themeId?: string; sourceError?: string; deleteMessage?: string; deleteError?: string }>;
}) {
  const { themeId, sourceError, deleteMessage, deleteError } = await searchParams;
  const themes = await getThemes();
  const themeRelatedCounts = await Promise.all(themes.map((theme) => getThemeRelatedCounts(theme.id)));
  const themeListEntries = themes.map((theme, index) => ({
    theme,
    articleCount: themeRelatedCounts[index].articleCount,
    sourceCount: themeRelatedCounts[index].sourceCount,
  }));

  const selectedTheme =
    (themeId && themes.find((theme) => theme.id === themeId)) ||
    themes[themes.length - 1];

  let sources: Source[] = [];
  let article: Article | undefined;
  let sourceCheck: ContractCheckRecord | undefined;
  let articleCheck: ContractCheckRecord | undefined;

  if (selectedTheme) {
    [sources, article, sourceCheck, articleCheck] = await Promise.all([
      getSourcesByThemeId(selectedTheme.id),
      getArticleByThemeId(selectedTheme.id),
      getLatestContractCheck(selectedTheme.id, "source"),
      getLatestContractCheck(selectedTheme.id, "article"),
    ]);
  }

  const logs = await getLogs(20);

  const sourceStatus = summarizeSourceStatus(sources, MIN_SOURCE_COUNT);
  const nextActionState = selectedTheme
    ? resolveNextActionState(sources.length, MIN_SOURCE_COUNT, Boolean(article))
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-end gap-4">
          {/* 항상 보이는 버튼은 "자동 테마 찾기"/"기사 목록" + 대시보드 메뉴
              뿐이다 — 나머지(콘텐츠/블로그/리라이트/성과/운영 설정)는
              드롭다운 메뉴 안에서 확인한다(Phase 1-22). */}
          <DashboardTopNav active={null} />
        </header>

        <TransientNotice message={deleteMessage} variant="success" />
        <TransientNotice message={deleteError} variant="error" />

        {/*
          Phase 1-23: "선택한 테마 중심 작업형 대시보드"로 재구성.
          - 왼쪽: 테마 선택/검색(+ 새 테마 입력은 기본 접힘).
          - 오른쪽: 선택된 테마 요약 → 다음 작업 → 출처 상태 요약 →
            출처 추가(compact) → 출처 목록 → (기존) 계약검사/기사초안/로그.
          모바일에서는 이 grid가 flex-col로 바뀌어 위 순서 그대로 1열로
          쌓인다 — 왼쪽 사이드바(테마 목록)는 항상 맨 아래로 밀린다.
        */}
        <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[280px_1fr]">
          {/* 좌측: 테마 검색/선택 + 새 테마 입력(기본 접힘) */}
          <aside className="flex flex-col gap-6">
            <details className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">+ 새 테마</span>
                <span className="hidden group-open:inline">새 테마 입력 접기</span>
              </summary>
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
            </details>

            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-700">테마 목록</h2>
              <div className="mt-2">
                <ThemeSearchList
                  items={themeListEntries}
                  selectedThemeId={selectedTheme?.id}
                  archiveAction={archiveThemeAction}
                />
              </div>
            </section>
          </aside>

          {/* 우측: 선택된 테마 작업 영역 */}
          <main className="flex flex-col gap-6">
            {!selectedTheme ? (
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
                왼쪽에서 테마를 먼저 생성하세요.
              </section>
            ) : (
              <>
                {/* 1. 선택된 테마 요약 카드 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-keep text-lg font-semibold">{selectedTheme.title}</h2>
                      {selectedTheme.description && (
                        <p className="mt-1 break-keep text-sm text-zinc-600">{selectedTheme.description}</p>
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
                    </div>
                    {/* 이 화면의 primary action은 아래 "다음 작업" 카드 하나뿐이다 —
                        여기서는 secondary action(관련 기사 URL 수집)만 둔다. */}
                    <Link
                      href={`/themes/${selectedTheme.id}`}
                      className="shrink-0 rounded border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      관련 기사 URL 수집
                    </Link>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    출처 {sources.length}개 등록됨 · {sourceStatus.isReady ? "조건 충족" : "출처 부족"} ·{" "}
                    {nextActionState !== "needs_source" ? "기사 작성 가능" : "기사 작성 불가"}
                  </p>
                </section>

                {/* 2. 다음 작업 카드 — 상태에 따라 문구/버튼이 달라지는, 이 화면의
                    유일한 primary action이다. */}
                <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-blue-900">다음 작업</h2>
                  {nextActionState === "article_exists" && (
                    <>
                      <p className="mt-1 break-keep text-sm text-blue-800">이 테마로 생성된 기사가 있습니다.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/articles/${article!.id}`}
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          기사 보기
                        </Link>
                        <a
                          href="#generate-draft"
                          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          새 기사 생성
                        </a>
                      </div>
                    </>
                  )}
                  {nextActionState === "ready_to_generate" && (
                    <>
                      <p className="mt-1 break-keep text-sm text-blue-800">
                        출처 조건이 충족되어 기사 초안을 생성할 수 있습니다.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href="#generate-draft"
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          기사 초안 생성
                        </a>
                      </div>
                    </>
                  )}
                  {nextActionState === "needs_source" && (
                    <>
                      <p className="mt-1 break-keep text-sm text-blue-800">
                        기사 작성을 위해 출처가 {Math.max(MIN_SOURCE_COUNT - sources.length, 0)}개 더 필요합니다.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href="#source-url-input"
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          출처 추가
                        </a>
                        <Link
                          href={`/themes/${selectedTheme.id}`}
                          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          관련 기사 URL 수집
                        </Link>
                      </div>
                    </>
                  )}
                </section>

                {/* 3. 출처 상태 요약 */}
                <section className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm">
                  <p>
                    출처 {sourceStatus.total}개 등록됨 · 최소 {sourceStatus.minRequired}개{" "}
                    {sourceStatus.isReady ? "충족" : "미충족"}
                  </p>
                  <p className="mt-0.5">
                    본문 수집 완료 {sourceStatus.fetchSuccessCount}개 · 요약 완료 {sourceStatus.summarySuccessCount}개
                    {sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount > 0 &&
                      ` · 실패 ${sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount}개`}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        sourceStatus.isReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {sourceStatus.isReady ? "조건 충족" : "출처 부족"}
                    </span>
                    {sourceStatus.fetchSuccessCount > 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                        본문 수집 완료 {sourceStatus.fetchSuccessCount}
                      </span>
                    )}
                    {sourceStatus.summarySuccessCount > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                        요약 완료 {sourceStatus.summarySuccessCount}
                      </span>
                    )}
                    {sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                        실패 {sourceStatus.fetchFailedCount + sourceStatus.summaryFailedCount}
                      </span>
                    )}
                  </div>
                </section>

                {/* 4. 출처 추가 — 기본은 "+ 출처 추가"만 보이고, 열면 URL 중심의
                    compact 폼이 나온다. 제목/출판사/발행일/요약은 "추가 정보
                    입력(선택)" 안에 접어둔다(URL만 입력해도 서버에서 본문/요약을
                    자동 수집한다 — lib/dashboard/actions.ts의 기존 로직 그대로). */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  {sourceError && (
                    <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {sourceError}
                    </div>
                  )}
                  <details className="group" open={Boolean(sourceError)}>
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-700 [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">+ 출처 추가</span>
                      <span className="hidden group-open:inline">출처 추가 폼 접기</span>
                    </summary>
                    <form action={addSource} className="mt-3 flex flex-col gap-2">
                      <input type="hidden" name="themeId" value={selectedTheme.id} />
                      <label className="flex flex-col gap-1 text-xs text-zinc-600">
                        URL
                        <input
                          id="source-url-input"
                          name="url"
                          type="url"
                          placeholder="https://example.com/article (URL만 입력해도 본문/요약이 자동 수집됩니다)"
                          className="rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                          추가 정보 입력 (선택)
                        </summary>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                        </div>
                      </details>
                      <div className="mt-1">
                        <button
                          type="submit"
                          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                        >
                          출처 추가
                        </button>
                      </div>
                    </form>
                  </details>
                </section>

                {/* 5. 출처 목록 — 긴 URL 전체는 노출하지 않고 도메인만 보여준다.
                    요약은 2줄로 제한하고, 전체 요약/본문/삭제는 각각의 상세
                    영역/버튼으로 분리한다. */}
                <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-zinc-700">출처 목록 ({sources.length}개)</h2>
                  {sources.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-500">아직 등록된 출처가 없습니다.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {sources.map((source, index) => (
                        <li key={source.id} className="rounded border border-zinc-200 px-3 py-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 break-keep font-medium">
                              {index + 1}. {source.title || "(제목 없음)"}
                            </p>
                            <div className="flex shrink-0 gap-1">
                              <FetchStatusBadge status={source.fetchStatus} error={source.fetchError} />
                              <SummaryStatusBadge status={source.summaryStatus} summarizedAt={source.summarizedAt} />
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {extractDomain(source.url)}
                            {source.publishedAt && ` · ${source.publishedAt}`}
                          </p>
                          {source.summary && (
                            <p className="mt-1 line-clamp-2 break-keep text-xs leading-relaxed text-zinc-600">
                              {source.summary}
                            </p>
                          )}
                          {source.fetchStatus === "failed" && source.fetchError && (
                            <p className="mt-1 text-xs text-red-600">수집 오류: {source.fetchError}</p>
                          )}
                          {source.summaryStatus === "failed" && source.summaryError && (
                            <p className="mt-0.5 text-xs text-orange-600">요약 오류: {source.summaryError}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                원문 열기
                              </a>
                            )}
                            {/* 삭제 기능은 이번 작업에서 추가하지 않았다 — sources 테이블에는
                                soft delete용 archived_at 컬럼이 없고, 이 작업의 원칙(DB
                                schema 변경 금지)상 새 컬럼을 추가할 수 없다. hard delete는
                                이 프로젝트 전반의 soft-delete 우선 원칙과 맞지 않아
                                의도적으로 보류했다(문서 참고). */}
                          </div>
                          {source.summary && (
                            <details className="mt-1 text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                요약 전체 보기
                              </summary>
                              <p className="mt-1 break-keep leading-relaxed text-zinc-600">{source.summary}</p>
                            </details>
                          )}
                          {source.rawContent && (
                            <details className="mt-1 text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                본문 보기
                              </summary>
                              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-700">
                                {source.rawContent}
                              </pre>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* 기사 생성 + 계약 검사 결과 */}
                <section id="generate-draft" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-zinc-700">
                    계약 검사 &amp; 기사 초안 생성
                  </h2>

                  <form action={generateArticleDraft} className="mt-3 flex flex-col gap-3">
                    <input type="hidden" name="themeId" value={selectedTheme.id} />
                    <fieldset className="flex flex-col gap-2">
                      <legend className="text-xs font-medium text-zinc-600">글쓰기 모드</legend>
                      {ARTICLE_MODE_LIST.map((modeConfig) => (
                        <label
                          key={modeConfig.id}
                          className="flex items-start gap-2 rounded border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                        >
                          <input
                            type="radio"
                            name="articleMode"
                            value={modeConfig.id}
                            defaultChecked={modeConfig.id === DEFAULT_ARTICLE_MODE}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium text-zinc-800">{modeConfig.label}</span>
                            <span className="block text-xs text-zinc-500">{modeConfig.description}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div>
                      <button
                        type="submit"
                        disabled={sources.length < MIN_SOURCE_COUNT}
                        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
                      >
                        기사 초안 생성
                      </button>
                    </div>
                  </form>

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
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {ARTICLE_MODE_LIST.find((m) => m.id === article.articleMode)?.label ?? article.articleMode}
                        </span>
                        <Link
                          href={`/articles/${article.id}`}
                          className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          기사 검토/승인하기
                        </Link>
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

function SummaryStatusBadge({
  status,
  summarizedAt,
}: {
  status: "pending" | "success" | "failed" | "skipped";
  summarizedAt: string | null;
}) {
  if (status === "success") {
    const time = summarizedAt ? new Date(summarizedAt).toLocaleTimeString("ko-KR") : "";
    return (
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700" title={`요약 완료: ${time}`}>
        요약 완료
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        요약 실패
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
        요약 건너뜀
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      요약 대기
    </span>
  );
}

function FetchStatusBadge({
  status,
  error,
}: {
  status: "pending" | "success" | "failed";
  error: string | null;
}) {
  if (status === "success") {
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        본문 수집 완료
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
        title={error ?? undefined}
      >
        수집 실패
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      수집 대기
    </span>
  );
}

function ContractCheckResult({
  label,
  check,
}: {
  label: string;
  check?: ContractCheckRecord;
}) {
  if (!check) {
    return (
      <div className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-500">
        {label}: 아직 검사하지 않았습니다.
      </div>
    );
  }

  const { passed, violations } = check;

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
