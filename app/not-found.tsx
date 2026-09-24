import Link from "next/link";

// PRODUCT-01G 섹션 23/24: 이 프로젝트에는 이전까지 not-found.tsx가
// 없었다 — notFound()를 호출하는 5개 페이지(articles/[id]/blog 등)가
// 전부 Next.js 기본 404 화면(raw, 안내/복귀 링크 없음)에 의존하고
// 있었다. 이 전역 파일 하나로 모든 경로의 404를 사용자 행동 중심
// 문구로 바꾼다 — 개별 페이지의 notFound() 호출 자체는 바꾸지 않는다.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-base font-semibold text-zinc-800">콘텐츠를 찾을 수 없습니다.</p>
        <p className="mt-2 break-keep text-sm text-zinc-600">
          주소가 잘못되었거나, 이미 삭제되었을 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            내 콘텐츠로 돌아가기
          </Link>
          <Link
            href="/articles"
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            기사 목록 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
