"use client";

import type { ApiEvaluation } from "./types";

/** 레포에서 찾지 못한 기획 문서 안내 — 하나만 빠지면 주의, 둘 다 빠지면 0점 사유 */
export function MissingDocsNotice({ result }: { result: ApiEvaluation }) {
  const missing = result.repo?.missing_docs ?? [];
  if (missing.length === 0) return null;

  const allMissing = missing.length >= 2;
  const tone = allMissing
    ? "border-seal bg-seal-soft text-seal"
    : "border-caution bg-caution-soft text-caution";

  return (
    <section role="note" className={`border p-4 text-sm leading-relaxed ${tone}`}>
      <p className="font-bold">
        누락된 파일:{" "}
        {missing.map((name, index) => (
          <span key={name}>
            {index > 0 && ", "}
            <span className="font-mono">{name}</span>
          </span>
        ))}
      </p>
      <p className="mt-1">
        {allMissing
          ? "레포에서 기획 문서를 찾지 못해 두 분야 모두 0점 처리했습니다. PRD.md 또는 PLAN.md를 레포에 올린 뒤 다시 제출해 주세요."
          : "있는 문서만으로 채점했습니다. 빠진 문서를 함께 올리면 채점 근거가 더 충실해집니다."}
      </p>
    </section>
  );
}
