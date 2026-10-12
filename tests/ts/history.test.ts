// 최근 심사 기록 — 100건 유지·밀려난 본문 삭제·조회. 실제 저장소 대신 메모리 Redis로 검증
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const lists = new Map<string, string[]>();

class FakeRedis {
  multi() {
    const ops: Array<() => unknown> = [];
    const tx = {
      set: (key: string, value: string) => ops.push(() => store.set(key, value)),
      lpush: (key: string, value: string) =>
        ops.push(() => lists.set(key, [value, ...(lists.get(key) ?? [])])),
      lrange: (key: string, start: number, stop: number) =>
        ops.push(() => this.range(key, start, stop)),
      ltrim: (key: string, start: number, stop: number) =>
        ops.push(() => lists.set(key, this.range(key, start, stop))),
      exec: async () => ops.map((op) => op()),
    };
    return tx;
  }
  private range(key: string, start: number, stop: number) {
    const list = lists.get(key) ?? [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async lrange(key: string, start: number, stop: number) {
    return this.range(key, start, stop);
  }
  async get(key: string) {
    return store.get(key) ?? null;
  }
  async del(...keys: string[]) {
    for (const key of keys) store.delete(key);
  }
}

vi.mock("@upstash/redis", () => ({ Redis: FakeRedis }));

async function loadHistory() {
  vi.resetModules();
  return import("@/lib/history");
}

function sampleResult(score: number) {
  return {
    track: "public",
    track_label: "기관용",
    total_score: score,
    evaluation_mode: "full",
    repo: { url: `https://github.com/demo/r${score}`, missing_docs: ["PRD.md"] },
  };
}

beforeEach(() => {
  store.clear();
  lists.clear();
  process.env.KV_REST_API_URL = "https://example.upstash.io";
  process.env.KV_REST_API_TOKEN = "token";
});

describe("심사 기록 저장", () => {
  it("저장소 미연결이면 저장·조회를 건너뛴다", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const history = await loadHistory();
    expect(history.isHistoryEnabled()).toBe(false);
    expect(await history.saveEvaluation(sampleResult(50))).toBeNull();
    expect(await history.listEvaluations()).toBeNull();
  });

  it("저장한 결과를 id로 다시 읽고, 요약에 누락 파일이 담긴다", async () => {
    const history = await loadHistory();
    const saved = await history.saveEvaluation(sampleResult(77));
    expect(saved).not.toBeNull();
    const full = await history.getEvaluation(saved!.id);
    expect(full?.total_score).toBe(77);
    expect(full?.history_id).toBe(saved!.id);
    const [summary] = (await history.listEvaluations())!;
    expect(summary.missing_docs).toEqual(["PRD.md"]);
    expect(summary.repo_url).toBe("https://github.com/demo/r77");
  });

  it("최신 100건만 남기고 밀려난 기록의 본문도 지운다", async () => {
    const history = await loadHistory();
    const ids: string[] = [];
    for (let i = 0; i < 103; i += 1) {
      ids.push((await history.saveEvaluation(sampleResult(i)))!.id);
    }
    const items = (await history.listEvaluations())!;
    expect(items).toHaveLength(100);
    expect(items[0].total_score).toBe(102); // 최신순
    expect(items.at(-1)!.total_score).toBe(3);
    for (const oldId of ids.slice(0, 3)) {
      expect(await history.getEvaluation(oldId)).toBeNull();
    }
    expect(await history.getEvaluation(ids[3])).not.toBeNull();
    expect(store.size).toBe(100);
  });

  it("형식이 잘못된 id는 조회하지 않는다", async () => {
    const history = await loadHistory();
    expect(history.isValidHistoryId("../etc")).toBe(false);
    expect(await history.getEvaluation("../etc")).toBeNull();
  });
});
