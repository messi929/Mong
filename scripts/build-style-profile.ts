/**
 * 전체 학습 데이터(14세트) + 합격자소서(27건)를 분석하여 스타일 프로파일 생성
 * 결과를 서버 DB의 style_profile 테이블에 저장
 */

const SERVER_URL = process.env.MONG_SERVER_URL || 'http://77.42.78.9:3100';
const ADMIN_USER = process.env.MONG_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.MONG_ADMIN_PASS || 'admin123';

// 서버 authMiddleware는 JWT만 허용한다. 로그인으로 토큰을 발급받아 사용한다.
let authToken = '';

async function login() {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  const data = await res.json() as any;
  if (!data.token) {
    throw new Error(`로그인 실패: ${JSON.stringify(data)} (MONG_ADMIN_USER/MONG_ADMIN_PASS 환경변수로 계정 지정 가능)`);
  }
  authToken = data.token;
}

async function apiGet(path: string) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  return res.json();
}

async function apiPost(path: string, body: any) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('=== 스타일 프로파일 빌드 시작 ===\n');

  await login();
  console.log(`로그인 완료 (${ADMIN_USER})\n`);

  // 1. 학습 데이터 수집
  const cases = await apiGet('/training/cases') as any[];
  console.log(`학습 사례: ${cases.length}건`);

  const pairs: { company: string; position: string; jd: string; draft: string; final: string }[] = [];

  for (const tc of cases) {
    const revisions = await apiGet(`/training/revisions?caseId=${tc.id}`) as any[];
    const draft = revisions.find((r: any) => r.stage === 'draft');
    const final = revisions.find((r: any) => r.stage === 'final');
    if (draft && final) {
      pairs.push({
        company: tc.companyName || '',
        position: tc.position || '',
        jd: tc.directionMemo || '',
        draft: draft.content,
        final: final.content,
      });
    }
  }
  console.log(`분석 대상: ${pairs.length}쌍 (draft→final)\n`);

  // 2. 합격자소서 수집
  const calibrations = await apiGet('/calibration') as any[];
  console.log(`합격자소서: ${calibrations.length}건\n`);

  // 3. AI에게 전체 분석 요청 (청크별로 나눠서)
  console.log('스타일 패턴 분석 중...');

  // 3-1. 첨삭 패턴 분석 (원본→최종 비교)
  const pairSummaries = pairs.map((p, i) =>
    `[사례${i + 1}: ${p.company} ${p.position}]\n` +
    (p.jd ? `컨설턴트 방향 메모: ${p.jd}\n` : '') +
    `--- 원본(${p.draft.length}자) ---\n${p.draft.slice(0, 4000)}\n` +
    `--- 최종(${p.final.length}자) ---\n${p.final.slice(0, 4000)}`
  ).join('\n\n');

  const revisionAnalysis = await apiPost('/ai/revise-raw', {
    system: `당신은 자기소개서 컨설팅 전략 분석가입니다.
아래에 컨설턴트가 실제로 수행한 첨삭 사례들(원본→최종, 일부는 방향 메모 포함)이 제공됩니다.

당신의 임무는 단어 치환 목록을 만드는 것이 아닙니다.
컨설턴트가 *왜* 그렇게 고쳤는지 — 어떤 증상을 보고, 어떤 근본 원인을 진단하고, 어떤 처방을 내렸는지 — 그 전략적 판단 논리를 복원하는 것입니다.
원본과 최종본의 차이에서, 문장이 아니라 *구조와 전략*이 어떻게 바뀌었는지 추출하세요.
모든 사례를 꼼꼼히 비교하고, 반복되는 패턴마다 빈도(예: "9/14")를 붙이세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "diagnostic_map": [
    {
      "symptom": "원본에서 반복적으로 관찰된 문제 (예: 도입부가 개인 감상/일반론으로 시작)",
      "root_cause": "컨설턴트가 판단했을 근본 원인 (예: 직무 정의 부재로 채용담당자 몰입 실패)",
      "prescription": "최종본에서 적용된 해결 방향 (예: 수치 기반 시장 분석 또는 직무 정의로 첫 문장 교체)",
      "frequency": "9/14"
    }
  ],
  "episode_decisions": [
    {
      "before": "원본의 에피소드 구성 (예: 무관한 경험 3개 나열)",
      "after": "최종본의 에피소드 구성 (예: JD 연관 경험 1개 집중)",
      "criteria": "남기고 버린 판단 기준 (예: JD 핵심 동사와 직접 매칭되는가)",
      "frequency": "11/14"
    }
  ],
  "jd_transplant": [
    {
      "location": "소제목 | 도입부 | 마무리 중 하나",
      "method": "JD 키워드를 어떻게 이식했는지",
      "example": "원본 표현 → 최종 표현 짧은 예시",
      "frequency": "12/14"
    }
  ],
  "structure_redesign": [
    {
      "from": "원본의 문항 구조 (예: 시간순 나열)",
      "to": "재설계된 구조 (예: 문제→원인→해결→수치결과)",
      "rationale": "왜 이렇게 바꿨는지",
      "frequency": "10/14"
    }
  ],
  "company_asset_tactics": [
    {
      "tactic": "발굴·삽입한 기업 고유 자산 유형 (제도명/상품명/서비스명 등)",
      "examples": ["RM Stepup 과정", "하나 패밀리오피스"],
      "trigger": "이 전술을 쓴 상황 (예: JD가 짧아 매칭할 키워드가 부족할 때)",
      "frequency": "6/14"
    }
  ],
  "industry_strategy": {
    "금융": "이 직군에서만 두드러진 전략적 차이",
    "IT": "감성→비즈니스 전환, 비전공자도 읽히게 기술 원리 압축"
  },
  "expression_signature": [
    {"from": "~할 수 있었습니다", "to": "~했습니다", "frequency": "14/14"}
  ]
}

주의:
- diagnostic_map / episode_decisions / structure_redesign 가 핵심입니다. 여기에 가장 많은 분량을 쓰세요.
- expression_signature 는 데이터에서 *압도적으로 지배적인* 어조 규칙 3~5개만. 자잘한 단어 치환은 넣지 마세요 (이미 시스템 룰에 있음).
- 모든 항목은 실제 사례에서 관찰된 것만. 추측으로 채우지 마세요.`,
    user: pairSummaries,
  });

  // 3-2. 합격자소서 품질 특성 분석
  const calibSummaries = calibrations.slice(0, 15).map((c: any, i: number) =>
    `[합격${i + 1}: ${c.company_name} ${c.position} (${c.industry})]\n${c.content.slice(0, 800)}`
  ).join('\n\n');

  const qualityAnalysis = await apiPost('/ai/revise-raw', {
    system: `당신은 합격 자기소개서 품질 분석 전문가입니다.
아래에 실제 합격한 자기소개서들이 제공됩니다.
합격 자소서의 공통 특성을 분석하여 JSON으로 정리해주세요.

{
  "common_traits": ["특성1", "특성2", ...],
  "structure_patterns": ["패턴1", "패턴2", ...],
  "expression_quality": ["표현 특성1", "표현 특성2", ...],
  "industry_specific": {
    "금융": ["특성1", "특성2"],
    "IT": ["특성1", "특성2"]
  },
  "scoring_anchors": {
    "5점_기준": "설명",
    "4점_기준": "설명",
    "3점_기준": "설명"
  }
}`,
    user: calibSummaries,
  });

  // 4. 결합하여 스타일 프로파일 저장
  const profile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    dataStats: {
      trainingPairs: pairs.length,
      calibrationDocs: calibrations.length,
    },
    revisionPatterns: revisionAnalysis,
    qualityBenchmark: qualityAnalysis,
  };

  console.log('\n스타일 프로파일 저장 중...');
  const saveResult = await apiPost('/style-profile', { profile: JSON.stringify(profile) });
  console.log('저장 결과:', saveResult);

  console.log('\n=== 완료 ===');
  console.log(`첨삭 패턴: ${JSON.stringify(revisionAnalysis).length}자`);
  console.log(`품질 기준: ${JSON.stringify(qualityAnalysis).length}자`);
}

main().catch(console.error);
