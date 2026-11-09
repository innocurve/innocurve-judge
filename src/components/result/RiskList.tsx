"use client";

import { isNoSignificantRisks } from "@/judge/riskBuilder";
import type { ApiEvaluation } from "./types";

/** 감점 요인 — 최대 5개. 감점이 없으면 순번 없이 긍정 톤으로 표시 */
export function RiskList({ result }: { result: ApiEvaluation }) {
  const none = isNoSignificantRisks(result.risks);

  return (
    <section>
      <h3 className="font-display text-lg font-bold">감점 요인</h3>
      {none ? (
        <p className="mt-3 border border-line bg-verdant-soft p-3 text-sm leading-relaxed text-verdant">
          {result.risks[0]}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {result.risks.map((risk, index) => (
            <li
              key={`${index}-${risk}`}
              className="flex gap-3 border border-line bg-paper p-3 text-sm leading-relaxed"
            >
              <span className="shrink-0 font-mono text-xs text-seal">{index + 1}</span>
              <span>{risk}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
