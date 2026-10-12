// 최근 심사 기록 저장소 — Upstash Redis(Vercel Marketplace). 최신 100건만 유지한다.
// 구조: judge:recent(리스트, 요약 JSON, 최신이 앞) + judge:result:{id}(문자열, 결과 전체 JSON)
// 저장소가 연결되지 않은 환경에서는 저장·조회를 모두 건너뛰고 심사는 그대로 동작한다.
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export const HISTORY_LIMIT = 100;

const LIST_KEY = "judge:recent";
const resultKey = (id: string) => `judge:result:${id}`;

/** 목록 화면용 요약 — 결과 전체를 읽지 않고 표를 그릴 수 있게 필요한 값만 둔다 */
export interface HistorySummary {
  id: string;
  evaluated_at: string;
  repo_url: string;
  track: string;
  track_label: string;
  total_score: number;
  evaluation_mode: string;
  missing_docs: string[];
}

let client: Redis | null | undefined;

function getRedis(): Redis | null {
  if (client !== undefined) return client;
  // Vercel Marketplace 연동은 KV_REST_API_*, Upstash 콘솔 직접 발급은 UPSTASH_REDIS_REST_*
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export function isHistoryEnabled(): boolean {
  return getRedis() !== null;
}

const ID_PATTERN = /^[0-9a-f-]{36}$/;

export function isValidHistoryId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/**
 * 심사 결과를 저장하고 부여한 id·시각을 돌려준다. 저장소 미연결이면 null.
 * 101번째 이후로 밀려난 기록은 목록과 본문을 함께 지운다.
 */
export async function saveEvaluation(
  result: Record<string, unknown>,
): Promise<{ id: string; evaluated_at: string } | null> {
  const redis = getRedis();
  if (!redis) return null;

  const id = randomUUID();
  const evaluatedAt = new Date().toISOString();
  const repo = result.repo as { url?: string; missing_docs?: string[] } | undefined;
  const summary: HistorySummary = {
    id,
    evaluated_at: evaluatedAt,
    repo_url: repo?.url ?? "",
    track: String(result.track ?? ""),
    track_label: String(result.track_label ?? ""),
    total_score: Number(result.total_score ?? 0),
    evaluation_mode: String(result.evaluation_mode ?? ""),
    missing_docs: repo?.missing_docs ?? [],
  };

  const stored = { ...result, history_id: id, evaluated_at: evaluatedAt };
  const tx = redis.multi();
  tx.set(resultKey(id), JSON.stringify(stored));
  tx.lpush(LIST_KEY, JSON.stringify(summary));
  tx.lrange(LIST_KEY, HISTORY_LIMIT, -1);
  tx.ltrim(LIST_KEY, 0, HISTORY_LIMIT - 1);
  const replies = await tx.exec();

  const overflow = (replies[2] as unknown[] | null) ?? [];
  const staleIds = overflow
    .map((item) => parseSummary(item)?.id)
    .filter((staleId): staleId is string => Boolean(staleId));
  if (staleIds.length > 0) await redis.del(...staleIds.map(resultKey));

  return { id, evaluated_at: evaluatedAt };
}

// @upstash/redis는 JSON 문자열을 자동으로 객체로 풀어 줄 때가 있어 두 형태를 모두 받는다
function parseSummary(item: unknown): HistorySummary | null {
  try {
    const value = typeof item === "string" ? JSON.parse(item) : item;
    if (value && typeof value === "object" && "id" in value) return value as HistorySummary;
  } catch {
    // 손상된 항목은 목록에서 제외
  }
  return null;
}

/** 최근 기록 요약 (최신순, 최대 100건). 저장소 미연결이면 null */
export async function listEvaluations(): Promise<HistorySummary[] | null> {
  const redis = getRedis();
  if (!redis) return null;
  const items = await redis.lrange(LIST_KEY, 0, HISTORY_LIMIT - 1);
  return items.map(parseSummary).filter((item): item is HistorySummary => item !== null);
}

/** 저장된 결과 전체. 없거나 100건 밖으로 밀려났으면 null */
export async function getEvaluation(id: string): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  if (!redis || !isValidHistoryId(id)) return null;
  const raw = await redis.get<unknown>(resultKey(id));
  if (raw === null || raw === undefined) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
}
