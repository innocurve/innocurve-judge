// 심사 트랙 레지스트리 — 분야1만 트랙별로 갈리므로, 갈리는 데이터를 여기 한 곳에 모은다.
// 코드 실행 경로는 트랙과 무관하게 하나로 유지한다 (분야2·집계·직렬화·UI 공통).
import {
  CORPORATE_FIELDS,
  PUBLIC_SECTOR_FIELDS,
  THEME_FIELDS,
  isJudgeTrack,
  type CorporateKey,
  type Domain1Key,
  type JudgeTrack,
  type PublicSectorKey,
  type ThemeKey,
} from "./types";

/** 점수대별 기본 감점 사유 — [하한, 상한, 문구] */
type ReasonBands = ReadonlyArray<readonly [number, number, string]>;

export interface TrackSpec {
  id: JudgeTrack;
  /** 접수 화면·결과서에 노출되는 트랙 이름 */
  label: string;
  /** 트랙 성격 한 줄 설명 */
  description: string;
  /** 분야1 이름 */
  domain1Label: string;
  /** 분야1 평가 대상 */
  domain1Target: string;
  /** 분야1 소개 문장 (채점 기준 페이지) */
  domain1Intro: string;
  /** 분야1 프롬프트 파일명 */
  domain1Prompt: string;
  /** 분야1 세부 항목 키 → 한국어 라벨 */
  domain1Fields: Readonly<Record<string, string>>;
  /** 분야1 세부 항목별 설명 (채점 기준 페이지) */
  domain1Descriptions: Readonly<Record<string, string>>;
  /** 분야1 세부 항목별 기본 감점 사유 */
  domain1Reasons: Readonly<Record<string, ReasonBands>>;
  /** 분야1 부적격 시 총평에서 걸러낼 칭찬 주제 */
  strengthFilter: RegExp;
  /** 분야1 부적격 시 결과서 감점 목록 라벨 */
  skipLabel: string;
}

const PUBLIC_SPEC: TrackSpec = {
  id: "public",
  label: "기관용",
  description: "공공기관·지자체 업무 현장의 문제 해결을 기준으로 심사합니다.",
  domain1Label: "공공기관 적합성",
  domain1Target: "기획서",
  domain1Intro: "기획서만 읽고 공공 현장의 문제 인식과 해결 방향을 평가합니다.",
  domain1Prompt: "domain1_public.txt",
  domain1Fields: PUBLIC_SECTOR_FIELDS,
  domain1Descriptions: {
    pain_point_clarity: "공공 현장·업무의 문제가 구체적으로 드러나는가.",
    solution_appropriateness: "제시한 해결 방향이 그 문제를 실질적으로 줄이는가.",
    public_feasibility: "보안·개인정보·예산·조직 등 현장 적용 전제를 고려했는가.",
  },
  domain1Reasons: {
    pain_point_clarity: [
      [0, 49, "기획서에 공공 현장·업무의 문제가 구체적으로 드러나지 않습니다."],
      [50, 69, "페인포인트가 추상적이거나 공공 서비스 맥락이 약합니다."],
    ],
    solution_appropriateness: [
      [0, 49, "제시된 해결 방향이 기획된 문제를 실질적으로 줄이지 못합니다."],
      [50, 69, "해결 방향이 공공 서비스 맥락(투명성·접근성·업무 연속성)에 부분적으로만 부합합니다."],
    ],
    public_feasibility: [
      [0, 49, "보안·개인정보·예산·조직·레거시 환경 등 현장 적용 전제가 거의 드러나지 않습니다."],
      [50, 69, "현장 공무원·실무자가 실제로 쓰기 어려운 전제나 누락이 있습니다."],
    ],
  },
  strengthFilter: /공공|기획서|페인|현장|정책|행정|기관|적합성/i,
  skipLabel: "[기획서 0점]",
};

const CORPORATE_SPEC: TrackSpec = {
  id: "corporate",
  label: "기업용",
  description: "사내 업무 개선 효과와 자체 구축 정당성을 기준으로 심사합니다.",
  domain1Label: "사업 타당성",
  domain1Target: "기획서",
  domain1Intro:
    "기획서만 읽고 업무 문제의 구체성과 직접 만들 이유가 있는지를 평가합니다.",
  domain1Prompt: "domain1_corporate.txt",
  domain1Fields: CORPORATE_FIELDS,
  domain1Descriptions: {
    problem_cost_clarity:
      "업무 병목이 시간·건수·금액 등 규모로 환산되어 드러나는가.",
    build_justification:
      "엑셀·노션·기성 SaaS로 대체되지 않고 직접 만들 이유가 있는가.",
    operational_viability:
      "도입 비용·기존 시스템 연동·운영 인력까지 고려됐는가.",
  },
  domain1Reasons: {
    problem_cost_clarity: [
      [0, 49, "누가 어떤 업무에서 왜 불편한지가 기획서에 드러나지 않습니다."],
      [50, 69, "대상 업무는 있으나 '효율 개선' 수준의 추상적 서술에 머뭅니다."],
    ],
    build_justification: [
      [0, 49, "이미 널리 쓰이는 도구의 단순 재구현으로, 직접 만들 이유가 제시되지 않았습니다."],
      [50, 69, "엑셀·노션·기성 SaaS로 상당 부분 대체 가능해 보입니다."],
    ],
    operational_viability: [
      [0, 49, "데이터 확보 경로·운영 인력 등 실제 조직에서 굴릴 전제가 거의 없습니다."],
      [50, 69, "도입 비용·기존 시스템 연동·유지보수 계획 중 일부가 비어 있습니다."],
    ],
  },
  strengthFilter: /기획서|업무|비용|절감|사내|도입|운영|타당성|구축/i,
  skipLabel: "[기획서 0점]",
};

/**
 * 주제 맞춤 — 학교·교육기관 과정처럼 "공공 업무"도 "사내 업무"도 아닌 산출물 (운영 요청 2026-11).
 * 한남대 스포츠테크 앱을 기관용으로 돌리면 공공기관 맥락이 없다고 상한이 걸리고, 기업용은 자체 구축·비용을 따졌다.
 * 주제(키워드)는 심사 접수 때 입력하고, 프롬프트(prompts/domain1_theme.txt)에 그대로 넣는다 (domain1ThemePrompt).
 */
const THEME_SPEC: TrackSpec = {
  id: "theme",
  label: "주제 맞춤",
  description: "학교·교육기관 등 과정마다 정한 주제(키워드)에 맞는 기획인지를 기준으로 심사합니다.",
  domain1Label: "주제 적합성",
  domain1Target: "기획서",
  domain1Intro: "기획서만 읽고 과정 주제에 맞는 문제를 골라 그 분야 사용자가 쓸 수 있게 기획했는지를 평가합니다.",
  domain1Prompt: "domain1_theme.txt",
  domain1Fields: THEME_FIELDS,
  domain1Descriptions: {
    theme_problem_clarity: "그 주제 분야에서 누가 어떤 상황에서 겪는 문제인지가 근거와 함께 드러나는가.",
    theme_fit: "주제가 앱의 핵심 목적이고, 그 분야의 지식·데이터·규칙이 핵심 로직에 쓰였는가.",
    theme_usability: "그 분야의 실제 사용자가 실제 환경의 제약 속에서 쓸 수 있는가.",
  },
  domain1Reasons: {
    theme_problem_clarity: [
      [0, 49, "기획서에 누가 어떤 상황에서 겪는 문제인지가 드러나지 않습니다."],
      [50, 69, "대상 사용자는 있으나 문제 상황이 추상적으로 서술되어 있습니다."],
    ],
    theme_fit: [
      [0, 49, "기획이 과정 주제와 관련이 거의 없습니다."],
      [50, 69, "주제가 이름·배경에만 드러나고, 기능은 어느 분야에나 쓰이는 범용 도구에 가깝습니다."],
    ],
    theme_usability: [
      [0, 49, "그 분야의 실제 사용 환경에서 쓰기 어려운 수준입니다."],
      [50, 69, "입력 데이터 확보·사용 장소·기기 등 실제로 쓰기 위한 전제가 일부 비어 있습니다."],
    ],
  },
  strengthFilter: /기획서|주제|부합|문제|현장|활용|적합성/i,
  skipLabel: "[기획서 0점]",
};

const SPECS: Record<JudgeTrack, TrackSpec> = {
  public: PUBLIC_SPEC,
  corporate: CORPORATE_SPEC,
  theme: THEME_SPEC,
};

export const DEFAULT_TRACK: JudgeTrack = "public";

export function trackSpec(track: JudgeTrack): TrackSpec {
  return SPECS[track];
}

export function allTrackSpecs(): TrackSpec[] {
  return [PUBLIC_SPEC, CORPORATE_SPEC, THEME_SPEC];
}

/** 요청·기록에서 읽은 트랙 문자열 — 모르는 값은 기관용(예전 기본값) */
export function toJudgeTrack(raw: unknown): JudgeTrack {
  return isJudgeTrack(raw) ? raw : DEFAULT_TRACK;
}

/**
 * 주제 맞춤 채점 기준 버전 — 결과서(payload.rubric_version)에 남긴다. 프롬프트(DOMAIN1_THEME)를 고치면 올린다.
 * 심사 기록에 남겨, 같은 주제 맞춤이라도 기준을 고치기 전 점수와 견주지 않게 한다.
 * 1 = 첫 기준(버전 표시 없음) · 2 = 점수 보정(2026-11-24, 한남대 전원 95점)
 */
export const THEME_RUBRIC_VERSION = 2;

/** 주제(키워드) 최대 길이 — "스포츠테크", "스마트 헬스케어", "지역 관광 콘텐츠" 정도 */
export const JUDGE_THEME_MAX = 30;

/**
 * 주제(키워드) 정리 — 채점 프롬프트에 그대로 들어가므로 한 줄·짧게·글자만 남긴다.
 * 누구나 입력할 수 있는 칸이라, 줄바꿈·기호로 프롬프트 지시문 모양이 되지 않게 막아 둔다.
 */
export function cleanJudgeTheme(raw: unknown):
  { ok: true; theme: string } | { ok: false; error: string } {
  const theme = String(raw ?? "")
    .replace(/[^\p{L}\p{N} ·,&+\/()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!theme) return { ok: false, error: "심사 주제(키워드)를 입력해 주세요. 예: 스포츠테크" };
  if (theme.length > JUDGE_THEME_MAX) return { ok: false, error: `심사 주제는 ${JUDGE_THEME_MAX}자 이내로 입력해 주세요.` };
  return { ok: true, theme };
}

/** 화면·결과서에 쓰는 기준 이름 — 주제 맞춤이면 주제를 붙인다: "주제 맞춤(스포츠테크)" */
export function trackDisplayLabel(track: JudgeTrack, theme?: string | null): string {
  const label = SPECS[track].label;
  return track === "theme" && theme ? `${label}(${theme})` : label;
}


/** 해당 트랙이 채점하는 분야1 세부 항목 키 (프롬프트 필드 순서와 일치) */
export function domain1Keys(track: JudgeTrack): Domain1Key[] {
  return Object.keys(SPECS[track].domain1Fields) as Domain1Key[];
}

export const PUBLIC_KEYS = Object.keys(PUBLIC_SECTOR_FIELDS) as PublicSectorKey[];
export const CORPORATE_KEYS = Object.keys(CORPORATE_FIELDS) as CorporateKey[];
export const THEME_KEYS = Object.keys(THEME_FIELDS) as ThemeKey[];
