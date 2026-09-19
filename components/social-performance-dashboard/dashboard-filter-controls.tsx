import { SOCIAL_PLATFORMS, TONE_STYLES } from "@/lib/social/social-platform-types";
import type { DashboardFilter, DashboardSortOption } from "@/lib/social/social-performance-dashboard-types";
import { PLATFORM_LABELS } from "@/lib/social/platform-generation-recommendations";
import { TONE_STYLE_CONFIGS } from "@/lib/social/tone-style-config";
import { describeStatusField, describeStatusValue } from "@/lib/social/status-labels";

const PERFORMANCE_STATUSES = ["not_measured", "low", "average", "good", "excellent", "needs_review"] as const;
const MANUAL_POST_STATUSES = ["not_recorded", "ready_to_record", "posted", "skipped", "failed", "blocked"] as const;

// Phase UX-03C: raw 필드명/enum이 필터 select에 그대로 노출되던 문제(H4와
// 같은 유형)를 수정 — 라벨은 한국어로, 정렬 옵션도 raw 컬럼명 대신
// 사용자 친화적 문구로 바꾼다.
const SORT_OPTIONS: { value: DashboardSortOption; label: string }[] = [
  { value: "latest_performance_score desc", label: "성과 점수 높은 순" },
  { value: "latest_performance_score asc", label: "성과 점수 낮은 순" },
  { value: "latest_metrics_recorded_at desc", label: "최근 성과 입력 순" },
  { value: "latest_views desc", label: "조회수 높은 순" },
  { value: "latest_clicks desc", label: "클릭수 높은 순" },
  { value: "latest_engagement_rate desc", label: "참여율 높은 순" },
  { value: "rewrite_performance_score_delta desc", label: "재작성 성과 변화 큰 순" },
  { value: "created_at desc", label: "생성일 최신 순" },
  { value: "updated_at desc", label: "수정일 최신 순" },
];

export function DashboardFilterControls({
  filter,
  sort,
  onlyPublished = false,
  onlyMeasured = false,
}: {
  filter: DashboardFilter;
  sort: DashboardSortOption;
  /** Phase 3-19: 차트 전용 필터(테이블 조회에는 영향을 주지 않는다). */
  onlyPublished?: boolean;
  onlyMeasured?: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-700">필터 / 정렬</h2>
      <form method="get" className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          콘텐츠 그룹
          <select name="contentGroup" defaultValue={filter.contentGroup ?? "all"} className="rounded border border-zinc-300 px-2 py-1">
            <option value="all">전체</option>
            <option value="blog">블로그</option>
            <option value="community">커뮤니티</option>
            <option value="social">SNS</option>
            <option value="rewrite">재작성</option>
            <option value="performance">성과</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          플랫폼
          <select name="platform" defaultValue={filter.platform ?? ""} className="rounded border border-zinc-300 px-2 py-1">
            <option value="">전체</option>
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          문체
          <select name="toneStyle" defaultValue={filter.toneStyle ?? ""} className="rounded border border-zinc-300 px-2 py-1">
            <option value="">전체</option>
            {TONE_STYLES.map((t) => (
              <option key={t} value={t}>
                {TONE_STYLE_CONFIGS[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {describeStatusField("performance_status")}
          <select name="performanceStatus" defaultValue={filter.performanceStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
            <option value="">전체</option>
            {PERFORMANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {describeStatusValue(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {describeStatusField("manual_post_status")}
          <select name="manualPostStatus" defaultValue={filter.manualPostStatus ?? ""} className="rounded border border-zinc-300 px-2 py-1">
            <option value="">전체</option>
            {MANUAL_POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {describeStatusValue(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          정렬
          <select name="sort" defaultValue={sort} className="rounded border border-zinc-300 px-2 py-1">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="includeRewriteVersions" value="true" defaultChecked={filter.includeRewriteVersions} />
          재작성 버전 포함
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyRewriteVersions" value="true" defaultChecked={filter.onlyRewriteVersions} />
          재작성 버전만
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyRecommendedForRepost" value="true" defaultChecked={filter.onlyRecommendedForRepost} />
          재게시 추천만
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyLowPerformance" value="true" defaultChecked={filter.onlyLowPerformance} />
          저성과만
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyMetricsMissing" value="true" defaultChecked={filter.onlyMetricsMissing} />
          성과 데이터 미입력만
        </label>
        <label className="flex flex-col gap-1">
          시작일 (created_at 기준)
          <input type="date" name="dateFrom" defaultValue={filter.dateFrom ?? ""} className="rounded border border-zinc-300 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          종료일 (created_at 기준)
          <input type="date" name="dateTo" defaultValue={filter.dateTo ?? ""} className="rounded border border-zinc-300 px-2 py-1" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyPublished" value="true" defaultChecked={onlyPublished} />
          게시 완료만 (차트)
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="onlyMeasured" value="true" defaultChecked={onlyMeasured} />
          성과 측정된 글만 (차트)
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
          <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700">
            적용
          </button>
          <a href="/dashboard/social-performance" className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
            초기화
          </a>
        </div>
      </form>
    </section>
  );
}
