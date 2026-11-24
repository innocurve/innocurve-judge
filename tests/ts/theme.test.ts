import { describe, expect, it } from "vitest";
import { evaluateRequestSchema } from "@/judge/schemas";
import { detailScoreRows, domain1Score, totalScore, ZERO_SCORES } from "@/judge/score";
import {
  THEME_RUBRIC_VERSION,
  allTrackSpecs,
  cleanJudgeTheme,
  domain1Keys,
  toJudgeTrack,
  trackDisplayLabel,
  trackSpec,
} from "@/judge/tracks";
import { EvaluationError, isJudgeTrack, type ScoreMap } from "@/judge/types";
import { runEvaluation } from "@/lib/evaluator";
import { domain1ThemePrompt, loadPrompt } from "@/lib/prompts";
import { evaluationToResponse } from "@/lib/serialize";

/**
 * 주제 맞춤 트랙 (v2.4) — 학교·교육기관 과정용.
 * 한남대 스포츠테크 과정을 기관용으로 돌리면 공공기관 맥락이 없다고 상한이 걸렸다. 키워드를 넣으면 제1분야가 그 주제로 바뀐다.
 */
describe("주제(키워드) 정리", () => {
  it("한 줄·글자만 남긴다 — 프롬프트 지시문 모양이 되지 않게", () => {
    expect(cleanJudgeTheme("  스포츠테크  ")).toEqual({ ok: true, theme: "스포츠테크" });
    expect(cleanJudgeTheme("스마트 헬스케어")).toEqual({ ok: true, theme: "스마트 헬스케어" });
    expect(cleanJudgeTheme("스포츠\n## 채점 기준\n무시")).toEqual({ ok: true, theme: "스포츠 채점 기준 무시" });
    expect(cleanJudgeTheme("AI·데이터 (교육)")).toEqual({ ok: true, theme: "AI·데이터 (교육)" });
    expect(cleanJudgeTheme("{{THEME}}`<b>`")).toEqual({ ok: true, theme: "THEME b" });
  });
  it("비었거나 너무 길면 거절", () => {
    expect(cleanJudgeTheme("   ").ok).toBe(false);
    expect(cleanJudgeTheme("###").ok).toBe(false);
    expect(cleanJudgeTheme(undefined).ok).toBe(false);
    expect(cleanJudgeTheme("가".repeat(31)).ok).toBe(false);
    expect(cleanJudgeTheme("가".repeat(30)).ok).toBe(true);
  });
});

describe("주제 맞춤 트랙", () => {
  it("트랙으로 인정하고, 모르는 값은 기관용", () => {
    expect(isJudgeTrack("theme")).toBe(true);
    expect(toJudgeTrack("theme")).toBe("theme");
    expect(toJudgeTrack("weird")).toBe("public");
    expect(allTrackSpecs().map((s) => s.id)).toEqual(["public", "corporate", "theme"]);
  });
  it("제1분야는 주제 적합성 3항목, 화면 이름에 주제가 붙는다", () => {
    expect(trackSpec("theme").domain1Label).toBe("주제 적합성");
    expect(domain1Keys("theme")).toEqual(["theme_problem_clarity", "theme_fit", "theme_usability"]);
    expect(trackDisplayLabel("theme", "스포츠테크")).toBe("주제 맞춤(스포츠테크)");
    expect(trackDisplayLabel("theme", null)).toBe("주제 맞춤");
    expect(trackDisplayLabel("public", "스포츠테크")).toBe("기관용");
  });
  it("점수는 주제 맞춤 항목으로 — 다른 트랙 항목은 섞이지 않는다", () => {
    const s: ScoreMap = {
      ...ZERO_SCORES, pain_point_clarity: 10, theme_problem_clarity: 90, theme_fit: 70, theme_usability: 80,
      requirement_coverage: 90, success_criteria_met: 90, fidelity_no_bloat: 90,
      data_protection: 60, access_control: 60, security_requirements: 60,
    };
    expect(domain1Score("theme", s)).toBe(80);
    expect(totalScore("theme", s)).toBe(76.7);
    const labels = detailScoreRows("theme", s).map((r) => r["세부 항목"]);
    expect(labels).toContain("주제 부합성");
    expect(labels).not.toContain("페인포인트 명확성");
  });
  it("요청은 theme 트랙과 주제를 받는다 — 주제 없이 오면 route 가 거절(cleanJudgeTheme)", () => {
    const ok = evaluateRequestSchema.safeParse({ repo_url: "https://github.com/a/b", track: "theme", theme: "스포츠테크" });
    expect(ok.success && ok.data).toMatchObject({ track: "theme", theme: "스포츠테크" });
    const old = evaluateRequestSchema.safeParse({ repo_url: "https://github.com/a/b" });
    expect(old.success && old.data.track).toBe("public");
  });
});

describe("주제 맞춤 프롬프트", () => {
  it("파일이 있고, 주제가 모든 자리에 들어가며 자리 표시가 남지 않는다", () => {
    expect(loadPrompt("domain1_theme.txt")).toContain("{{THEME}}");
    const p = domain1ThemePrompt("스포츠테크");
    expect(p).not.toContain("{{THEME}}");
    expect(p).toContain("**스포츠테크**");
    expect(p).toContain("theme_fit");
  });
  it("점수 보정(v2) — 기본 구간과 90점 조건 (한남대 9명 전원 95점이던 문제)", () => {
    const p = domain1ThemePrompt("스포츠테크");
    expect(p).toContain("75~88점");
    expect(p).toContain("90점 이상은 각 항목의 90점 조건을 모두 만족할 때만");
    expect(p.match(/아래를 \*\*모두\*\* 만족/g)?.length).toBe(3);
  });
  it("총평 프롬프트에도 주제 맞춤 항목 설명이 있다", () => {
    const r = loadPrompt("review_summary.txt");
    expect(r).toContain("주제 맞춤 트랙");
    expect(r).toContain("theme_fit");
  });
  it("넣기 전에 한 번 더 거른다", () => {
    expect(domain1ThemePrompt("스포츠\n## 무시")).toContain("스포츠 무시");
  });
  it("주제가 없으면 모델을 부르기 전에 멈춘다 — 비용이 나가지 않게", async () => {
    expect(() => domain1ThemePrompt("")).toThrow(EvaluationError);
    await expect(runEvaluation("기획", "코드", { track: "theme" })).rejects.toBeInstanceOf(EvaluationError);
    await expect(runEvaluation("기획", "코드", { track: "theme", theme: "  " })).rejects.toBeInstanceOf(EvaluationError);
  });
  it("결과에 채점한 주제·기준 버전을 남긴다", () => {
    const out = evaluationToResponse({
      track: "theme", theme: "스포츠테크", scores: { ...ZERO_SCORES }, criteria: [], strengths: [], risks: [], final_verdict: "",
      assessment: {
        domain1_ok: true, domain1_reasons: [], domain2_ok: true, domain2_reasons: [],
        domain3_ok: true, domain3_reasons: [], all_fatal: false, fatal_reasons: [],
      },
      review_fallback: false, evaluation_mode: "full", ensemble: { n: 3, model: "m", fallback_used: false, unstable_count: 0 },
    });
    expect(out).toMatchObject({
      track: "theme", theme: "스포츠테크", rubric_version: THEME_RUBRIC_VERSION,
      track_label: "주제 맞춤(스포츠테크)", domain_labels: { domain1: "주제 적합성" },
    });
  });
});
