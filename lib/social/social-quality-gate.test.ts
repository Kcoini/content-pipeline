import { describe, expect, it } from "vitest";
import { runSocialPostQualityGate } from "./social-quality-gate";

describe("runSocialPostQualityGate", () => {
  it("빈 글은 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "",
      hashtags: [],
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "content_present");
    expect(item?.status).toBe("blocked");
  });

  it("기관 대표번호(지역번호)는 개인정보 노출로 오탐하지 않는다", () => {
    const result = runSocialPostQualityGate({
      platform: "wordpress_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "문의처: 제주도청 주택토지과 064-710-4252, 복지로 콜센터 129",
      excerpt: "요약",
    });

    const item = result.checklist.find((c) => c.key === "no_pii_exposure");
    expect(item?.status).toBe("pass");
    expect(result.status).not.toBe("blocked");
  });

  it("휴대전화 번호(010-)는 개인정보 노출 의심으로 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "문의는 010-1234-5678로 연락주세요.",
    });

    const item = result.checklist.find((c) => c.key === "no_pii_exposure");
    expect(item?.status).toBe("blocked");
    expect(result.status).toBe("blocked");
  });

  it("주민등록번호 형식은 여전히 개인정보 노출 의심으로 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "주민번호 900101-1234567가 포함되어 있습니다.",
    });

    const item = result.checklist.find((c) => c.key === "no_pii_exposure");
    expect(item?.status).toBe("blocked");
    expect(result.status).toBe("blocked");
  });

  it("광고 클릭 유도 문구는 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "threads",
      toneStyle: "persuasive",
      postBody: "지금 바로 광고 클릭 하시고 혜택 받아가세요.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_ad_click_bait");
    expect(item?.status).toBe("blocked");
  });

  it("허위 수익 보장 표현은 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "persuasive",
      threadItems: [{ order: 1, text: "이 상품은 수익 보장이 확실합니다." }],
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_income_guarantee");
    expect(item?.status).toBe("blocked");
  });

  it("warning 문체에서도 협박 표현은 허용하지 않는다 (blocked)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "warning",
      postTitle: "주의하세요",
      postBody: "지금 확인하지 않으면 당장 하지 않으면 큰 문제가 생깁니다.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_threat_language");
    expect(item?.status).toBe("blocked");
  });

  it("loss_aversion 문체에서도 협박 표현은 허용하지 않는다 (blocked)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "loss_aversion",
      postTitle: "모르면 손해",
      postBody: "가만두지 않겠다는 심정으로 준비하지 않으면 손해를 봅니다.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "no_threat_language");
    expect(item?.status).toBe("blocked");
  });

  it("invalid platform이면 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "facebook",
      toneStyle: "informational",
      postBody: "본문",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "platform_valid");
    expect(item?.status).toBe("blocked");
  });

  it("invalid tone_style이면 blocked 처리한다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "threat",
      postBody: "본문",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "tone_style_valid");
    expect(item?.status).toBe("blocked");
  });

  it("정상적인 글은 ready 또는 needs_revision으로 처리된다 (blocked 아님)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "장기요양보험 신청 방법 총정리",
      postBody: "장기요양보험 신청 절차와 필요한 서류, 등급 판정 기준을 정리했습니다. ".repeat(20),
      hashtags: ["장기요양보험", "신청방법"],
    });

    expect(result.status).not.toBe("blocked");
  });

  it("x 플랫폼에서 thread_items가 없으면 required_fields_present가 warning이다", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "curiosity",
      postBody: "본문만 있고 thread_items는 없음",
    });

    const item = result.checklist.find((c) => c.key === "required_fields_present");
    expect(item?.status).toBe("warning");
  });

  it("x thread item이 길이 제한을 초과하면 needs_revision 또는 blocked로 처리된다", () => {
    const result = runSocialPostQualityGate({
      platform: "x",
      toneStyle: "informational",
      threadItems: [{ order: 1, text: "가".repeat(300) }],
    });

    expect(result.status).not.toBe("ready");
    const item = result.checklist.find((c) => c.key === "x_thread_item_length");
    expect(item?.status).toBe("fail");
  });

  it("instagram에서 media_requirements.requiresImage가 명시되지 않으면 warning이다", () => {
    const result = runSocialPostQualityGate({
      platform: "instagram",
      toneStyle: "story",
      caption: "캡션 내용입니다.",
      hashtags: ["태그"],
    });

    const item = result.checklist.find((c) => c.key === "instagram_media_requirements");
    expect(item?.status).toBe("warning");
  });

  it("naver_cafe에서 광고성/도배성 표현이 있으면 blocked로 처리된다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "정보 공유",
      postBody: "저희 상품을 지금 바로 구매하시고 최저가로 만나보세요. 문의주세요.",
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "naver_cafe_promotional_language");
    expect(item?.status).toBe("blocked");
  });

  // Phase 3-20: naver_cafe는 plain text 커뮤니티 글이어야 하고, 게시용
  // 본문에 escape된 markdown/HTML entity/localhost 링크/내부 관리
  // 상태값이 남아 있으면 안 된다.
  it("naver_cafe: markdown escape(\\##, \\**, &#x20;)가 남아 있으면 ready가 아니다(needs_revision)", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody:
        "\\## 제목\n\n\\*\\*굵게\\*\\*&#x20;내용입니다. " +
        "회원분들 어떻게 생각하세요? 다들 경험 있으신가요? " +
        "본문 내용입니다. ".repeat(30),
    });

    const item = result.checklist.find((c) => c.key === "naver_cafe_no_markdown_escape");
    expect(item?.status).toBe("fail");
    expect(result.status).not.toBe("ready");
  });

  it("naver_cafe: markdown escape가 없으면 naver_cafe_no_markdown_escape가 pass다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody: "평범한 plain text 본문입니다. " + "본문 내용입니다. ".repeat(30),
    });

    const item = result.checklist.find((c) => c.key === "naver_cafe_no_markdown_escape");
    expect(item?.status).toBe("pass");
  });

  it("naver_cafe: 본문에 localhost 링크가 있으면 blocked다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody: "자세한 내용은 http://localhost:3000/articles/1 에서 확인하세요. " + "본문 내용입니다. ".repeat(30),
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "naver_cafe_no_localhost_link");
    expect(item?.status).toBe("blocked");
  });

  it("naver_cafe: 본문에 내부 관리 상태값(quality_status 등)이 포함되면 blocked다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody: "현재 quality_status: ready 입니다. " + "본문 내용입니다. ".repeat(30),
    });

    expect(result.status).toBe("blocked");
    const item = result.checklist.find((c) => c.key === "naver_cafe_no_internal_status_leak");
    expect(item?.status).toBe("blocked");
  });

  it("naver_cafe: 질문이 2개 이상이면 naver_cafe_discussion_cue가 pass다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "질문 있어요",
      postBody: "다들 변동금리 쓰시나요? 저만 이런가요? " + "본문 내용입니다. ".repeat(30),
    });

    const item = result.checklist.find((c) => c.key === "naver_cafe_discussion_cue");
    expect(item?.status).toBe("pass");
  });

  it("naver_cafe: 질문이 하나도 없으면 naver_cafe_discussion_cue가 fail이다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "정보 공유",
      postBody: "본문 내용입니다. ".repeat(30),
    });

    const item = result.checklist.find((c) => c.key === "naver_cafe_discussion_cue");
    expect(item?.status).toBe("fail");
  });

  it("naver_cafe: 모든 기준을 만족하면(질문 2개 이상, markdown escape 없음, 내부 정보 없음) ready가 될 수 있다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_cafe",
      toneStyle: "informational",
      postTitle: "다들 이런 경험 있으신가요?",
      postBody:
        "요즘 금리 때문에 고민이 많으신 분들 계시죠? 저도 대출이 있어서 걱정입니다. " +
        "본문 내용입니다. ".repeat(40) +
        " 다들 어떻게 생각하세요? 비슷한 상황이신 분 계신가요?",
    });

    for (const key of [
      "naver_cafe_no_markdown_escape",
      "naver_cafe_no_localhost_link",
      "naver_cafe_no_internal_status_leak",
      "naver_cafe_discussion_cue",
      "naver_cafe_promotional_language",
    ]) {
      const item = result.checklist.find((c) => c.key === key);
      expect(item?.status).toBe("pass");
    }
  });

  it("naver_blog에서 특정 키워드가 과도하게 반복되면 warning이다", () => {
    const result = runSocialPostQualityGate({
      platform: "naver_blog",
      toneStyle: "informational",
      postTitle: "제목",
      postBody: "장기요양보험 ".repeat(20),
      hashtags: ["장기요양보험"],
    });

    const item = result.checklist.find((c) => c.key === "naver_blog_keyword_repetition");
    expect(item?.status).toBe("warning");
  });

  describe("wordpress_blog: SEO/AEO/GEO/E-E-A-T 문제 해결형 블로그 rule-based 검사", () => {
    function makeWordpressBlogInput(postBody: string) {
      return {
        platform: "wordpress_blog" as const,
        toneStyle: "informational" as const,
        postTitle: "장기요양보험 등급 신청 조건과 절차",
        postBody,
        excerpt: "장기요양보험 신청 조건과 절차를 정리했습니다.",
      };
    }

    it("도입부가 '~에 대해 알아보겠습니다'로 시작하면 fail이다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("이번 글에서는 장기요양보험 신청 방법에 대해 알아보겠습니다. " + "본문 내용입니다. ".repeat(30))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_non_generic_opening");
      expect(item?.status).toBe("fail");
      expect(result.status).toBe("needs_revision");
    });

    it("상투적 표현 없이 시작하면 pass다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("65세 이상 부모님을 모시고 있다면 장기요양등급부터 확인해야 합니다. " + "본문 내용입니다. ".repeat(30))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_non_generic_opening");
      expect(item?.status).toBe("pass");
    });

    it("'먼저 결론' 섹션이 있으면 초반 직접 답변 항목이 pass다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("도입부입니다.\n\n## 먼저 결론부터 보면\n\n신청 조건은 이렇습니다. " + "본문. ".repeat(20))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_early_direct_answer");
      expect(item?.status).toBe("pass");
    });

    it("'먼저 결론'/'핵심만 정리' 섹션이 없으면 초반 직접 답변 항목이 warning이다", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_early_direct_answer");
      expect(item?.status).toBe("warning");
    });

    it("근거 없는 권위 표현('전문가가 추천합니다')이 있으면 fail이다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("전문가가 추천합니다. 이 방법이 최선입니다. " + "본문 내용. ".repeat(30))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_no_unsupported_authority");
      expect(item?.status).toBe("fail");
    });

    it("AI 검색 노출 보장 표현('검색 상위 노출 보장')이 있으면 fail이다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("이 글은 검색 상위 노출 보장이 됩니다. " + "본문 내용. ".repeat(30))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_no_ai_exposure_guarantee");
      expect(item?.status).toBe("fail");
    });

    it("공포 조장 표현('모르면 큰일 납니다')이 있으면 fail이다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("모르면 큰일 납니다. 꼭 확인하세요. " + "본문 내용. ".repeat(30))
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_no_fearmongering");
      expect(item?.status).toBe("fail");
    });

    it("FAQ가 4개 이상('**Q.' 형태)이면 wordpress_blog_faq_present가 pass다 (Phase 2-24)", () => {
      const faqSection = [
        "## FAQ",
        "",
        "**Q. 질문 A**",
        "A. 답변입니다.",
        "",
        "**Q. 질문 B**",
        "A. 답변입니다.",
        "",
        "**Q. 질문 C**",
        "A. 답변입니다.",
        "",
        "**Q. 질문 D**",
        "A. 답변입니다.",
      ].join("\n");
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30) + "\n\n" + faqSection)
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_faq_present");
      expect(item?.status).toBe("pass");
    });

    it("FAQ가 있어도 4개 미만이면 wordpress_blog_faq_present가 warning이다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30) + "\n\n## FAQ\n\n**Q. 질문 A**\nA. 답변입니다.")
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_faq_present");
      expect(item?.status).toBe("warning");
    });

    it('핵심 요약 박스(<div class="summary-box">)가 있으면 wordpress_blog_summary_box_present가 pass다 (Phase 2-24)', () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput(
          "도입부입니다. " + "본문 내용. ".repeat(30) + '\n\n<div class="summary-box">\n\n- 결론 1\n\n</div>'
        )
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_summary_box_present");
      expect(item?.status).toBe("pass");
    });

    it("핵심 요약 박스가 없으면 wordpress_blog_summary_box_present가 warning이다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_summary_box_present");
      expect(item?.status).toBe("warning");
    });

    it("표(markdown table)가 있으면 wordpress_blog_table_present가 pass다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput(
          "도입부입니다. " + "본문 내용. ".repeat(30) + "\n\n| 항목 | 설명 |\n|---|---|\n| A | B |"
        )
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_table_present");
      expect(item?.status).toBe("pass");
    });

    it("표가 없으면 wordpress_blog_table_present가 warning이다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_table_present");
      expect(item?.status).toBe("warning");
    });

    it("확인 체크리스트가 있으면 wordpress_blog_checklist_present가 pass다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30) + "\n\n## 확인 체크리스트\n\n- 항목 1")
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_checklist_present");
      expect(item?.status).toBe("pass");
    });

    it("확인 체크리스트가 없으면 wordpress_blog_checklist_present가 warning이다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_checklist_present");
      expect(item?.status).toBe("warning");
    });

    it("자료 기준일 안내가 있으면 wordpress_blog_source_date_notice_present가 pass다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30) + "\n\n## 기준일 안내\n\n작성 시점 기준.")
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_source_date_notice_present");
      expect(item?.status).toBe("pass");
    });

    it("자료 기준일 안내가 없으면 wordpress_blog_source_date_notice_present가 warning이다 (Phase 2-24)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_source_date_notice_present");
      expect(item?.status).toBe("warning");
    });

    it("본문이 1,200자 미만이면 wordpress_blog_body_depth가 fail이다(article summary/excerpt를 옮긴 얕은 글 의심)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("짧은 본문입니다. ".repeat(20)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("fail");
      expect(result.status).toBe("needs_revision");
    });

    it("본문이 1,200자 이상 1,800자 미만이면 wordpress_blog_body_depth가 fail이다(최소 허용 기준 미달)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("본문 내용입니다. ".repeat(150)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("fail");
      expect(result.status).toBe("needs_revision");
    });

    it("본문이 1,800자 이상 2,500자 미만이면 wordpress_blog_body_depth는 pass이지만 목표 길이 미달 메시지를 담는다(quality gate를 통과시키지 않는 1,800자 미만과는 다름)", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("본문 내용입니다. ".repeat(200)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("pass");
      expect(item?.message).toContain("목표");
    });

    it("본문이 2,500자 이상이면 wordpress_blog_body_depth가 pass이고 적절하다는 메시지를 담는다", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("본문 내용입니다. ".repeat(300)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("pass");
      expect(item?.message).toContain("적절합니다");
    });

    it("FAQ 섹션이 없으면 wordpress_blog_faq_present가 warning이다", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("도입부입니다. " + "본문 내용. ".repeat(30)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_faq_present");
      expect(item?.status).toBe("warning");
    });

    it("모든 기준을 만족하는 글은 새 항목이 전부 pass다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput(
          [
            "65세 이상 부모님을 모시고 있다면 장기요양등급부터 확인해야 합니다.",
            "",
            "## 먼저 결론부터 보면",
            "",
            "장기요양등급은 소득이 아니라 심신 상태로 판정되며, 국민건강보험공단에 신청합니다.",
            "",
            "## 신청 조건",
            "",
            "- 조건 A에 해당해야 합니다.",
            "- 조건 B에 해당해야 합니다.",
            "본문 내용입니다. ".repeat(250),
            "",
            "## FAQ",
            "",
            "**Q. 신청은 어디서 하나요?**",
            "A. 국민건강보험공단 지사에서 신청할 수 있습니다.",
            "",
            "**Q. 조건 A와 B를 모두 충족해야 하나요?**",
            "A. 상세 조건은 공식 안내를 확인해야 합니다.",
            "",
            "**Q. 신청 결과는 언제 확인할 수 있나요?**",
            "A. 공식 안내에서 확인해야 합니다.",
            "",
            "**Q. 이의 신청이 가능한가요?**",
            "A. 공식 절차를 통해 이의 신청이 가능합니다.",
            "",
            '<div class="summary-box">',
            "",
            "- 핵심 결론 1",
            "",
            "</div>",
            "",
            "## 주요 지표 비교",
            "",
            "| 항목 | 설명 |",
            "|---|---|",
            "| A | B |",
            "",
            "## 확인 체크리스트",
            "",
            "- 항목 1",
            "- 항목 2",
            "",
            "## 기준일 안내",
            "",
            "이 글은 작성 시점 기준으로 정리했다.",
          ].join("\n")
        )
      );

      for (const key of [
        "wordpress_blog_non_generic_opening",
        "wordpress_blog_early_direct_answer",
        "wordpress_blog_no_unsupported_authority",
        "wordpress_blog_no_ai_exposure_guarantee",
        "wordpress_blog_no_fearmongering",
        "wordpress_blog_faq_present",
        "wordpress_blog_body_depth",
        "wordpress_blog_heading_structure",
        "wordpress_blog_no_slash_joined_points",
        "wordpress_blog_summary_box_present",
        "wordpress_blog_table_present",
        "wordpress_blog_checklist_present",
        "wordpress_blog_source_date_notice_present",
      ]) {
        const item = result.checklist.find((c) => c.key === key);
        expect(item?.status).toBe("pass");
      }
    });

    it("본문에 markdown h2/h3 구조가 없으면 wordpress_blog_heading_structure가 fail이다", () => {
      const result = runSocialPostQualityGate(makeWordpressBlogInput("소제목 없이 이어 쓴 " + "본문 내용입니다. ".repeat(250)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_heading_structure");
      expect(item?.status).toBe("fail");
      expect(result.status).toBe("needs_revision");
    });

    it("핵심 포인트를 '/'로 이어 붙이면 wordpress_blog_no_slash_joined_points가 fail이다", () => {
      const result = runSocialPostQualityGate(
        makeWordpressBlogInput(
          "## 먼저 결론부터 보면\n\n주요 포인트: 조건 A / 조건 B / 조건 C " + "본문 내용입니다. ".repeat(250)
        )
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_no_slash_joined_points");
      expect(item?.status).toBe("fail");
      expect(result.status).toBe("needs_revision");
    });
  });

  describe("wordpress_blog: single_source_mode(usable source 1개) 완화 기준", () => {
    function makeSingleSourceInput(postBody: string, usableSourceCount = 1) {
      return {
        platform: "wordpress_blog" as const,
        toneStyle: "informational" as const,
        postTitle: "장기요양보험 등급 신청 조건과 절차",
        postBody,
        excerpt: "장기요양보험 신청 조건과 절차를 정리했습니다.",
        usableSourceCount,
      };
    }

    it("usable source 1개만으로는 blocked가 되지 않는다 (1,500자 이상 + 확인 필요 사항 섹션 포함 시 ready까지 가능)", () => {
      const result = runSocialPostQualityGate(
        makeSingleSourceInput(
          [
            "65세 이상 부모님을 모시고 있다면 장기요양등급부터 확인해야 합니다.",
            "",
            "## 먼저 결론부터 보면",
            "",
            "장기요양등급은 국민건강보험공단에 신청합니다.",
            "본문 내용입니다. ".repeat(150),
            "",
            "## 확인 필요 사항",
            "정확한 조건/금액/신청 기간은 공식 안내에서 재확인해야 합니다.",
            "",
            "## FAQ",
            "",
            "Q. 신청은 어디서 하나요? 국민건강보험공단 지사에서 신청할 수 있습니다.",
          ].join("\n")
        )
      );
      expect(result.status).not.toBe("blocked");
    });

    it("single_source_mode에서는 1,500자 이상이면 wordpress_blog_body_depth가 pass다 (일반 기준 1,800자보다 완화)", () => {
      const result = runSocialPostQualityGate(makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(160)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("pass");
    });

    it("single_source_mode에서도 1,500자 미만이면 wordpress_blog_body_depth가 fail이다", () => {
      const result = runSocialPostQualityGate(makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(100)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      expect(item?.status).toBe("fail");
    });

    it("single_source_mode인데 확인 필요 사항 섹션이 없으면 fail이다", () => {
      const result = runSocialPostQualityGate(makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(160)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_single_source_verification_needed_section");
      expect(item?.status).toBe("fail");
    });

    it("single_source_mode인데 확인 필요 사항 섹션이 있으면 pass다", () => {
      const result = runSocialPostQualityGate(
        makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(160) + "\n\n## 확인 필요 사항\n\n공식 안내에서 재확인하세요.")
      );
      const item = result.checklist.find((c) => c.key === "wordpress_blog_single_source_verification_needed_section");
      expect(item?.status).toBe("pass");
    });

    it("usable source 1건이면 항상 single_source_mode 안내(warning)를 남긴다", () => {
      const result = runSocialPostQualityGate(makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(160)));
      const item = result.checklist.find((c) => c.key === "wordpress_blog_single_source_notice");
      expect(item?.status).toBe("warning");
    });

    it("usable source 2개 이상이면 single_source_mode 관련 항목이 생기지 않는다 (기존 일반 기준 그대로)", () => {
      const result = runSocialPostQualityGate(makeSingleSourceInput("## 먼저 결론\n\n" + "본문 내용입니다. ".repeat(160), 2));
      expect(result.checklist.find((c) => c.key === "wordpress_blog_single_source_notice")).toBeUndefined();
      expect(
        result.checklist.find((c) => c.key === "wordpress_blog_single_source_verification_needed_section")
      ).toBeUndefined();
      const depthItem = result.checklist.find((c) => c.key === "wordpress_blog_body_depth");
      // 1,500~1,800자 사이는 일반 기준(최소 1,800자)에서는 fail이어야 한다.
      expect(depthItem?.status).toBe("fail");
    });
  });
});
