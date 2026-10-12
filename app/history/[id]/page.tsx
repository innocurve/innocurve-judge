import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultSheet } from "@/components/result/ResultSheet";
import type { ApiEvaluation } from "@/components/result/types";
import { getEvaluation, isValidHistoryId } from "@/lib/history";

export const metadata: Metadata = {
  title: "심사 결과서 — AI 심사위원",
};

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidHistoryId(id)) notFound();

  const result = (await getEvaluation(id)) as ApiEvaluation | null;
  if (!result) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/history"
        data-print-hide
        className="self-start text-sm text-ink-soft underline underline-offset-2 hover:text-seal"
      >
        ← 심사 기록으로
      </Link>
      <ResultSheet result={result} />
    </div>
  );
}
