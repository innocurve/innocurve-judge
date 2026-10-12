// 심사 결과서 PDF (A4) — @react-pdf/renderer 문서. 화면 결과서와 같은 내용을 공문서 서식으로 옮긴다.
// 이 모듈은 PDF 받기 버튼을 누를 때만 동적으로 불러온다(초기 번들에 포함하지 않음).
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { NO_SIGNIFICANT_RISKS } from "@/judge/riskBuilder";
import { MODE_BADGES, scoreTone, type ApiEvaluation } from "../types";

const COLORS = {
  paper: "#f7f7f3",
  ink: "#1c2431",
  inkSoft: "#55607a",
  line: "#d9dbd2",
  seal: "#c0392b",
  sealSoft: "#f6e4e1",
  verdant: "#2f6b5e",
  verdantSoft: "#e3efeb",
  caution: "#7d5610",
  cautionSoft: "#f5ecd8",
} as const;

const TONE_COLOR = { verdant: COLORS.verdant, caution: COLORS.caution, seal: COLORS.seal };

let fontsRegistered = false;

/** 한글 글꼴 등록 — 브라우저에서 같은 출처의 /fonts/*.ttf를 읽는다 */
export function registerPdfFonts(origin: string) {
  if (fontsRegistered) return;
  Font.register({
    family: "Pretendard",
    fonts: [
      { src: `${origin}/fonts/Pretendard-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/Pretendard-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // 한글 줄바꿈은 공백 단위로만 — 음절 중간에서 끊지 않는다.
  // 공백 없이 긴 토큰(URL·파일 경로)만 글자 단위로 쪼개 넘침을 막는다.
  Font.registerHyphenationCallback((word) =>
    word.length > 28 ? Array.from(word) : [word],
  );
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 9.5,
    lineHeight: 1.55,
    color: COLORS.ink,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.ink,
    paddingBottom: 10,
    marginBottom: 14,
  },
  eyebrow: { fontSize: 8, color: COLORS.inkSoft, letterSpacing: 2 },
  title: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginTop: 2, marginBottom: 4 },
  meta: { fontSize: 8.5, color: COLORS.inkSoft, marginTop: 2 },
  mono: { fontSize: 8.5 },
  notice: { borderWidth: 1, padding: 8, marginBottom: 12 },
  noticeTitle: { fontWeight: 700 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  badge: { fontSize: 7.5, fontWeight: 700, paddingHorizontal: 4, paddingVertical: 1 },
  totalScore: { fontSize: 40, fontWeight: 700, lineHeight: 1.2, marginTop: 2 },
  totalSuffix: { fontSize: 12, color: COLORS.inkSoft, fontWeight: 400 },
  stamp: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: COLORS.seal,
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.seal,
  },
  domainRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  domainCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.paper,
    padding: 8,
  },
  domainTitle: { fontSize: 9, fontWeight: 700 },
  domainScore: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  table: { borderTopWidth: 1, borderTopColor: COLORS.ink },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.line,
    paddingVertical: 4,
  },
  th: { fontWeight: 700, fontSize: 8.5, color: COLORS.inkSoft },
  colDomain: { width: "24%", paddingRight: 4 },
  colLabel: { width: "30%", paddingRight: 4 },
  colScore: { width: "12%", textAlign: "right", paddingRight: 8 },
  colSamples: { width: "22%" },
  colRange: { width: "12%", textAlign: "right" },
  listItem: {
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 6,
    marginBottom: 4,
  },
  listIndex: { width: 10, fontSize: 8, color: COLORS.seal },
  listText: { flex: 1 },
  verdict: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.ink,
    backgroundColor: COLORS.paper,
    padding: 10,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  // 꼬리말은 절대 위치 Text로 둔다 — 절대 위치 View로 묶으면 렌더링되지 않는다
  footerText: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: COLORS.inkSoft,
    borderTopWidth: 0.75,
    borderTopColor: COLORS.line,
    paddingTop: 5,
  },
});

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const BADGE_COLORS: Record<string, { color: string; backgroundColor: string }> = {
  full: { color: COLORS.verdant, backgroundColor: COLORS.verdantSoft },
  partial: { color: COLORS.caution, backgroundColor: COLORS.cautionSoft },
  full_zero: { color: COLORS.seal, backgroundColor: COLORS.sealSoft },
  fatal_zero: { color: COLORS.seal, backgroundColor: COLORS.sealSoft },
};

function toneColor(score: number) {
  return TONE_COLOR[scoreTone(score)];
}

function DocLine({ label, path }: { label: string; path: string | null | undefined }) {
  return (
    <Text style={styles.meta}>
      {label}:{" "}
      {path ? (
        <Text style={styles.mono}>{path}</Text>
      ) : (
        <Text style={{ color: COLORS.seal }}>레포에서 발견되지 않음</Text>
      )}
    </Text>
  );
}

function MissingDocs({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  const allMissing = missing.length >= 2;
  const tone = allMissing
    ? { borderColor: COLORS.seal, backgroundColor: COLORS.sealSoft, color: COLORS.seal }
    : { borderColor: COLORS.caution, backgroundColor: COLORS.cautionSoft, color: COLORS.caution };
  return (
    <View style={[styles.notice, tone]}>
      <Text style={styles.noticeTitle}>누락된 파일: {missing.join(", ")}</Text>
      <Text>
        {allMissing
          ? "레포에서 기획 문서를 찾지 못해 두 분야 모두 0점 처리했습니다."
          : "있는 문서만으로 채점했습니다. 빠진 문서를 함께 올리면 채점 근거가 더 충실해집니다."}
      </Text>
    </View>
  );
}

export function ResultPdf({ result }: { result: ApiEvaluation }) {
  const badge = MODE_BADGES[result.evaluation_mode];
  const repo = result.repo;
  const evaluatedAt = result.evaluated_at ? new Date(result.evaluated_at) : new Date();
  const noRisks = result.risks.length === 1 && result.risks[0] === NO_SIGNIFICANT_RISKS;
  const showSpread = result.ensemble.n > 1;

  const domains = [
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

  return (
    <Document
      title={`심사 결과서 — ${repo?.url.replace("https://github.com/", "") ?? "AI 심사위원"}`}
      author="AI 심사위원"
      language="ko"
    >
      <Page size="A4" style={styles.page}>
        {/* 꼬리말 — fixed라 모든 쪽에 반복된다. 쪽 번호(render)는 이 글꼴에서 표시되지 않아 넣지 않는다 */}
        <Text style={styles.footerText} fixed>
          AI 심사위원 · 점수는 참고용이며 최종 심사를 대신하지 않습니다.
        </Text>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI 심사위원 · 바이브 코딩 검증</Text>
          <Text style={styles.title}>심사 결과서</Text>
          {repo && (
            <Text style={styles.meta}>
              레포: <Text style={styles.mono}>{repo.url}</Text> @ {repo.branch} · 파일{" "}
              {repo.files.length}개 수집
            </Text>
          )}
          {repo && <DocLine label="PRD" path={repo.prd_path} />}
          {repo && <DocLine label="기획서(PLAN)" path={repo.plan_path} />}
          <Text style={styles.meta}>
            심사 일시: {DATE_FORMAT.format(evaluatedAt)} · {result.ensemble.model} · 항목당{" "}
            {result.ensemble.n}회 채점
            {result.ensemble.fallback_used ? " · 예비 모델 사용" : ""}
          </Text>
        </View>

        <MissingDocs missing={repo?.missing_docs ?? []} />

        <View style={styles.heroRow}>
          <View>
            <View style={styles.badgeRow}>
              <Text style={styles.eyebrow}>종합 점수</Text>
              <Text style={[styles.badge, { borderWidth: 1, borderColor: COLORS.ink }]}>
                {result.track_label}
              </Text>
              <Text style={[styles.badge, BADGE_COLORS[result.evaluation_mode]]}>
                {badge.label}
              </Text>
            </View>
            <Text style={styles.totalScore}>
              {result.total_score}
              <Text style={styles.totalSuffix}> / 100</Text>
            </Text>
          </View>
          <View style={styles.stamp}>
            <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, lineHeight: 1.2 }}>
              심사필
            </Text>
            <Text style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
              {result.total_score}
            </Text>
            <Text style={{ fontSize: 6, lineHeight: 1.2 }}>AI 심사위원</Text>
          </View>
        </View>

        <View style={styles.domainRow}>
          {domains.map((domain) => (
            <View key={domain.title} style={styles.domainCard}>
              <Text style={styles.domainTitle}>{domain.title}</Text>
              <Text
                style={[
                  styles.domainScore,
                  { color: domain.skipped ? COLORS.seal : toneColor(domain.score) },
                ]}
              >
                {domain.skipped ? 0 : domain.score}
              </Text>
              {domain.skipped && (
                <>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: COLORS.seal }}>
                    분야 부적격
                  </Text>
                  {domain.reasons.slice(0, 2).map((reason) => (
                    <Text key={reason} style={{ fontSize: 8, color: COLORS.inkSoft }}>
                      {reason}
                    </Text>
                  ))}
                </>
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>세부 채점표</Text>
        {showSpread && (
          <Text style={{ fontSize: 8, color: COLORS.inkSoft, marginBottom: 4 }}>
            각 항목을 {result.ensemble.n}회 채점해 중앙값을 기록했습니다. 「불안정」은
            채점 간 편차가 큰 항목입니다.
          </Text>
        )}
        <View style={styles.table}>
          <View style={styles.tr} fixed>
            <Text style={[styles.th, styles.colDomain]}>분야</Text>
            <Text style={[styles.th, styles.colLabel]}>세부 항목</Text>
            <Text style={[styles.th, styles.colScore]}>점수</Text>
            <Text style={[styles.th, styles.colSamples]}>{showSpread ? "채점 표본" : ""}</Text>
            <Text style={[styles.th, styles.colRange]}>{showSpread ? "점수 폭" : ""}</Text>
          </View>
          {result.criteria.map((item) => (
            <View key={item.key} style={styles.tr} wrap={false}>
              <Text style={styles.colDomain}>{item.domain}</Text>
              <Text style={styles.colLabel}>{item.label}</Text>
              <Text style={[styles.colScore, { fontWeight: 700, color: toneColor(item.score) }]}>
                {item.score}
              </Text>
              <Text style={[styles.colSamples, { color: COLORS.inkSoft }]}>
                {showSpread ? item.samples.join(" · ") : ""}
              </Text>
              <Text style={[styles.colRange, { color: item.unstable ? COLORS.caution : COLORS.inkSoft }]}>
                {showSpread ? `${item.range}${item.unstable ? " 불안정" : ""}` : ""}
              </Text>
            </View>
          ))}
        </View>

        {result.strengths.length > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>잘한 점</Text>
            {result.strengths.map((item, index) => (
              <View key={`${index}-${item}`} style={[styles.listItem, { backgroundColor: COLORS.verdantSoft }]}>
                <Text style={[styles.listIndex, { color: COLORS.verdant }]}>{index + 1}</Text>
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        <View>
          <Text style={styles.sectionTitle} minPresenceAhead={60}>
            감점 요인
          </Text>
          {noRisks ? (
            <View style={[styles.listItem, { backgroundColor: COLORS.verdantSoft }]}>
              <Text style={[styles.listText, { color: COLORS.verdant }]}>{result.risks[0]}</Text>
            </View>
          ) : (
            result.risks.map((risk, index) => (
              <View key={`${index}-${risk}`} style={styles.listItem} wrap={false}>
                <Text style={styles.listIndex}>{index + 1}</Text>
                <Text style={styles.listText}>{risk}</Text>
              </View>
            ))
          )}
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>심사위원 총평</Text>
          <Text style={styles.verdict}>{result.final_verdict}</Text>
        </View>

      </Page>
    </Document>
  );
}
