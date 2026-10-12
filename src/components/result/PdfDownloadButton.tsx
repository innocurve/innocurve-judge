"use client";

import { useState } from "react";
import type { ApiEvaluation } from "./types";

function fileName(result: ApiEvaluation): string {
  const repo = result.repo?.url.replace("https://github.com/", "").replace(/\//g, "-") ?? "결과";
  const date = result.evaluated_at ? new Date(result.evaluated_at) : new Date();
  // 파일명 날짜는 한국 시각 기준
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" })
    .format(date)
    .replaceAll("-", "");
  return `심사결과서_${repo}_${ymd}.pdf`;
}

/** 심사 결과서 PDF 받기 — 누를 때 PDF 엔진·글꼴을 불러와 브라우저에서 만든다 */
export function PdfDownloadButton({ result }: { result: ApiEvaluation }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    setState("working");
    try {
      const [{ pdf }, { ResultPdf, registerPdfFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/ResultPdf"),
      ]);
      registerPdfFonts(window.location.origin);
      const blob = await pdf(<ResultPdf result={result} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(result);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch (error) {
      console.error("[pdf] 결과서 PDF 생성 실패", error);
      setState("error");
    }
  }

  return (
    <div data-print-hide className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void download()}
        disabled={state === "working"}
        aria-busy={state === "working"}
        className="border-2 border-ink bg-sheet px-4 py-2 text-sm font-bold transition-colors hover:border-seal hover:text-seal disabled:cursor-wait disabled:border-line disabled:text-ink-soft"
      >
        {state === "working" ? "PDF 만드는 중…" : "PDF로 받기"}
      </button>
      {state === "error" && (
        <p role="alert" className="text-xs text-seal">
          PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
