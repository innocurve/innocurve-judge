// Design Ref: §2.3 — 기존 프롬프트 자산 로드 (prompts/ 경로 불변)
import { readFileSync } from "node:fs";
import path from "node:path";
import { EvaluationError } from "@/judge/types";
import { cleanJudgeTheme } from "@/judge/tracks";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

const cache = new Map<string, string>();

function readCached(filePath: string, label: string): string {
  const hit = cache.get(filePath);
  if (hit !== undefined) return hit;
  let text: string;
  try {
    text = readFileSync(filePath, "utf-8");
  } catch {
    throw new EvaluationError(`${label} 파일을 찾을 수 없습니다: ${filePath}`);
  }
  cache.set(filePath, text);
  return text;
}

export function loadPrompt(filename: string): string {
  return readCached(path.join(PROMPTS_DIR, filename), "프롬프트");
}

/**
 * 주제 맞춤 제1분야 프롬프트 — prompts/domain1_theme.txt 의 {{THEME}} 에 주제(키워드)를 넣는다.
 * 키워드는 cleanJudgeTheme 를 거친 값이어야 한다 (한 줄·글자만) — 여기서도 한 번 더 거른다.
 */
export function domain1ThemePrompt(theme: string): string {
  const safe = cleanJudgeTheme(theme);
  if (!safe.ok) throw new EvaluationError("심사 주제(키워드)가 정해지지 않았습니다. 주제를 입력한 뒤 다시 심사해 주세요.");
  return loadPrompt("domain1_theme.txt").replaceAll("{{THEME}}", safe.theme);
}
