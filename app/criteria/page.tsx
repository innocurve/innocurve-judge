import type { Metadata } from "next";
import { allTrackSpecs } from "@/judge/tracks";
import {
  INTENT_DOMAIN_LABEL,
  INTENT_IMPLEMENTATION_FIELDS,
  SECURITY_DOMAIN_LABEL,
  SECURITY_FIELDS,
} from "@/judge/types";

export const metadata: Metadata = {
  title: "채점 기준 — AI 심사위원",
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  requirement_coverage: "기획서의 핵심 기능이 코드에 반영됐는가.",
  success_criteria_met: "기획서의 성공 기준·UI·예외 처리 요구가 충족됐는가.",
  fidelity_no_bloat: "기획 의도가 왜곡되지 않았고, 무관한 기능이 과하지 않은가.",
};

const SECURITY_DESCRIPTIONS: Record<string, string> = {
  data_protection:
    "API 키·비밀번호를 코드에 적지 않았는가. 개인정보는 필요한 만큼만 저장·표시하는가.",
  access_control:
    "여러 사람이 쓰는 앱이면 서버에서 로그인·권한을 확인하는가. 입력값을 서버에서 검증하는가.",
  security_requirements: "기획 문서에 적은 보안·개인정보·권한 요구가 코드에 구현됐는가.",
};

interface CriterionRow {
  key: string;
  label: string;
  description: string;
}

function DomainSection({
  no,
  title,
  target,
  intro,
  criteria,
}: {
  no: string;
  title: string;
  target: string;
  intro: string;
  criteria: CriterionRow[];
}) {
  return (
    <section className="border border-line bg-sheet">
      <div className="border-b border-line px-6 py-4">
        <p className="text-xs font-medium tracking-widest text-ink-soft">{no}</p>
        <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
        <p className="mt-1 text-xs text-ink-soft">
          평가 대상 · {target} — {intro}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {criteria.map((criterion) => (
          <li
            key={criterion.key}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <span className="shrink-0 text-sm font-bold sm:w-44">{criterion.label}</span>
            <span className="text-sm text-ink-soft">{criterion.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const INTENT_CRITERIA: CriterionRow[] = Object.entries(INTENT_IMPLEMENTATION_FIELDS).map(
  ([key, label]) => ({ key, label, description: INTENT_DESCRIPTIONS[key] }),
);

const SECURITY_CRITERIA: CriterionRow[] = Object.entries(SECURITY_FIELDS).map(
  ([key, label]) => ({ key, label, description: SECURITY_DESCRIPTIONS[key] }),
);

export default function CriteriaPage() {
  return (
    <div className="flex flex-col gap-14">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-ink-soft">채점 기준 고시</p>
        <h1 className="mt-2 font-display text-3xl font-black">
          트랙별 3개 분야 · 9개 항목
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          심사는 기관용·기업용 두 트랙으로 나뉩니다. 제1분야는 트랙마다 기준이 다르고,
          제2분야(의도 구현도)와 제3분야(보안 적합성)는 두 트랙 공통입니다. 모든 항목은
          0~100점으로 채점하며, 분야 점수는 세부 3개 항목의 평균, 종합 점수는 3개 분야의
          평균입니다. 70점 미만
          항목은 감점 요인으로 기록되며, 최대 5개까지 표시됩니다.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-seal">
          두 트랙은 채점 기준이 다르므로 점수를 서로 비교할 수 없습니다.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-black">제1분야 — 트랙별</h2>
        {allTrackSpecs().map((spec) => (
          <div key={spec.id} className="flex flex-col gap-2">
            <p className="text-sm text-ink-soft">
              <span className="font-bold text-ink">{spec.label} 트랙</span> ·{" "}
              {spec.description}
            </p>
            <DomainSection
              no={`제1분야 · ${spec.label}`}
              title={spec.domain1Label}
              target={spec.domain1Target}
              intro={spec.domain1Intro}
              criteria={Object.entries(spec.domain1Fields).map(([key, label]) => ({
                key,
                label,
                description: spec.domain1Descriptions[key],
              }))}
            />
          </div>
        ))}
      </section>

      {/* 제2·3분야는 두 트랙 공통 — 한 번만 표시 */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-black">제2분야 — 두 트랙 공통</h2>
        <DomainSection
          no="제2분야"
          title={INTENT_DOMAIN_LABEL}
          target="기획서 ↔ 실행 코드"
          intro="기획서에 적은 내용이 실행 코드에 실제로 구현됐는지 대조합니다."
          criteria={INTENT_CRITERIA}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-black">제3분야 — 두 트랙 공통</h2>
        <DomainSection
          no="제3분야"
          title={SECURITY_DOMAIN_LABEL}
          target="기획서 + 실행 코드"
          intro="앱이 다루는 데이터와 사용 방식에 비해 위험한 보안 구멍이 없는지 봅니다. 교육 과제 수준에 맞춰, 앱에 해당하지 않는 요구로는 감점하지 않습니다."
          criteria={SECURITY_CRITERIA}
        />
      </section>
    </div>
  );
}
