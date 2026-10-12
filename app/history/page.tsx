import type { Metadata } from "next";
import Link from "next/link";
import { scoreTone, TONE_TEXT, MODE_BADGES, type EvaluationMode } from "@/components/result/types";
import { HISTORY_LIMIT, listEvaluations, type HistorySummary } from "@/lib/history";

export const metadata: Metadata = {
  title: "심사 기록 — AI 심사위원",
};

// 요청마다 저장소를 새로 읽는다 (빌드 시 정적 생성 금지)
export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function repoName(url: string): string {
  return url.replace("https://github.com/", "") || "(레포 정보 없음)";
}

function HistoryRow({ item }: { item: HistorySummary }) {
  const badge = MODE_BADGES[item.evaluation_mode as EvaluationMode];
  return (
    <li>
      <Link
        href={`/history/${item.id}`}
        className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:gap-5"
      >
        <span
          className={`shrink-0 font-mono text-2xl font-semibold tabular-nums sm:w-14 sm:text-right ${TONE_TEXT[scoreTone(item.total_score)]}`}
        >
          {item.total_score}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm break-all">{repoName(item.repo_url)}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <time dateTime={item.evaluated_at}>
              {DATE_FORMAT.format(new Date(item.evaluated_at))}
            </time>
            <span className="border border-ink px-1.5 py-px text-[0.65rem] font-bold text-ink">
              {item.track_label}
            </span>
            {badge && (
              <span className={`px-1.5 py-px text-[0.65rem] font-bold ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {item.missing_docs.length > 0 && (
              <span className="text-caution">누락: {item.missing_docs.join(", ")}</span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function HistoryPage() {
  let items: HistorySummary[] | null = null;
  let failed = false;
  try {
    items = await listEvaluations();
  } catch (error) {
    console.error("[history] 기록 조회 실패", error);
    failed = true;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-ink-soft">심사 기록</p>
        <h1 className="mt-2 font-display text-3xl font-black">최근 심사 기록</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          최근 {HISTORY_LIMIT}건의 심사 결과를 보관합니다. 새 심사가 들어오면 가장
          오래된 기록부터 지워집니다. 항목을 누르면 결과서를 다시 보고 PDF로 받을 수
          있습니다.
        </p>
      </header>

      {failed ? (
        <p role="alert" className="border border-seal bg-seal-soft p-4 text-sm text-seal">
          기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : items === null ? (
        <p className="border border-line bg-sheet p-4 text-sm text-ink-soft">
          기록 저장소가 연결되지 않아 심사 기록을 보관하지 않고 있습니다. 운영자에게
          문의해 주세요.
        </p>
      ) : items.length === 0 ? (
        <p className="border border-line bg-sheet p-4 text-sm text-ink-soft">
          아직 저장된 심사 기록이 없습니다.{" "}
          <Link href="/evaluate" className="font-bold underline underline-offset-2 hover:text-seal">
            심사 접수
          </Link>
          에서 첫 심사를 진행해 보세요.
        </p>
      ) : (
        <section className="border border-line bg-sheet">
          <p className="border-b border-line px-5 py-3 text-xs text-ink-soft">
            총 {items.length}건 · 최신순
          </p>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
