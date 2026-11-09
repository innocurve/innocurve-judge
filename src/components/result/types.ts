// /api/evaluate 스트림의 result payload 타입 (src/lib/serialize.ts 출력과 1:1)

export type EvaluationMode = "full" | "partial" | "full_zero" | "fatal_zero";

export interface ApiCriterion {
  key: string;
  domain: string;
  label: string;
  score: number;
  samples: number[];
  range: number;
  unstable: boolean;
}

export type JudgeTrack = "public" | "corporate";

export interface ApiEvaluation {
  track: JudgeTrack;
  track_label: string;
  strengths: string[];
  risks: string[];
  final_verdict: string;
  total_score: number;
  domain1_score: number;
  domain2_score: number;
  /** 보안 적합성 — v2.3 이전 저장 기록에는 없음 */
  domain3_score?: number;
  domain_labels: { domain1: string; domain2: string; domain3?: string };
  review_fallback: boolean;
  evaluation_mode: EvaluationMode;
  skip_reasons: { domain1: string[]; domain2: string[]; domain3?: string[] };
  domain_skipped: { domain1: boolean; domain2: boolean; domain3?: boolean };
  ensemble: { n: number; model: string; fallback_used: boolean; unstable_count: number };
  criteria: ApiCriterion[];
  repo?: {
    url: string;
    branch: string;
    files: string[];
    plan_path: string | null;
    /** v2.2 이전 저장 기록에는 없을 수 있음 */
    prd_path?: string | null;
    missing_docs?: string[];
  };
  /** 최근 심사 기록 저장 시 부여되는 식별자·시각 (저장소 미연결 시 없음) */
  history_id?: string;
  evaluated_at?: string;
}

export type StreamStage =
  | "fetching"
  | "validating"
  | "scoring"
  | "aggregating"
  | "reviewing";

export type StreamLine =
  | { type: "stage"; stage: StreamStage; message: string }
  | { type: "result"; data: ApiEvaluation }
  | { type: "error"; error: { code: string; message: string } };

export interface DomainInfo {
  title: string;
  score: number;
  skipped: boolean;
  reasons: string[];
}

/** 결과서에 표시할 분야 목록 — 보안 분야가 없는 이전 기록은 2개만 */
export function resultDomains(result: ApiEvaluation): DomainInfo[] {
  const domains: DomainInfo[] = [
    {
      title: result.domain_labels.domain1,
      score: result.domain1_score,
      skipped: result.domain_skipped.domain1,
      reasons: result.skip_reasons.domain1,
    },
    {
      title: result.domain_labels.domain2,
      score: result.domain2_score,
      skipped: result.domain_skipped.domain2,
      reasons: result.skip_reasons.domain2,
    },
  ];
  if (result.domain_labels.domain3 && result.domain3_score !== undefined) {
    domains.push({
      title: result.domain_labels.domain3,
      score: result.domain3_score,
      skipped: result.domain_skipped.domain3 ?? false,
      reasons: result.skip_reasons.domain3 ?? [],
    });
  }
  return domains;
}

/** 점수대별 시각 톤 — 70 이상 적정(청록), 50~69 주의(황갈), 미만 미흡(인주) */
export function scoreTone(score: number): "verdant" | "caution" | "seal" {
  if (score >= 70) return "verdant";
  if (score >= 50) return "caution";
  return "seal";
}

export const TONE_TEXT: Record<ReturnType<typeof scoreTone>, string> = {
  verdant: "text-verdant",
  caution: "text-caution",
  seal: "text-seal",
};

export const MODE_BADGES: Record<EvaluationMode, { label: string; className: string }> = {
  full: { label: "정식 심사", className: "bg-verdant-soft text-verdant" },
  partial: { label: "부분 심사", className: "bg-caution-soft text-caution" },
  full_zero: { label: "전 항목 0점", className: "bg-seal-soft text-seal" },
  fatal_zero: { label: "심사 부적격", className: "bg-seal-soft text-seal" },
};
