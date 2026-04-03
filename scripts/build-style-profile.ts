/**
 * 전체 학습 데이터(14세트) + 합격자소서(27건)를 분석하여 스타일 프로파일 생성
 * 결과를 서버 DB의 style_profile 테이블에 저장
 */

const SERVER_URL = process.env.MONG_SERVER_URL || 'http://77.42.78.9:3100';
const API_TOKEN = process.env.MONG_API_TOKEN || 'f447e6e9c405574593e56c67c83a2530da7b6361d22b3c371d7285323b6cc1a6';

async function apiGet(path: string) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` },
  });
  return res.json();
}

async function apiPost(path: string, body: any) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  console.log('=== 스타일 프로파일 빌드 시작 ===\n');

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
    `[사례${i + 1}: ${p.company} ${p.position}]\n--- 원본(${p.draft.length}자) ---\n${p.draft.slice(0, 1200)}\n--- 최종(${p.final.length}자) ---\n${p.final.slice(0, 1200)}`
  ).join('\n\n');

  const revisionAnalysis = await apiPost('/ai/revise-raw', {
    system: `당신은 자기소개서 첨삭 패턴 분석 전문가입니다.
아래에 컨설턴트가 실제로 수행한 첨삭 사례들(원본→최종)이 제공됩니다.
모든 사례를 꼼꼼히 비교하여 반복되는 패턴을 빈도와 함께 추출해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "ending_rules": [
    {"from": "~할 수 있었습니다", "to": "~했습니다", "frequency": "14/14", "note": "가능형→확정형"}
  ],
  "word_replacements": [
    {"from": "소통", "to": "협업", "frequency": "5/14", "context": "팀워크 맥락"}
  ],
  "deleted_expressions": [
    {"expression": "적극적으로", "frequency": "10/14", "reason": "과장 수식어"}
  ],
  "added_expressions": [
    {"expression": "체계적으로", "frequency": "8/14", "context": "실무 부사"}
  ],
  "structure_rules": [
    {"rule": "소제목 [행동+성과] 형식 삽입", "frequency": "12/14"}
  ],
  "industry_tone": {
    "금융": "학생적 표현→은행 실무 언어, 제도/상품명 삽입",
    "IT": "감성→비즈니스, 불필요 도구명 삭제"
  },
  "sentence_patterns": [
    {"pattern": "마무리 문장에 JD 키워드 직접 삽입", "frequency": "13/14"}
  ]
}`,
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
