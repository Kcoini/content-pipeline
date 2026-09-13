import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JobProgressCard, type JobProgressCardData } from "./job-progress-card";

function makeJobRun(overrides: Partial<JobProgressCardData> = {}): JobProgressCardData {
  return {
    id: "job-run-1",
    jobType: "wordpress_auto_prep",
    status: "running",
    currentStepLabel: "대표 이미지 상태 확인 중",
    totalSteps: 10,
    completedSteps: 4,
    progressPercent: 40,
    userMessage: null,
    errorMessage: null,
    errorCategory: null,
    retryable: false,
    nextActionLabel: null,
    nextActionHref: null,
    lastHeartbeatAt: new Date().toISOString(),
    steps: [
      { stepKey: "draft", stepLabel: "WordPress Draft", status: "completed", message: "Draft 생성 완료", errorMessage: null },
      { stepKey: "seo", stepLabel: "SEO 정보 반영", status: "running", message: null, errorMessage: null },
    ],
    ...overrides,
  };
}

describe("JobProgressCard: 진행 중 상태", () => {
  it("작업명(친화적 라벨)/현재 단계/완료 단계 수를 보여준다", () => {
    const html = renderToStaticMarkup(<JobProgressCard jobRun={makeJobRun()} />);
    expect(html).toContain("WordPress 게시 준비");
    expect(html).toContain("대표 이미지 상태 확인 중");
    expect(html).toContain("4/10단계 완료");
    expect(html).not.toContain("wordpress_auto_prep<");
  });
});

describe("JobProgressCard: 완료 상태", () => {
  it("완료 메시지와 다음 작업 버튼을 보여준다", () => {
    const html = renderToStaticMarkup(
      <JobProgressCard
        jobRun={makeJobRun({
          status: "completed",
          userMessage: "WordPress 게시 준비가 완료되었습니다.",
          nextActionLabel: "WordPress Draft 보기",
          nextActionHref: "/articles/a1",
        })}
      />
    );
    expect(html).toContain("완료");
    expect(html).toContain("WordPress 게시 준비가 완료되었습니다.");
    expect(html).toContain("WordPress Draft 보기");
    expect(html).toContain('href="/articles/a1"');
  });
});

describe("JobProgressCard: 실패 상태", () => {
  it("실패 메시지와 재시도 버튼을 보여주고, raw 오류는 접힘 영역 안에 둔다", () => {
    const html = renderToStaticMarkup(
      <JobProgressCard
        jobRun={makeJobRun({
          status: "failed",
          errorCategory: "wordpress_connection_error",
          errorMessage: "Cannot read properties of undefined (reading 'filter')",
          retryable: true,
        })}
        retryHref="/articles/a1/blog"
      />
    );
    expect(html).toContain("작업이 중단되었습니다");
    expect(html).toContain("WordPress 연결 오류 가능성");
    expect(html).toContain("다시 시도");
    expect(html).toContain("상세 오류 보기");
    // raw error는 <details> 안에만 있어야 하고, summary 앞에 그대로 노출돼선 안 된다.
    const beforeDetails = html.slice(0, html.indexOf("<details"));
    expect(beforeDetails).not.toContain("Cannot read properties");
  });
});

describe("JobProgressCard: 일부 완료 상태", () => {
  it("partial_success 상태에서는 일부 완료 메시지와 다음 작업을 보여준다", () => {
    const html = renderToStaticMarkup(
      <JobProgressCard
        jobRun={makeJobRun({
          status: "partial_success",
          userMessage: "본문과 SEO 정보는 반영되었지만 대표 이미지는 확인이 필요합니다.",
          nextActionLabel: "대표 이미지 설정하기",
          nextActionHref: "/articles/a1/blog?tab=image",
        })}
      />
    );
    expect(html).toContain("일부 완료");
    expect(html).toContain("대표 이미지는 확인이 필요합니다");
    expect(html).toContain("대표 이미지 설정하기");
  });
});

describe("JobProgressCard: 멈춤 가능성 표시", () => {
  it("isStalled=true면 멈춤 가능성 안내를 보여준다(실패로 단정하지 않는다)", () => {
    const html = renderToStaticMarkup(<JobProgressCard jobRun={makeJobRun({ status: "running" })} isStalled />);
    expect(html).toContain("멈춤 가능성 있음");
    expect(html).toContain("예상보다 오래 걸리고 있습니다");
    expect(html).not.toContain("작업이 중단되었습니다");
  });
});

describe("JobProgressCard: 상세 단계 보기", () => {
  it("단계 목록은 기본 접힘 상태다", () => {
    const html = renderToStaticMarkup(<JobProgressCard jobRun={makeJobRun()} />);
    const detailsIdx = html.indexOf("<details");
    const summaryIdx = html.indexOf("상세 단계 보기");
    expect(detailsIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(detailsIdx);
    expect(html).not.toContain(" open=");
  });
});
