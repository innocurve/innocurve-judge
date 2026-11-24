"use client";

import { allTrackSpecs, JUDGE_THEME_MAX } from "@/judge/tracks";
import type { JudgeTrack } from "@/components/result/types";

// 트랙 정의는 judge/tracks.ts 한 곳에서만 관리한다 (설명 문구 중복 방지)
const TRACK_OPTIONS = allTrackSpecs().map((spec) => ({
  id: spec.id,
  label: spec.label,
  summary: spec.description,
}));

interface TrackSelectorProps {
  value: JudgeTrack;
  onChange: (value: JudgeTrack) => void;
  /** 주제 맞춤의 주제(키워드) — 주제 맞춤을 골랐을 때만 입력 칸이 보인다 */
  theme: string;
  onThemeChange: (value: string) => void;
  disabled: boolean;
}

/** 심사 트랙 선택 — 분야1(기획 평가) 기준이 트랙별로 달라집니다 */
export function TrackSelector({ value, onChange, theme, onThemeChange, disabled }: TrackSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-bold">심사 트랙</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRACK_OPTIONS.map((option) => {
          const selected = option.id === value;
          return (
            <label
              key={option.id}
              className={`flex cursor-pointer flex-col gap-1 border p-3 transition-colors ${
                selected
                  ? "border-ink bg-paper"
                  : "border-line bg-sheet hover:border-line-strong"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="judge-track"
                  value={option.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(option.id)}
                  className="accent-ink"
                />
                <span className="text-sm font-bold">{option.label}</span>
              </span>
              <span className="text-xs leading-relaxed text-ink-soft">{option.summary}</span>
            </label>
          );
        })}
      </div>
      {/* 주제 맞춤 — 학교·교육기관 과정처럼 공공 업무도 사내 업무도 아닌 경우. 키워드를 넣으면 제1분야가 그 주제로 바뀐다 */}
      {value === "theme" && (
        <label className="mt-1 flex flex-col gap-1">
          <span className="text-sm font-bold">심사 주제(키워드)</span>
          <input
            type="text"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value)}
            maxLength={JUDGE_THEME_MAX}
            required
            disabled={disabled}
            placeholder="예: 스포츠테크"
            className="border border-line bg-sheet px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <span className="text-xs leading-relaxed text-ink-soft">
            입력한 주제에 맞춰 제1분야(주제 적합성)를 채점합니다. 예: 스포츠테크, 스마트 헬스케어, 지역 관광.
          </span>
        </label>
      )}
      <p className="text-xs text-ink-soft">
        트랙마다 채점 기준이 달라 점수를 서로 비교할 수 없습니다. 주제 맞춤은 주제가 다르면
        비교할 수 없습니다. 의도 구현도·보안 적합성 분야는 공통입니다.
      </p>
    </fieldset>
  );
}
