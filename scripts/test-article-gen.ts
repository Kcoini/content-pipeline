/**
 * 기사 생성 품질 테스트 스크립트.
 * Supabase에서 출처가 3개 이상인 테마를 가져와 실제 AI 기사 생성 흐름을 실행한다.
 * 실행: npx tsx --env-file=.env.local scripts/test-article-gen.ts
 */
import { createClient } from "@supabase/supabase-js";
import { summarizeSourcesWithAi } from "../lib/ai/source-summarizer";
import { generateAiArticleDraft } from "../lib/ai/article-writer";
import type { Source, Theme } from "../lib/types/domain";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function main() {
  console.log("=== 기사 생성 품질 테스트 ===\n");

  // 출처가 3개 이상인 테마 조회
  const { data: themes, error: themeErr } = await supabase
    .from("themes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (themeErr || !themes?.length) {
    console.error("테마 조회 실패:", themeErr?.message ?? "데이터 없음");
    process.exit(1);
  }

  let selectedTheme: Theme | null = null;
  let selectedSources: Source[] = [];

  for (const t of themes) {
    const { data: sources } = await supabase
      .from("sources")
      .select("*")
      .eq("theme_id", t.id);

    if (sources && sources.length >= 3) {
      selectedTheme = {
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        keywords: t.keywords ?? [],
        language: t.language ?? "ko",
        createdAt: t.created_at,
      };
      selectedSources = sources.map((s) => ({
        id: s.id,
        themeId: s.theme_id,
        url: s.url ?? "",
        title: s.title ?? "",
        publisher: s.publisher ?? "",
        publishedAt: s.published_at ?? "",
        summary: s.summary ?? "",
        createdAt: s.created_at,
        fetchStatus: (s.fetch_status ?? "pending") as "pending" | "success" | "failed",
        fetchError: s.fetch_error ?? null,
        rawContent: s.raw_content ?? null,
        summaryStatus: (s.summary_status ?? "pending") as "pending" | "success" | "failed" | "skipped",
        summaryError: s.summary_error ?? null,
        summarizedAt: s.summarized_at ?? null,
        keyPoints: Array.isArray(s.key_points) ? s.key_points : [],
      }));
      break;
    }
  }

  if (!selectedTheme) {
    console.error("출처가 3개 이상인 테마가 없습니다. 대시보드에서 테마와 출처를 먼저 등록하세요.");
    process.exit(1);
  }

  console.log(`테마: ${selectedTheme.title}`);
  console.log(`출처 수: ${selectedSources.length}개\n`);
  console.log("출처 목록:");
  selectedSources.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.title} (${s.publisher})`);
    console.log(`     summary(앞 100자): ${s.summary.substring(0, 100)}`);
  });

  console.log("\n--- [1단계] 출처 요약 생성 ---");
  const sourceSummaries = await summarizeSourcesWithAi(selectedTheme, selectedSources);
  console.log("요약 완료. 각 요약 앞 150자:");
  sourceSummaries.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.sourceId.substring(0, 8)}...] ${s.summary.substring(0, 150)}`);
  });

  console.log("\n--- [2단계] 기사 초안 생성 ---");
  const article = await generateAiArticleDraft(selectedTheme, sourceSummaries);

  console.log("\n====== 생성된 기사 ======\n");
  console.log(`제목: ${article.title}`);
  console.log(`인용 출처: ${article.citedSourceIds.join(", ")}`);
  console.log(`본문 길이: ${article.content.length}자`);
  console.log("\n--- 본문 ---");
  console.log(article.content);
  console.log("\n====== 끝 ======");

  // 복사율 간이 검사: 출처 요약 문장이 본문에 그대로 있는지 확인
  console.log("\n--- 복사율 간이 검사 ---");
  let copyCount = 0;
  for (const s of sourceSummaries) {
    // 15단어(한국어: 약 30자) 기준으로 연속 구문 검사
    const words = s.summary.split(/\s+/);
    for (let i = 0; i <= words.length - 10; i++) {
      const chunk = words.slice(i, i + 10).join(" ");
      if (chunk.length > 20 && article.content.includes(chunk)) {
        console.log(`  ⚠ 복사 발견: "${chunk.substring(0, 50)}..."`);
        copyCount++;
        break;
      }
    }
  }
  if (copyCount === 0) {
    console.log("  ✓ 복사된 구문 없음 (10단어 이상 연속 일치 없음)");
  } else {
    console.log(`  ✗ ${copyCount}개 출처에서 복사 구문 발견`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
