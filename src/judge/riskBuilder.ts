// Design Ref: §2.1 — 채점 기준(9개 세부 항목)에 맞춘 감점 요인 합성. judge/risk_builder.py 동등 이식
import { domain1Keys, trackSpec } from "./tracks";
import {
  INTENT_DOMAIN_LABEL,
  INTENT_IMPLEMENTATION_FIELDS,
  INTENT_KEYS,
  SECURITY_DOMAIN_LABEL,
  SECURITY_FIELDS,
  SECURITY_KEYS,
  type CriterionKey,
  type DomainAssessment,
  type IntentKey,
  type SecurityKey,
  type JudgeTrack,
  type ScoreMap,
} from "./types";

export const LOW_SCORE_THRESHOLD = 70;
export const NO_SIGNIFICANT_RISKS =
  "9개 세부 항목이 모두 70점 이상으로, 채점 기준상 뚜렷한 감점 요인은 없습니다.";

const INTENT_REASONS: Record<IntentKey, Array<[number, number, string]>> = {
  requirement_coverage: [
    [0, 49, "기획서의 핵심 기능이 실행 코드에 거의 반영되지 않았습니다."],
    [50, 69, "기획서 핵심 요구사항 중 일부가 코드에서 누락되었습니다."],
  ],
  success_criteria_met: [
    [0, 49, "기획서의 성공 기준·UI·예외 처리 요구가 코드에서 충족되지 않았습니다."],
    [50, 69, "성공 기준·UI·예외 처리 중 일부가 기획과 다르게 구현되었습니다."],
  ],
  fidelity_no_bloat: [
    [0, 49, "기획 핵심 의도가 왜곡되었거나 기획과 무관한 기능이 과도합니다."],
    [50, 69, "기획 핵심과 코드 구현 사이에 일부 불일치가 있습니다."],
  ],
};

/** 감점 없음 문구인지 — v2.2 이전 기록의 "6개 세부 항목…" 문구도 인정 */
export function isNoSignificantRisks(risks: string[]): boolean {
  return risks.length === 1 && /^\d+개 세부 항목이 모두 70점 이상으로/.test(risks[0]);
}

const SECURITY_REASONS: Record<SecurityKey, Array<[number, number, string]>> = {
  data_protection: [
    [0, 49, "비밀값이 코드에 노출되었거나 비밀번호·개인정보를 안전하지 않게 다룹니다."],
    [50, 69, "민감한 값을 응답·화면·로그에 필요 이상으로 내보냅니다."],
  ],
  access_control: [
    [0, 49, "로그인·권한 없이 데이터를 읽고 쓸 수 있거나, 입력을 그대로 쿼리·HTML에 이어 붙입니다."],
    [50, 69, "권한 확인이나 서버 쪽 입력 검증이 일부 경로에서 빠져 있습니다."],
  ],
  security_requirements: [
    [0, 49, "기획 문서가 약속한 보안 요구를 코드가 지키지 않습니다."],
    [50, 69, "기획 문서에 보안·개인정보 요구가 없거나, 적어 둔 요구 중 상당수가 구현되지 않았습니다."],
  ],
};

const FORBIDDEN_RISK_PATTERNS = [
  "변수명", "네이밍", "pep8", "pep 8", "코딩 스타일", "들여쓰기", "주석",
  "타입 힌트", "리팩토링", "성능 최적화", "디버깅", "print(", "로그를",
  "깃허브", "github url", "레포지토리 url", "파일 업로드", "세 파일", "3개 파일",
];

export interface RiskCandidate {
  key: CriterionKey;
  domain: string;
  label: string;
  score: number;
}

/** 세부 항목 키 → [분야명, 항목 라벨] (트랙별 분야1 + 공통 분야2·3) */
export function criterionMeta(track: JudgeTrack, key: CriterionKey): [string, string] {
  const spec = trackSpec(track);
  const domain1Label = spec.domain1Fields[key];
  if (domain1Label) return [spec.domain1Label, domain1Label];
  if (key in SECURITY_FIELDS) return [SECURITY_DOMAIN_LABEL, SECURITY_FIELDS[key as SecurityKey]];
  return [INTENT_DOMAIN_LABEL, INTENT_IMPLEMENTATION_FIELDS[key as IntentKey]];
}

export function defaultReason(
  track: JudgeTrack,
  criterionKey: CriterionKey,
  score: number,
): string {
  const bands =
    trackSpec(track).domain1Reasons[criterionKey] ??
    INTENT_REASONS[criterionKey as IntentKey] ??
    SECURITY_REASONS[criterionKey as SecurityKey] ??
    [];
  for (const [low, high, text] of bands) {
    if (low <= score && score <= high) return text;
  }
  return "채점 기준 대비 보완이 필요한 부분이 있습니다.";
}

export function sanitizeReason(reason: string): string {
  let cleaned = reason.trim().replace(/\.+$/, "");
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  for (const token of FORBIDDEN_RISK_PATTERNS) {
    if (lower.includes(token)) return "";
  }
  if (cleaned.length > 180) {
    cleaned = cleaned.slice(0, 177).trimEnd() + "...";
  }
  return cleaned + ".";
}

export function formatRisk(
  track: JudgeTrack,
  candidate: RiskCandidate,
  reason: string,
): string {
  const body =
    sanitizeReason(reason) || defaultReason(track, candidate.key, candidate.score);
  return `[${candidate.domain}] ${candidate.label}(${candidate.score}점): ${body}`;
}

/** 적격 분야의 70점 미만 항목만 감점 후보로 수집 (점수 오름차순) */
export function collectRiskCandidates(
  track: JudgeTrack,
  scores: ScoreMap,
  assessment: DomainAssessment,
  threshold: number = LOW_SCORE_THRESHOLD,
): RiskCandidate[] {
  const eligibleKeys: CriterionKey[] = [];
  if (assessment.domain1_ok) eligibleKeys.push(...domain1Keys(track));
  if (assessment.domain2_ok) eligibleKeys.push(...INTENT_KEYS);
  if (assessment.domain3_ok) eligibleKeys.push(...SECURITY_KEYS);

  const candidates: RiskCandidate[] = [];
  for (const key of eligibleKeys) {
    const score = scores[key];
    if (score >= threshold) continue;
    const [domain, label] = criterionMeta(track, key);
    candidates.push({ key, domain, label, score });
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

/** 입력 검증 0점 사유 + 저점 항목만 감점 요인으로 병합 (최대 5개) */
export function composeRisks(
  track: JudgeTrack,
  candidates: RiskCandidate[],
  llmReasons: Partial<Record<CriterionKey, string>>,
  skipRisks: string[],
): string[] {
  const merged: string[] = [...skipRisks];

  for (const candidate of candidates) {
    if (merged.length >= 5) break;
    const raw = llmReasons[candidate.key] ?? "";
    const line = formatRisk(track, candidate, raw);
    if (!merged.includes(line)) merged.push(line);
  }

  if (merged.length === 0) return [NO_SIGNIFICANT_RISKS];
  return merged.slice(0, 5);
}

export function candidatesForPrompt(candidates: RiskCandidate[]): string {
  if (candidates.length === 0) {
    // 부적격 분야의 0점 항목은 후보에서 빠지므로 "모두 70점 이상"이라 단정하면 거짓이 된다
    return (
      "감점 후보 없음 — 채점 대상 항목이 모두 70점 이상이거나, 채점된 항목이 없습니다. " +
      "risk_reasons는 빈 배열 []로 두세요."
    );
  }
  const lines = [
    "아래 항목만 감점 요인(risk_reasons)으로 작성하세요. 목록에 없는 항목은 금지합니다.",
    "",
  ];
  for (const item of candidates) {
    lines.push(
      `- criterion_key: ${item.key} | [${item.domain}] ${item.label} | 점수: ${item.score}`,
    );
  }
  return lines.join("\n");
}
