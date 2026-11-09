// 기존 tests/test_input_validator.py 케이스 동등 이식
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessDomains, isTrivialGarbage, topicCounts } from "@/judge/inputValidator";

const EXAMPLE = path.join(process.cwd(), "examples", "01_csv_dashboard");

function loadExample(): [string, string] {
  const plan = readFileSync(path.join(EXAMPLE, "PLAN.md"), "utf-8");
  const code = readFileSync(path.join(EXAMPLE, "app.py"), "utf-8");
  return [plan, code];
}

describe("assessDomains", () => {
  it("Pass 예상 예시는 두 분야 모두 적격", () => {
    const assessment = assessDomains(...loadExample());
    expect(assessment.all_fatal).toBe(false);
    expect(assessment.domain1_ok).toBe(true);
    expect(assessment.domain2_ok).toBe(true);
  });

  it("기획서에 csv 문자열이 없어도 코드와 주제 매칭", () => {
    const [plan, code] = loadExample();
    const planWithoutCsv = plan.replaceAll("csv", "데이터 파일");
    const assessment = assessDomains(planWithoutCsv, code);
    expect(assessment.domain2_ok).toBe(true);
  });

  it("placeholder 입력은 전체 부적격(fatal)", () => {
    const assessment = assessDomains("테스트", "테스트");
    expect(assessment.all_fatal).toBe(true);
  });

  it("기획서 미발견 시 두 분야 모두 부적격", () => {
    const [, code] = loadExample();
    const assessment = assessDomains("", code);
    expect(assessment.all_fatal).toBe(false);
    expect(assessment.domain1_ok).toBe(false);
    expect(assessment.domain2_ok).toBe(false);
    expect(assessment.domain1_reasons[0]).toContain("기획 문서");
    expect(assessment.domain3_ok).toBe(false);
  });

  it("주제 불일치는 의도 구현도만 0점, 보안 분야는 그대로 채점", () => {
    const plan =
      "# 뉴스 요약 앱 기획서\n\n뉴스 기사를 모아 요약합니다. 뉴스 출처별로 정리하고 " +
      "뉴스 키워드를 추출하는 기능을 구현합니다. 성공 기준: 사용자가 뉴스 요약을 화면에서 본다.\n";
    const code =
      "import streamlit as st\n\nst.title('영수증 정산')\nfile = st.file_uploader('영수증')\n" +
      "st.write('정산 결과')\nst.dataframe(rows)\n";
    const assessment = assessDomains(plan, code);
    expect(assessment.domain2_ok).toBe(false);
    expect(assessment.domain3_ok).toBe(true);
  });

  it("코드가 없으면 fatal", () => {
    const assessment = assessDomains("", "");
    expect(assessment.all_fatal).toBe(true);
  });

  it("영문이 하나도 없는 순수 한글 기획서도 무의미 입력이 아니다", () => {
    // JS의 \w는 ASCII 한정이라 한글만 쓴 문서가 "기호뿐인 입력"으로 오판되던 회귀
    const plan =
      "# 팀 업무 관리 보드 기획서\n\n" +
      "## 배경\n우리 팀은 업무를 관리할 도구가 필요합니다.\n\n" +
      "## 기능\n1. 할 일 추가\n2. 목록 보기\n3. 완료 체크\n\n" +
      "## 성공 기준\n담당자가 화면에서 바로 확인할 수 있다.\n";
    expect(isTrivialGarbage(plan)).toBe(false);
  });

  it("숫자·기호만 있는 입력은 여전히 무의미 입력", () => {
    expect(isTrivialGarbage("1234 !!! ... 5678 ???")).toBe(true);
  });

  it("README가 없는 레포도 정상 심사 (README 축 폐지)", () => {
    const [plan, code] = loadExample();
    const assessment = assessDomains(plan, code);
    expect(assessment.all_fatal).toBe(false);
    expect(assessment.domain1_ok).toBe(true);
    expect(assessment.domain2_ok).toBe(true);
  });

  it("JavaScript 코드도 실행 코드로 인정 (언어 중립)", () => {
    const [plan] = loadExample();
    const code =
      "import { parse } from 'csv-parse';\n\n" +
      "export function summarize(rows) {\n  const totals = rows.map(Number);\n  return totals;\n}\n" +
      "const upload = document.querySelector('#csv-upload');\n";
    const assessment = assessDomains(plan, code);
    expect(assessment.domain2_ok).toBe(true);
  });

  it("한두 번 스친 주제어로는 주제 불일치 판정을 내지 않는다 (gongmae-checklist 회귀)", () => {
    // 기획서는 범위 밖에서만 "업로드"를 언급하고, 코드는 CSS 주석의 "대시보드"와
    // data-state="todo" 속성뿐 — 실제로는 같은 공매 점검 앱인데 의도 구현도가 0점이 됐었다
    const plan =
      "# 공매 물건 점검 체크리스트 기획서\n\n## 핵심 기능\n1. 물건 등록과 점검 항목 체크\n" +
      "2. 마감일 계산과 담당자별 현황\n3. 온비드 조회로 낙찰일 채우기\n\n## 성공 기준\n" +
      "담당자가 화면에서 점검 진행률을 확인할 수 있다.\n\n## 범위 밖\n- 서류 원본 파일 업로드·보관\n" +
      "- 서류 원본 업로드, 법률 자문\n";
    const code =
      "/* 헤더 아래 선: 대시보드의 색 정체성 */\n.header { color: red; }\n" +
      "/* 대시보드 팔레트 */\n" +
      "export function CaseDetail() {\n  return <li data-state=\"todo\">점검</li>;\n}\n";
    const assessment = assessDomains(plan, code);
    expect(assessment.domain2_ok).toBe(true);
  });

  it("양쪽 모두 뚜렷한 다른 주제면 여전히 주제 불일치로 판정", () => {
    const plan =
      "# 뉴스 요약 앱 기획서\n\n뉴스 기사를 모아 요약합니다. 뉴스 출처별로 정리하고 " +
      "뉴스 키워드를 추출하는 기능을 구현합니다. 성공 기준: 사용자가 뉴스 요약을 화면에서 본다.\n";
    const code =
      "import streamlit as st\n\nst.title('영수증 정산')\nfile = st.file_uploader('영수증')\n" +
      "st.write('정산 결과')\nst.dataframe(rows)\n";
    const assessment = assessDomains(plan, code);
    expect(assessment.domain2_ok).toBe(false);
    expect(assessment.domain2_reasons[0]).toContain("주제가 일치하지 않습니다");
  });

  it("식별자 안에 걸친 영문 주제어(toDogColumns → todo)는 세지 않아 주제 불일치로 0점 처리하지 않음", () => {
    // 실제 사례: 반려견 매칭 앱. 기획서는 "서류 업로드"를 3번, 코드는 toDogColumns·toDogId 를 7번 —
    // 소문자 부분 문자열로 세면 "할 일 관리"가 코드 주제로 떠서 의도 구현도가 0점이 됐다
    const plan =
      "# 강아지 산책 친구 찾기 기획서\n\n## 핵심 기능\n1. 강아지 등록 화면\n2. 건강검진 서류 업로드\n" +
      "3. 서류 업로드 후 AI가 품종을 읽음\n\n## 예외\n- 외부 AI 전송 동의 없음: 서류 업로드 불가\n" +
      "## 성공 기준\n사용자가 근처 강아지에게 산책을 신청할 수 있다.\n";
    const code =
      "export function toDogColumns(input) {\n  return { name: input.name };\n}\n" +
      "const schema = z.object({ fromDogId: z.uuid(), toDogId: z.uuid() });\n" +
      "await admin.from('dogs').insert(toDogColumns(data));\n" +
      "await admin.from('dogs').update(toDogColumns(data));\n" +
      "rpc({ p_to_dog: parsed.data.toDogId });\n";
    expect(topicCounts(code).get("todo")).toBeUndefined();
    expect(assessDomains(plan, code).domain2_ok).toBe(true);
  });

  it("영문 주제어 경계: camelCase 새 단어·복수형·주석은 세고, 단어 중간은 세지 않음", () => {
    const counts = topicCounts("// TODO: fix\nconst todos = addTodo(todoList);\nrenews(); newsFeed(); uploadedFiles; reupload();");
    expect(counts.get("todo")).toBe(4); // TODO, todos, addTodo(Todo), todoList
    expect(counts.get("news")).toBe(1); // newsFeed 만 — renews 는 단어 중간
    expect(counts.get("upload")).toBe(1); // uploadedFiles 만 — reupload 는 단어 중간
  });

  it("공공 API 숫자 ID가 있어도 코드 정상 인식", () => {
    const [plan] = loadExample();
    const code =
      "import streamlit as st\n\n" +
      "# RSS: detailRssTagService.do?bbsId=MOSFBBS_000000000028\n" +
      "def main():\n    st.title('ReleasePick')\n\n" +
      "if __name__ == '__main__':\n    main()\n";
    const assessment = assessDomains(plan, code);
    expect(assessment.domain2_ok).toBe(true);
  });
});
