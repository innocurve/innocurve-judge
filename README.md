# AI 심사위원

기관·기업 바이브 코딩 검증용 Next.js 풀스택 앱입니다.
**공개 GitHub 레포 URL**만 입력하면 레포에서 기획 문서(`PRD.md`·`PLAN.md`)와 코드를
수집해 2개 분야 6개 항목 점수표와 평가 후기(심사 결과서)를 발급합니다.
심사는 **기관용·기업용** 두 트랙으로 나뉘며 접수 시 선택합니다.

- 기획 문서는 `PRD.md`와 `PLAN.md`(또는 `기획서.md`) **둘 중 하나만 있어도** 심사합니다.
  빠진 파일은 결과서에 **「누락된 파일: PRD.md」** 처럼 알려 주며, 감점은 없습니다.
  둘 다 없으면 두 분야 모두 부적격(0점) 처리됩니다.
- 결과서는 **PDF로 받을 수 있습니다** (A4, 한글 글꼴 내장, 텍스트 선택 가능).
- **최근 심사 100건**을 저장해 `/history`에서 다시 보고 PDF로 받을 수 있습니다.

## 심사 트랙과 분야

제1분야는 트랙마다 기준이 다르고, 제2분야는 두 트랙 공통입니다.

| 트랙 | 제1분야 | 세부 항목 |
|------|---------|-----------|
| 기관용 | 공공기관 적합성 | 페인포인트 명확성 · 해결 방향 적절성 · 공공 현장 적용 가능성 |
| 기업용 | 사업 타당성 | 문제·비용 구체성 · 자체 구축 정당성 · 도입·운영 현실성 |

| 공통 분야 | 평가 대상 |
|-----------|-----------|
| 의도 구현도 | 기획서 ↔ 실행 코드 — 핵심 요구사항 구현 · 성공 기준 충족 · 기획 의도 일치 |

종합 점수는 두 분야 점수의 평균입니다.
**두 트랙은 채점 기준이 다르므로 점수를 서로 비교할 수 없습니다.**
트랙 정의는 `src/judge/tracks.ts` 한 곳에 모여 있습니다.

## 채점 방식

- **앙상블 채점**: 분야별로 N회(기본 3) 병렬 채점 후 세부 항목별 **중앙값**을 최종 점수로 기록합니다.
  반복 간 편차가 큰 항목에는 **판정 불안정** 표식이 붙습니다.
- **모델 이중화**: 채점 모델이 실패하면 폴백 모델로 자동 전환합니다.
- **부적격 분야 0점**: 무의미한 입력·주제 불일치 제출물은 해당 분야만 0점 처리하고 사유를 명시합니다.
- **Pass/Fail 없음** — 점수만 제공합니다.

## 사전 준비

- Node.js 22+
- OpenAI API 키

## 설치 및 실행

```powershell
cd "c:\Users\menta\Desktop\심사위원 챗봇"
npm install
copy .env.example .env
# .env에 OPENAI_API_KEY 설정
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build && npm run start   # 프로덕션
npm test           # 단위 테스트 (Vitest)
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OPENAI_API_KEY` | (필수) | 채점·후기·나레이션·TTS 호출 |
| `KV_REST_API_URL` · `KV_REST_API_TOKEN` | (선택) | 심사 기록 저장소(Upstash Redis). Vercel Marketplace 연결 시 자동 등록. 없으면 기록 저장만 꺼짐 |
| `GITHUB_TOKEN` | (선택) | GitHub API 한도 완화 (공개 레포 읽기용) |
| `JUDGE_MODEL` | `gpt-5-mini` | 채점 모델 |
| `JUDGE_FALLBACK_MODEL` | `gpt-5.6-luna` | 채점 실패 시 폴백 모델 |
| `NARRATION_MODEL` | `gpt-5.6-luna` | 음성 대본 생성 모델 |
| `TTS_MODEL` | `gpt-4o-mini-tts` | 음성 합성 모델 |
| `JUDGE_ENSEMBLE_N` | `3` | 앙상블 반복 수 (1이면 비활성) |
| `JUDGE_RANGE_THRESHOLD` | `15` | 판정 불안정 플래그 편차 기준 |

## 프로젝트 구조

```
심사위원 챗봇/
├── app/                    # Next.js 페이지(홈·심사 접수·심사 기록·채점 기준) + API Route Handlers
│   └── api/                #   /api/health, /api/evaluate(NDJSON 스트림), /api/narration, /api/tts
├── src/judge/              # 순수 채점 도메인 — 입력 검증·앙상블 집계·감점 합성·점수 산출
├── src/lib/                # 인프라 — OpenAI(폴백)·GitHub 수집·오케스트레이터·설정·심사 기록(history.ts)
├── src/components/         # UI 컴포넌트 (심사 접수·심사 결과서·결과서 PDF)
├── public/fonts/           # 결과서 PDF용 Pretendard 글꼴 (OFL)
├── prompts/                # 분야별 심사 프롬프트
├── tests/ts/               # Vitest 단위 테스트
└── examples/               # 채점 예시 세트 (트랙별 고득점·저득점)
```

## API

- `POST /api/evaluate` — `{ repo_url, track }` 입력(`track`은 `public`|`corporate`,
  생략 시 `public`), **NDJSON 스트림**으로 진행 단계
  (수집→검증→채점→집계→후기)와 최종 결과를 반환합니다. 기획 문서(PRD·PLAN)는 레포에서
  자동 수집하며 `repo.missing_docs`에 찾지 못한 파일명을 담습니다. 기록 저장소가 연결돼
  있으면 결과를 저장하고 `history_id`·`evaluated_at`을 함께 돌려줍니다.
- 페이지 `/history` — 최근 100건 목록, `/history/{id}` — 저장된 결과서(PDF 받기 포함).
- `POST /api/narration` — 점수 요약을 음성 대본 2구간으로 변환합니다.
- `POST /api/tts` — 대본을 mp3로 합성합니다 (실패 시 501, 화면에는 대본 텍스트 표시).
- `GET /api/health` — 키 설정 여부·모델 구성을 반환합니다.

## 배포

Vercel (`vercel.json` — Next.js 프리셋). 환경변수 `OPENAI_API_KEY`, `GITHUB_TOKEN`을
Vercel 프로젝트 설정에 등록하세요. 심사 기록 저장소는 Vercel Marketplace의
**Upstash for Redis**(`innocurve-judge-history`)로 연결되어 있으며, `KV_REST_API_*`
환경변수가 자동 등록됩니다. 저장소에는 최신 100건만 남고 오래된 기록은 자동 삭제됩니다.
심사 기록 페이지에는 별도 로그인이 없으므로 사이트 주소를 아는 사람은 누구나 볼 수 있습니다.

## 예시 데이터

| 세트 | 트랙 | 기대 점수대 | 경로 |
|------|------|------------|------|
| CSV 대시보드 | 기관용 | 중간 (공공 맥락 없어 제1분야 상한) | `examples/01_csv_dashboard/` |
| 할 일 추적기 | 기관용 | 저득점 (기획↔코드 불일치) | `examples/02_todo_tracker/` |
| 민원 처리 지연 대시보드 | 기관용 | 고득점 | `examples/05_public_complaint_delay/` |
| 회의실 예약 대시보드 | 기업용 | 고득점 | `examples/03_corporate_meeting_room/` |
| 팀 업무 관리 보드 | 기업용 | 저득점 (자체 구축 정당성) | `examples/04_corporate_todo_board/` |

각 세트는 `PLAN.md`와 `app.py`로 구성됩니다 (PRD.md가 없으므로 결과서에 「누락된 파일: PRD.md」가 표시됩니다).
