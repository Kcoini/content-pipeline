// Phase UX-03A: SocialPostBodyPanel(카드 안 inline 편집)에서 "편집
// 모드"의 UI만 분리한 공통 컴포넌트. 저장은 여전히 호출 측이 넘기는
// server action(saveAction)이 담당한다 — 이 컴포넌트는 client-side
// value/onChange 콜백으로 강제 통합하지 않는다(Server Action form
// 기반 저장 방식을 그대로 유지해야 기존 호출부를 바꾸지 않고 재사용할
// 수 있다). 빈 본문 검증은 서버(saveSocialPostBodyAndProcess/
// saveSocialPostThreadAndProcess)에서 이미 하고 있으므로 여기서 중복
// 검증을 추가하지 않는다.
//
// Phase UX-03B2: X처럼 threadItems 배열로 구성된 콘텐츠를 위해
// mode="thread"를 추가했다 — 하나의 textarea에 thread 전체를 억지로
// 합치지 않고, item마다 별도 textarea를 보여준다. 저장 시에는 모든
// textarea가 같은 name="threadItemText"를 쓰고, 호출 측 server action이
// FormData.getAll("threadItemText")로 순서 그대로 받는다(HTML form은
// 필드를 DOM 순서대로 직렬화하므로 별도 순서 필드가 필요 없다).
// mode="single"(기본값)은 기존 동작과 100% 동일하다.

interface CommonProps {
  articleId: string;
  socialPostId: string;
  returnTo: string;
  /** 편집 영역 위에 보여줄 제목(예: "게시용 본문 수정"). */
  title: string;
  /** 저장을 처리하는 server action. 저장 방식(저장만/저장+검토/저장+승인)은 버튼의 name="saveMode" value로 구분한다. */
  saveAction: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

export interface InlinePostBodyEditorSingleModeProps extends CommonProps {
  mode?: "single";
  /** 편집 대상 본문 초기값. */
  value: string;
}

export interface InlinePostBodyEditorThreadModeProps extends CommonProps {
  mode: "thread";
  /** thread item 목록(순서대로). 빈 항목 방지/재검증은 서버가 한다 — 여기서는 그대로 렌더링만 한다. */
  items: Array<{ text: string }>;
  /** item별 권장 글자 수 제한(예: X의 280자). 있으면 각 textarea 아래 "128/280자"로 보여준다 — 새 제한을 만들지 않고 호출 측이 기존 값을 그대로 전달한다. */
  maxLengthPerItem?: number;
}

export type InlinePostBodyEditorProps = InlinePostBodyEditorSingleModeProps | InlinePostBodyEditorThreadModeProps;

const SAVE_BUTTONS_CLASS = "mt-2 flex flex-wrap gap-2 text-[11px]";

function SaveButtons({ onCancel }: { onCancel: () => void }) {
  return (
    <div className={SAVE_BUTTONS_CLASS}>
      <button
        type="submit"
        name="saveMode"
        value="save_review_and_approve"
        className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500"
      >
        저장 후 승인
      </button>
      <button
        type="submit"
        name="saveMode"
        value="save_and_review"
        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
      >
        저장 후 자동 검토
      </button>
      <button
        type="submit"
        name="saveMode"
        value="save_only"
        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
      >
        저장만 하기
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-500 hover:bg-zinc-100"
      >
        취소
      </button>
    </div>
  );
}

/**
 * 카드/화면 안에서 페이지 이동 없이 본문(또는 thread)을 편집하는 공통
 * UI. "저장 후 승인"/"저장 후 자동 검토"/"저장만 하기"/"취소" 4개
 * action을 항상 같은 순서로 제공한다.
 */
export function InlinePostBodyEditor(props: InlinePostBodyEditorProps) {
  const { articleId, socialPostId, returnTo, title, saveAction, onCancel } = props;

  return (
    <div className="mt-2 rounded border border-indigo-300 bg-white p-2">
      <p className="text-[11px] font-semibold text-indigo-900">{title}</p>
      <form action={saveAction}>
        <input type="hidden" name="articleId" value={articleId} />
        <input type="hidden" name="socialPostId" value={socialPostId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        {props.mode === "thread" ? (
          <div className="mt-1 flex flex-col gap-3">
            {props.items.map((item, index) => (
              <div key={index}>
                <p className="text-[10px] font-medium text-zinc-500">
                  {index + 1}/{props.items.length}
                  {props.maxLengthPerItem != null && (
                    <span className="ml-1 font-normal text-zinc-400">
                      ({item.text.length}/{props.maxLengthPerItem}자)
                    </span>
                  )}
                </p>
                <textarea
                  name="threadItemText"
                  defaultValue={item.text}
                  rows={3}
                  className="mt-0.5 w-full rounded border border-zinc-300 p-2 text-[12px] text-zinc-800"
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <textarea
            name="body"
            defaultValue={props.value}
            rows={10}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-[12px] text-zinc-800"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}
          />
        )}

        <SaveButtons onCancel={onCancel} />
      </form>
    </div>
  );
}
