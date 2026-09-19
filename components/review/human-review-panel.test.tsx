import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HumanReviewPanel, type HumanReviewItem } from "./human-review-panel";

describe("HumanReviewPanel", () => {
  it("항목이 0개면 '확인할 사항 없음'만 compact하게 보여준다", () => {
    const html = renderToStaticMarkup(<HumanReviewPanel items={[]} />);
    expect(html).toContain("확인할 사항 없음");
  });

  it("emptyMessage를 넘기면 그 문구를 쓴다", () => {
    const html = renderToStaticMarkup(<HumanReviewPanel items={[]} emptyMessage="문제 없음" />);
    expect(html).toContain("문제 없음");
    expect(html).not.toContain("확인할 사항 없음");
  });

  it("항목이 1개면 라벨과 설명을 보여준다", () => {
    const items: HumanReviewItem[] = [{ id: "1", label: "출처 확인 필요", description: "출처 링크가 없습니다." }];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).toContain("출처 확인 필요");
    expect(html).toContain("출처 링크가 없습니다.");
  });

  it("항목이 여러 개면 모두 나열한다", () => {
    const items: HumanReviewItem[] = [
      { id: "1", label: "출처 확인 필요" },
      { id: "2", label: "수치 확인 필요" },
      { id: "3", label: "날짜 확인 필요" },
    ];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).toContain("출처 확인 필요");
    expect(html).toContain("수치 확인 필요");
    expect(html).toContain("날짜 확인 필요");
  });

  it("blocking 항목은 '승인 불가' 배지로, warning 항목은 '확인 필요' 배지로 보여준다", () => {
    const items: HumanReviewItem[] = [
      { id: "1", label: "개인정보 노출", severity: "blocking" },
      { id: "2", label: "수치 확인 필요", severity: "warning" },
    ];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).toContain("승인 불가");
    expect(html).toContain("확인 필요");
  });

  it("actionHref/actionLabel이 있으면 액션 링크를 렌더링한다", () => {
    const items: HumanReviewItem[] = [
      { id: "1", label: "출처 확인 필요", actionLabel: "수정하기", actionHref: "/edit#1" },
    ];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).toContain("수정하기");
    expect(html).toContain('href="/edit#1"');
  });

  it("actionHref가 없으면 액션 링크를 렌더링하지 않는다", () => {
    const items: HumanReviewItem[] = [{ id: "1", label: "출처 확인 필요" }];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).not.toContain("<a ");
  });

  it("raw fixability enum(auto_fixable/user_confirmation_required/blocking)을 화면에 그대로 노출하지 않는다", () => {
    const items: HumanReviewItem[] = [{ id: "1", label: "출처 확인 필요", severity: "blocking" }];
    const html = renderToStaticMarkup(<HumanReviewPanel items={items} />);
    expect(html).not.toContain("auto_fixable");
    expect(html).not.toContain("user_confirmation_required");
    // severity="blocking"의 표시 라벨은 "승인 불가"이지 "blocking"이라는 원문이 아니다.
    expect(html).not.toContain(">blocking<");
  });
});
