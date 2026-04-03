# Mong Consulting - 자기소개서/이력서 AI 컨설팅 데스크톱 앱

## 개요

세계적 수준의 자기소개서/이력서 컨설턴트의 첨삭 패턴을 학습하여, 동일하거나 더 나은 수준의 AI 컨설팅을 제공하는 데스크톱 애플리케이션.

**현재 버전:** v3.0 (2026-04-04)

## 아키텍처

```
┌─ Electron 데스크톱 앱 (exe) ─────────────────────┐
│  React UI + 로컬 파일 파싱 (Word/PDF/HWP/HWPX)   │
│  로그인 → JWT 토큰으로 서버 API 호출               │
└──────────────┬───────────────────────────────────┘
               │ HTTP (JWT Auth)
               ▼
┌─ Hetzner 서버 (77.42.78.9:3100) ────────────────┐
│  Express + SQLite + Claude API                    │
│  포트 3100 (Quant Trading과 분리 공존)             │
│                                                   │
│  ├─ 인증 (JWT, bcrypt)                            │
│  ├─ 고객/첨삭/리비전 CRUD                          │
│  ├─ AI 첨삭 엔진 (스타일 프로파일 + few-shot)      │
│  ├─ AI 평가 엔진 (루브릭 + 캘리브레이션)            │
│  ├─ 학습 데이터 관리                               │
│  └─ 스타일 프로파일 (자동 갱신)                     │
└──────────────────────────────────────────────────┘
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| 데스크톱 | Electron 33 + React 19 + TypeScript 5.7 + Vite 6 |
| 서버 | Express 4 + TypeScript + SQLite (better-sqlite3) |
| AI | Claude API (claude-sonnet-4-20250514) via Anthropic SDK |
| 인증 | JWT + bcrypt |
| 파일 파싱 | mammoth (Word), pdf-parse (PDF), adm-zip + fast-xml-parser (HWPX), xlsx (Excel) |
| 내보내기 | docx (Word 생성) |
| 인프라 | Hetzner CAX21 (4vCPU/8GB ARM), Ubuntu 22.04, systemd |

## 프로젝트 구조

```
C:\src\Mong\
├── .env                                   # 서버 URL + 토큰
├── package.json
├── docs/                                  # 학습 데이터 원본 파일
│   ├── 00. 합격자소서/                     # 캘리브레이션 데이터 (27건)
│   ├── 01~14. 첨삭사례/                   # 학습 데이터 (14세트)
│   └── PROJECT_GUIDE.md                   # 이 문서
├── scripts/
│   ├── import-calibration.ts              # 합격자소서 임포트
│   ├── import-calibration-hwpx.ts         # 합격자소서 HWPX 추가 임포트
│   ├── import-training.ts                 # 학습 데이터 일괄 임포트
│   └── build-style-profile.ts             # 스타일 프로파일 빌드
├── server/                                # 백엔드 API 서버
│   ├── src/
│   │   ├── index.ts                       # 서버 진입점 (포트 3100)
│   │   ├── database.ts                    # SQLite 스키마 + 마이그레이션
│   │   ├── auth.ts                        # JWT 인증 + 회원가입/로그인
│   │   ├── routes.ts                      # REST API 라우트
│   │   └── aiEngine.ts                    # AI 첨삭/평가/패턴분석 엔진
│   ├── mong-consulting.service            # systemd 서비스 파일
│   └── .env                               # 서버 환경변수 (API 키, JWT 시크릿)
├── src/
│   ├── main/                              # Electron 메인 프로세스
│   │   ├── main.ts                        # 앱 진입점 + 인증 핸들러
│   │   ├── preload.ts                     # IPC 브릿지
│   │   ├── apiClient.ts                   # HTTP 클라이언트 (서버 통신)
│   │   └── handlers/                      # IPC → 서버 API 프록시
│   ├── renderer/                          # React UI
│   │   ├── App.tsx                        # 메인 (로그인 상태 관리 + 네비게이션)
│   │   ├── components/
│   │   │   ├── LoginScreen.tsx            # 로그인/회원가입 화면
│   │   │   ├── DiffView.tsx               # 변경 비교
│   │   │   ├── EvaluationPanel.tsx        # 평가 패널 (Before/After + 편집)
│   │   │   ├── ClientForm.tsx             # 고객 폼
│   │   │   ├── TrainingDataPanel.tsx      # 학습 데이터 관리
│   │   │   └── ImportModal.tsx            # 일괄 임포트
│   │   └── pages/
│   │       ├── ConsultingPage.tsx         # 첨삭 워크플로우
│   │       ├── ClientsPage.tsx            # 고객관리
│   │       └── DashboardPage.tsx          # 대시보드 (개요 + 품질)
│   └── shared/
│       └── types.ts                       # 공유 타입
└── dist/
    └── Mong Consulting Setup 1.0.0.exe    # 인스톨러 (347MB)
```

## DB 스키마

### users (사용자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 사용자 ID |
| username | TEXT UNIQUE | 로그인 아이디 |
| password_hash | TEXT | bcrypt 해시 |
| display_name | TEXT | 표시 이름 |
| role | TEXT | admin / consultant |

### clients (고객)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고객 ID |
| user_id | INTEGER FK | 담당 컨설턴트 (users) |
| name, email, phone, education, major, experience | TEXT | 기본 정보 |
| target_industry, target_position | TEXT | 희망 산업군/직무 |
| memo | TEXT | 컨설턴트 메모 |

### consultings (첨삭 건)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 첨삭 ID |
| client_id | INTEGER FK | 고객 ID |
| company_name, position | TEXT | 지원 회사/직무 |
| job_posting | TEXT | 공고 내용 |
| status | TEXT | draft / in_progress / completed |

### revisions (첨삭 버전)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 버전 ID |
| consulting_id | INTEGER FK | 첨삭 ID |
| stage | TEXT | draft(원본) / first(AI) / second(컨설턴트수정) / final(확정) |
| content | TEXT | 본문 |
| comments | TEXT | AI 코멘트 (JSON) |
| evaluation | TEXT | 종합 평가 (JSON) |

### training_cases + training_revisions (학습 데이터)
| 테이블 | 핵심 필드 | 설명 |
|--------|----------|------|
| training_cases | title, company_name, position, direction_memo | 학습 사례 (JD 포함) |
| training_revisions | case_id, stage(draft/final), content | 원본→최종 변환 쌍 |

### calibration_data (합격자소서)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| company_name | TEXT | 회사명 |
| position | TEXT | 직무 |
| industry | TEXT | 산업군 (금융/IT/공공기관/마케팅) |
| content | TEXT | 합격 자소서 본문 |

### style_profile (스타일 프로파일)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| version | INTEGER | 프로파일 버전 |
| profile | TEXT (JSON) | 어미규칙, 단어사전, 구조규칙, 직군별어조 등 |

---

## 학습 시스템

### 학습 데이터 현황

| 구분 | 건수 | 용도 |
|------|------|------|
| 합격자소서 (calibration_data) | 27건 | 평가 기준점 (4~5점 레퍼런스) |
| 첨삭 사례 (training_cases) | 18세트 | 컨설턴트 스타일 학습 (JD 12건 포함) |
| 스타일 프로파일 (style_profile) | v1 | 전체 데이터 분석 결과 |

### 학습 원칙

현재 Claude API는 파인튜닝을 지원하지 않으며, 18쌍의 데이터는 ML/DL 학습에 부족합니다.
따라서 **스타일 프로파일 + 스마트 프롬프팅** 방식을 채택합니다.

#### 스타일 프로파일이란

전체 학습 데이터(18쌍 원본→최종 + 합격자소서 27건)를 AI로 일괄 분석하여 추출한 **명시적 규칙 세트**입니다.

```
style_profile v1:
├─ 어미 변환 규칙 (2개, 빈도 포함)
│   예: "~할 수 있었습니다" → "~했습니다" (14/18건)
├─ 단어 교체 사전 (4개)
│   예: "적극적으로" → "주도적으로" (8/18건)
├─ 삭제 대상 표현 (4개)
│   예: "적극적으로" (10/18건) — 과장 수식어
├─ 추가 권장 표현 (3개)
│   예: "체계적으로" (9/18건) — 실무 전문성
├─ 구조 규칙 (3개)
│   예: 소제목 [행동+성과] 삽입 (15/18건)
├─ 직군별 어조 (3개)
│   예: 금융→은행 실무 언어, IT→비즈니스 중심
├─ 문장 패턴 (3개)
│   예: 마무리에 '~기여하겠습니다' 필수 (16/18건)
└─ 품질 기준 (5/4/3점 앵커)
```

#### 학습 데이터가 사용되는 3가지 경로

**1. 첨삭 시 (performRevision)**
```
시스템 프롬프트 =
  기본 첨삭 원칙 (하드코딩)
  + 스타일 프로파일 (DB에서 로드, 5분 캐시)     ← 전체 데이터의 축적된 규칙
  + 유사 사례 1~3건 (few-shot, 고객별 우선)      ← 구체적 변환 예시
```

**2. 평가 시 (performEvaluation)**
```
시스템 프롬프트 =
  평가 루브릭 (1~5점 구체 기준)
  + 스타일 프로파일
  + 캘리브레이션 레퍼런스 (같은 회사 합격자소서 우선, 최대 5건)
```

**3. 패턴 분석 시 (analyzeTrainingPattern)**
```
새 사례 저장 시 → 원본 vs 최종 비교 → 구조/어조/핵심 패턴 3줄 요약 생성
```

#### 학습 데이터가 생성되는 3가지 경로

| 경로 | 시점 | 저장 내용 |
|------|------|----------|
| 수동 import | 학습 데이터 Import 버튼 | docs/ 폴더의 과거 사례 (초안→최종 + JD) |
| 합격자소서 import | 스크립트 실행 | calibration_data에 합격 텍스트 |
| 실시간 첨삭 | 확정 → 저장 | 원본 → 최종 확정본 + 방향 메모 |

**실시간 학습 흐름:**
```
고객 원본 → AI 첨삭 → 컨설턴트 검토
                        ├─ 이대로 확정 → 저장 → training_data (AI결과확정)
                        └─ 수정 후 확정 → 저장 → training_data (컨설턴트수정확정)
                                                    ↓
                                              프로파일 캐시 무효화
                                              (5건마다 재빌드 권장)
```

#### 고도화 경로

```
현재 (v1):  18쌍 + 27건 → 스타일 프로파일 → 프롬프트 삽입
  ↓ 데이터 축적
30쌍:      프로파일 재빌드 → 규칙 빈도/신뢰도 상승
  ↓
50쌍:      산업군별 세분화된 프로파일 생성 가능
  ↓
100쌍+:    파인튜닝 검토 가능 (충분한 데이터)
           또는 임베딩 기반 유사도 검색 도입
```

---

## 주요 기능

### 1. 로그인/회원가입
- 셀프 회원가입 (이름 + 아이디 + 비밀번호)
- 첫 가입자 admin, 이후 consultant 권한
- JWT 7일 유효, 로그아웃 지원
- 직원별 고객 분리 (본인 등록 고객만 조회)

### 2. 첨삭하기 (ConsultingPage)
- 상단 정보바: 고객 선택/신규등록(인라인) + 회사명/직무 + 공고(접기/펼치기)
- 좌측: 원본 입력 (파일 업로드/드래그/직접 입력)
- 우측: AI 결과 (비교/결과/수정 탭) + 파일 업로드/드래그로 수정본 입력
- 우측 하단 액션바:
  - 결과 검토 모드: [이대로 확정] [수정하기]
  - 수정 모드: [수정본으로 확정] [AI 재첨삭 요청] (선택적)
- 확정 시: 최종본 자동 재평가 (Before/After 점수 비교, shimmer 로딩)
- 확정 후: 컨설팅 방향 메모 입력 → 저장
- 하단 버전 타임라인: 📄원본 → ⚡AI → ✎수정 → ✓확정
- Word 내보내기: "내보내기" 버튼
- 탭 전환 시 상태 유지 (항상 마운트)

### 3. 고객관리 (ClientsPage)
- 좌측: 고객 목록 + 검색
- 우측: 상세 (기본정보, 첨삭이력, 학습데이터)
- "새 첨삭 시작" → 첨삭 페이지로 이동
- 첨삭 이력 "열기" → 해당 첨삭 내용 복원
- 첨삭 이력 개별 삭제

### 4. 대시보드 (DashboardPage)
- 개요 탭: 총 고객, 이번 달 첨삭, 진행중/완료 + 최근 첨삭 테이블
- 품질 탭: 평균 평가 점수, 항목별 점수 이력, 캘리브레이션/학습 데이터 건수

### 5. AI 첨삭 엔진
- Claude claude-sonnet-4-20250514 사용
- **스타일 프로파일** 기반 첨삭 (데이터 기반 규칙 적용)
- 기본 원칙: JD 뼈대 이식, 구조 규칙 6가지, 어조 규칙, 내용 날조 금지
- 직군별 어조 자동 조정 (IT/금융/공공기관/마케팅/CS)
- 학습 데이터 few-shot (고객별 우선, 최대 3건)
- JSON 응답: 첨삭 본문 + 코멘트 + 5항목 평가

### 6. AI 평가 엔진 (분리)
- 첨삭과 별도 API (`/ai/evaluate`)
- 1~5점 루브릭 기준 (구체적 점수 정의)
- 합격자소서 캘리브레이션 (같은 회사/산업군 우선 매칭, 최대 5건)
- 총평: 항목별 진단 + 개선 방법 + 고객 보완 사항
- 총평 편집 가능 (컨설턴트 기준 반영)

### 7. 다크모드
- 상단 🌙/☀️ 토글, localStorage 저장
- 전체 CSS 변수 기반 (하드코딩 색상 0건)

---

## 환경 변수

### Electron (.env — 프로젝트 루트)
```env
MONG_SERVER_URL=http://77.42.78.9:3100
```

### 서버 (.env — /opt/mong/)
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
API_TOKEN=f447e6e9...  # JWT_SECRET으로도 사용
PORT=3100
```

---

## 실행 방법

### 개발 모드
```bash
# 서버 (로컬 또는 Hetzner에서 이미 실행 중)
cd server && npm run dev

# Electron
npm run dev:renderer
# 별도 터미널
npm run build:main && NODE_ENV=development npx electron dist/main/main.js
```

### 서버 배포
```bash
cd server && npm run build
scp -r server/dist server/package.json root@77.42.78.9:/opt/mong/
ssh root@77.42.78.9 "cd /opt/mong && npm install --omit=dev && systemctl restart mong-consulting"
```

### exe 패키징
```bash
npm run build && npx electron-builder --win
# 결과: dist/Mong Consulting Setup 1.0.0.exe
```

### 스타일 프로파일 재빌드
```bash
npx tsx scripts/build-style-profile.ts
```

---

## 변경 이력

### v1.1 (2026-04-02): AI 프롬프트 고도화
- 14개 첨삭 사례 매크로/미시 분석 → 시스템 프롬프트 반영
- JD 뼈대 이식 원칙, 구조 규칙 6가지, 어조 규칙, 직군별 어조

### v1.2 (2026-04-03): 드래그 앤 드롭 + 단계 단순화
- `webUtils.getPathForFile()` 적용
- 1차/2차/최종 → 매번 종합 피드백 단일 모드

### v1.3 (2026-04-03): 평가 개선 + 내용 날조 방지
- 점수별 개선 가이드, 내용 날조 금지 원칙

### v2.0 (2026-04-03): 서버 분리 + 팀 배포
- Electron → Hetzner 서버(3100) 아키텍처 전환
- API 토큰 인증, Quant Trading과 포트 분리 공존

### v2.1 (2026-04-03): UX 전면 재설계
- 고객 연동 워크플로우, 버전 타임라인
- 확정/재첨삭 분리, 인라인 에러 메시지
- 고객관리 ↔ 첨삭 페이지 간 자연스러운 네비게이션

### v2.2 (2026-04-03): 평가 시스템 고도화
- 평가 전용 API 분리 (`/ai/evaluate`)
- 루브릭 기반 1~5점 기준 명시
- 합격자소서 27건 캘리브레이션 (회사/산업군 매칭)
- 확정 시 Before/After 재평가 + shimmer 로딩
- 총평 편집 가능

### v3.0 (2026-04-04): 스타일 프로파일 + 로그인 + exe
- **스타일 프로파일 시스템**: 18쌍+27건 전체 분석 → 규칙 세트 추출 → 프롬프트 자동 반영
- **로그인/회원가입**: JWT 인증, 직원별 고객 분리
- **exe 패키징**: Windows NSIS 인스톨러 (347MB)
- 학습 데이터 일괄 import: 14세트 36리비전 + JD 12건
- hwp/hwpx 파싱: adm-zip + fast-xml-parser
- Word 내보내기: docx 라이브러리
- 과거 이력 불러오기, 첨삭 이력 개별 삭제
- 다크모드 (CSS 변수 완전 전환)
- 품질 대시보드 (항목별 점수 이력)
- 패턴 분석 자동화 (저장 시 AI 분석)
- API 토큰 보안 강화 (64자 랜덤)

---

## 향후 작업 (TODO)

### 우선순위 높음
- [ ] **프롬프트 실전 테스트** — 실제 자소서로 첨삭 품질 검증 (날조, 어조, 구조, 평가 점수 신뢰도)
- [ ] **스타일 프로파일 자동 재빌드** — final 5건마다 서버에서 자동 실행 (현재는 로그만 출력)
- [ ] **admin 계정 비밀번호 변경** — 기본값 admin123에서 변경 필요
- [ ] **임베딩 기반 유사 사례 검색** — 현재 최근순 3건 → 텍스트 유사도 기반 매칭으로 개선

### 우선순위 중간
- [ ] **기업별 특색 반영** — 외부 API(채용공고 DB, 기업 리뷰)로 기업문화/인재상 자동 수집 후 첨삭+평가에 반영
- [ ] **산업군별 세분화 프로파일** — 데이터 50쌍 이상 시 금융/IT/공공 별도 프로파일 생성
- [ ] **컨설턴트 총평 학습** — 컨설턴트가 수정한 총평을 다음 평가에 반영하는 피드백 루프
- [ ] **앱 아이콘** — 현재 기본 Electron 아이콘 → 커스텀 아이콘으로 교체
- [ ] **자동 업데이트** — electron-updater로 새 버전 자동 배포

### 우선순위 낮음 (데이터 축적 후)
- [ ] **파인튜닝 검토** — 학습 데이터 100쌍 이상 시 오픈소스 한국어 LLM 파인튜닝 평가
- [ ] **PDF 내보내기** — Word 외에 PDF 직접 생성
- [ ] **멀티 세션 관리** — 동시에 여러 고객 첨삭 탭 지원
- [ ] **첨삭 비교 리포트** — 고객에게 전달할 Before/After 비교 PDF 리포트 자동 생성
