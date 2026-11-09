"use client";

import { resultDomains, scoreTone, TONE_TEXT, type ApiEvaluation } from "./types";

/** 분야 카드(3개, 이전 기록은 2개) — 부적격 분야는 사유를 함께 표기 */
export function DomainCards({ result }: { result: ApiEvaluation }) {
  const domains = resultDomains(result);
  return (
    <section className={`grid gap-3 ${domains.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {domains.map((domain) => (
        <article key={domain.title} className="border border-line bg-paper p-4">
          <h3 className="text-sm font-bold">{domain.title}</h3>
          {domain.skipped ? (
            <>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-seal">0</p>
              <p className="mt-1 w-fit bg-seal-soft px-1.5 py-0.5 text-xs font-bold text-seal">
                분야 부적격
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-soft">
                {domain.reasons.slice(0, 2).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${TONE_TEXT[scoreTone(domain.score)]}`}
            >
              {domain.score}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
