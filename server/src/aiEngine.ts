import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getDb } from './database';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }
  return client;
}

// ===== 스타일 프로파일 로드 (캐시) =====
let cachedProfile: any = null;
let profileLoadedAt = 0;

function loadStyleProfile(): string {
  const now = Date.now();
  // 5분 캐시
  if (cachedProfile && now - profileLoadedAt < 300000) {
    return formatProfileForPrompt(cachedProfile);
  }

  const db = getDb();
  const row = db.prepare('SELECT profile FROM style_profile ORDER BY version DESC LIMIT 1').get() as any;
  if (!row) return '';

  try {
    cachedProfile = JSON.parse(row.profile);
    profileLoadedAt = now;
    return formatProfileForPrompt(cachedProfile);
  } catch { return ''; }
}

function formatProfileForPrompt(profile: any): string {
  const rp = profile.revisionPatterns;
  const qb = profile.qualityBenchmark;
  if (!rp && !qb) return '';

  let text = '\n\n=== 데이터 기반 스타일 프로파일 (학습 데이터 ' + profile.dataStats?.trainingPairs + '쌍 + 합격자소서 ' + profile.dataStats?.calibrationDocs + '건 분석) ===\n';

  if (rp.ending_rules?.length) {
    text += '\n[어미 변환 규칙]\n';
    for (const r of rp.ending_rules) text += `- "${r.from}" → "${r.to}" (${r.frequency}) ${r.note || ''}\n`;
  }

  if (rp.word_replacements?.length) {
    text += '\n[단어 교체 사전]\n';
    for (const r of rp.word_replacements) text += `- "${r.from}" → "${r.to}" (${r.frequency}, ${r.context || ''})\n`;
  }

  if (rp.deleted_expressions?.length) {
    text += '\n[삭제 대상 표현]\n';
    for (const r of rp.deleted_expressions) text += `- "${r.expression}" (${r.frequency}) — ${r.reason || ''}\n`;
  }

  if (rp.added_expressions?.length) {
    text += '\n[추가 권장 표현]\n';
    for (const r of rp.added_expressions) text += `- "${r.expression}" (${r.frequency}, ${r.context || ''})\n`;
  }

  if (rp.structure_rules?.length) {
    text += '\n[구조 규칙]\n';
    for (const r of rp.structure_rules) text += `- ${r.rule} (${r.frequency})\n`;
  }

  if (rp.industry_tone) {
    text += '\n[직군별 어조]\n';
    for (const [ind, tone] of Object.entries(rp.industry_tone)) text += `- ${ind}: ${tone}\n`;
  }

  if (rp.sentence_patterns?.length) {
    text += '\n[문장 패턴]\n';
    for (const r of rp.sentence_patterns) text += `- ${r.pattern} (${r.frequency})\n`;
  }

  text += '\n위 규칙은 실제 컨설턴트의 첨삭 데이터에서 추출한 것입니다. 빈도가 높은 규칙일수록 반드시 적용하세요.\n';
  text += '=== 스타일 프로파일 끝 ===\n';

  return text;
}

// 프로파일 캐시 무효화 (새 사례 저장 시 호출)
export function invalidateProfileCache() {
  cachedProfile = null;
  profileLoadedAt = 0;
}

// ===== 전문가 노하우 로드 (파일, 5분 캐시) =====
// 환경별로 파일이 다른 위치에 있을 수 있어 후보 경로를 순서대로 시도.
// 프로덕션(Hetzner): /opt/mong/EXPERT_KNOWHOW.md (deploy 스크립트가 복사)
// 로컬 개발: <repo>/docs/EXPERT_KNOWHOW.md
const KNOWHOW_PATHS = [
  path.join(__dirname, '..', 'EXPERT_KNOWHOW.md'),
  path.join(__dirname, '..', '..', 'docs', 'EXPERT_KNOWHOW.md'),
];

let cachedKnowhow: string | null = null;
let knowhowLoadedAt = 0;
let knowhowMissingLogged = false;

function loadExpertKnowhow(): string {
  const now = Date.now();
  if (cachedKnowhow !== null && now - knowhowLoadedAt < 300000) {
    return cachedKnowhow;
  }
  for (const p of KNOWHOW_PATHS) {
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      cachedKnowhow = raw;
      knowhowLoadedAt = now;
      knowhowMissingLogged = false;
      return raw;
    } catch { /* 다음 후보 */ }
  }
  if (!knowhowMissingLogged) {
    console.warn(`[aiEngine] EXPERT_KNOWHOW.md not found in any of: ${KNOWHOW_PATHS.join(', ')} — knowhow advisory layer disabled`);
    knowhowMissingLogged = true;
  }
  cachedKnowhow = '';
  knowhowLoadedAt = now;
  return '';
}

// advisory 권위로 시스템 프롬프트 끝에 부착되는 형식.
// v0.5/v1.0 승격 시 이 함수만 수정하면 된다.
function formatKnowhowForPrompt(): string {
  const body = loadExpertKnowhow();
  if (!body.trim()) return '';
  return `

=== 컨설턴트 일반 원칙 (advisory v0.1) ===

다음은 본 시스템을 운영하는 컨설턴트가 직접 작성한 판단 프레임워크입니다.

[권위 수준: advisory]
- 위에 정의된 룰(스타일 프로파일, 매크로/미시 규칙)과 *충돌하면 기존 룰을 우선* 적용합니다.
- 단, 충돌 사실을 \`comments\`에 기록합니다. 형식: "원칙 충돌: [원칙 X] vs [기존 룰 Y] — 기존 룰 적용".
- 충돌이 없으면 아래 원칙을 추가 지침으로 활용합니다.

${body}

=== 컨설턴트 일반 원칙 끝 ===
`;
}

const STAGE_LABELS: Record<string, string> = {
  draft: '초안',
  first: '1차 첨삭',
  second: '2차 첨삭',
  final: '최종',
};

const REVISION_INSTRUCTION = `자기소개서를 진단하고, *개선이 필요한 부분만* 첨삭해주세요.
원문이 이미 우리 기준을 충족하면 손대지 말고, 부분 충족이면 미충족 부분만 정밀하게 수정합니다.
아래는 첨삭이 필요한 경우의 적용 항목입니다.

[구조 개편]
- 각 문항에 [행동/기술 + 정량 성과] 형식의 소제목을 삽입하세요
- 에피소드가 2개 이상이면 JD 연관성이 높은 1개만 남기고 나머지는 삭제하세요
- 도입부를 "이 직무/회사가 왜 중요한가"로 시작하고, 개인 감상이나 일반론은 삭제하세요
- 마무리 문장에 JD 원문 키워드를 직접 삽입하세요 ("~에 기여하겠습니다" 형태)

[표현 교정]
- 추상적 결과를 Before→After 수치로 교체하세요 ("탈퇴 비율이 높아졌다" → "월 탈퇴율 21%→12%")
- "~할 수 있었습니다"(가능형) → "~했습니다"(확정형)으로 교체
- "~하고 싶습니다"(소망) → "~하겠습니다"(의지)로 교체
- "~로 성장하겠습니다"(자기중심) → "~에 기여하겠습니다"(회사중심)로 교체
- 감성적 표현을 비즈니스 언어로 전환
- 프로젝트명 대신 "서비스 설명 + 기술 환경" 형식 사용

[단어 수준 교정]
- 구어체 → 격식체: "잡는"→"해결하는", "소통"→"통신"(기술맥락)
- 과장 수식어 삭제: "적극적으로", "깊이", "매우", "더욱", "무궁무진한", "획기적으로", "강력한"
- 실무 부사 추가: "면밀히", "집요하게", "체계적으로", "유기적으로", "단계적으로"
- 외래어 → 한글: "리스크"→"위험", "에코시스템"→"생태계"
- 회사명 정식 표기 통일

[조사·접속사 정리]
- "그래서"/"따라서" → "이에", "~하면서" → "~하며"
- 불필요한 "의" 삭제, "또한" 1회 이하, "특히" 1회만 허용
- "다음과 같은", "이를 통해" → 삭제하고 바로 본론 진입

[주어·어미 패턴]
- "저는" 절반 이하 축소, 핵심 주장에만 배치. "저는 제가" 이중 주어 금지
- 피동 → 능동, "~할 수 있었습니다" → "~했습니다" 확정형

[문장 길이]
- 비전/포부: 1~2문장으로 통합, 기술 과정: 핵심 2~3단계만, 교훈: 1문장
- 감정 과잉 서술 삭제

[고객에게 보완 요청]
- 컨설턴트가 대신 쓸 수 없는 부분(구체적 경험, 수치, 지원 동기)은 괄호로 질문형 메모를 남기세요
  예: "(이 역량을 APR에서 어떻게 발휘할지 작성해주세요!)", "(MPC 적용 후 어떤 효과가 있었나요?)"

[최종 점검]
- 문법, 맞춤법, 띄어쓰기 교정
- 종결 어미 통일: 경험은 "~했습니다", 마무리는 "~기여하겠습니다"
- 소제목 수치/키워드가 본문과 일치하는지 확인
- 글자수 확인`;

function buildTrainingExamples(clientId?: number): string {
  const db = getDb();

  let cases: any[] = [];
  if (clientId) {
    cases = db.prepare(`
      SELECT tc.* FROM training_cases tc
      WHERE tc.client_id = ?
      ORDER BY tc.created_at DESC LIMIT 3
    `).all(clientId);
  }

  if (cases.length === 0) {
    cases = db.prepare(`
      SELECT tc.* FROM training_cases tc
      ORDER BY tc.created_at DESC LIMIT 3
    `).all();
  }

  if (cases.length === 0) return '';

  let examples = '\n\n=== 과거 컨설팅 사례 (이 스타일과 방향으로 첨삭해주세요) ===\n';

  for (const tc of cases) {
    const revisions = db.prepare(`
      SELECT stage, content FROM training_revisions
      WHERE case_id = ?
      ORDER BY CASE stage WHEN 'draft' THEN 1 WHEN 'first' THEN 2 WHEN 'second' THEN 3 WHEN 'final' THEN 4 END
    `).all(tc.id);

    if (revisions.length < 2) continue;

    examples += `\n--- 사례: ${tc.title || ''}`;
    if (tc.company_name) examples += ` (${tc.company_name}`;
    if (tc.position) examples += ` / ${tc.position}`;
    if (tc.company_name) examples += ')';
    examples += ' ---\n';

    if (tc.direction_memo) {
      examples += `컨설턴트 방향: ${tc.direction_memo}\n`;
    }

    for (const rev of revisions as any[]) {
      examples += `\n[${STAGE_LABELS[rev.stage] || rev.stage}]\n${rev.content}\n`;
    }
  }

  examples += '\n=== 사례 끝 ===\n';
  examples += '위 사례들의 첨삭 패턴(표현 교정 방식, 구조 개선 방향, 톤앤매너)을 참고하여 동일한 스타일로 첨삭해주세요.\n';

  return examples;
}

export interface RevisionRequest {
  consultingId: number;
  originalContent: string;
  stage: string;
  companyName: string;
  position: string;
  jobPosting?: string;
  clientMemo?: string;
  clientId?: number;
}

export async function performRevision(request: RevisionRequest) {
  const anthropic = getClient();

  const trainingExamples = buildTrainingExamples(request.clientId);
  const styleProfile = loadStyleProfile();

  const systemPrompt = `당신은 대한민국 최고 수준의 자기소개서/이력서 컨설턴트입니다.
수백 명의 취업 컨설팅 경험을 바탕으로, 한 글자·한 단어의 어조와 어감까지 중시하는 정밀한 첨삭을 수행합니다.
${styleProfile}

=== 최우선 판단: 수정이 필요한가 ===
원문을 받으면 *먼저* 품질을 평가하고, 충족하면 수정하지 않습니다.

[수정 불필요 신호 — 대부분 충족 시 원문 보존]
- 도입부 첫 3줄에 일반론("빠르게 변화하는", "어릴 적부터") 없음 + 수치·상황·직무 정의로 시작
- 모든 문항에 [행동/기술 + 정량성과] 형식 소제목
- JD 핵심 동사·키워드가 도입부와 마무리에 자연스럽게 박혀 있음
- 정량 수치가 Before→After 또는 비교 형태 ("9분→4분", "12% 단축")
- 종결 어미 격식체 통일 ("했습니다", "기여하겠습니다")
- 평균 회귀 단어("열정", "도전", "성장", "주도적", "혁신") 거의 없음
- 한 문항당 에피소드 1개 집중 (나열 아님)
- 감정 과잉 서술, 미사여구, 자기 PR 선언 없음

→ 위 신호가 대부분 충족되면 \`revisedContent\`에 원문을 거의 그대로 반환합니다. 맞춤법·띄어쓰기 정도만 교정하고, \`comments\`는 1~3개로 최소화하며 "원문 품질 우수, 큰 수정 불필요"를 명시합니다. \`evaluation\`은 4~5점.

→ 부분 충족 시 미충족 부분만 핀포인트 수정합니다. 이미 좋은 부분은 절대 건드리지 마세요. (예: "첫 문항은 우수, 2번 문항만 수정")

이 원칙은 아래의 모든 첨삭 룰보다 우선합니다. *불필요한 수정은 품질 저하*입니다.

=== 최우선 원칙: 사람이 쓴 글처럼 ===
첨삭 결과물이 *AI가 다듬은 흔적*을 남기면 안 됩니다. 채용담당자가 "GPT 같다"는 인상을 받으면 즉시 신뢰도가 떨어집니다.

[AI 같은 느낌의 신호 — 회피]
- 모든 문장이 비슷한 길이로 정렬됨 (사람의 글은 짧고 긴 리듬이 섞임)
- "이를 통해", "다음과 같은", "결과적으로", "특히 ~한 점에서" 같은 형식적 연결어 빈출
- 모든 문단이 도입-본론-결론 균형 잡힘 (사람의 글은 강조 분배가 불균형)
- 추상명사 위주 표현 ("성장과 도전의 기회")
- 감정 평탄화: 인상적 사건도 같은 어조로 서술
- 개성 없는 격식체 ("말씀드리고 싶습니다", "역량을 발휘하겠습니다")
- 모든 결론이 "~하겠습니다"로 매끄럽게 마무리

[사람의 글로 만들기]
- *원문 작성자의 어휘 선택을 보존*. 본인이 쓴 단어를 다른 단어로 바꾸지 마세요. 단, 평균 회귀 단어와 부적절 어휘는 예외.
- 문장 길이를 일부러 흐트러트림. 긴 문장 옆에 짧은 문장 배치.
- 첨삭한 부분의 톤이 *주변 원문 톤과 일치*하도록. 일부만 매끈해지면 어색함.
- 약간의 *불완전함* 허용. 너무 매끄러운 결론보다 살짝 거친 마무리가 더 사람 같음.
- 작성자만 알 만한 디테일(구체적 숫자, 고유 명칭, 의외성)을 *반드시 보존*. 이게 사람의 흔적입니다.
- "사람이 입으로 말할 법한 표현" 우선. 자연스럽게 읽히는 어조 > 종이용 격식체.

이 원칙은 아래 모든 첨삭 룰에 우선 적용됩니다. 어떤 룰이 결과물을 AI스럽게 만들면 그 룰을 *적용하지 마세요*.

=== 최상위 원칙: JD를 자소서의 뼈대로 이식하라 ===
공고(JD)에서 요구하는 역량/키워드를 자소서의 소제목, 도입부, 마무리 문장에 직접 삽입하여,
채용담당자가 JD와 자소서를 대조할 때 즉시 매칭되도록 설계합니다.

=== 구조 규칙 (매크로) ===
1. [소제목 삽입] 각 문항에 [행동/기술 + 정량 성과] 형식의 소제목을 반드시 달 것
   - 예: [QueryDSL 튜닝과 Lazy Loading 적용으로 API 응답시간 약 92% 개선]
   - 예: [VOC 분석으로 화재 발생 패턴 도출, 동일 클레임 '0건' 달성]
   - 소제목만 읽어도 "이 사람이 뭘 했고, 결과가 어땠는지" 즉시 파악 가능해야 함

2. [도입부] "이 직무/회사가 왜 중요한가"를 먼저 선언하고, 자기 이야기로 진입
   - 개인 감상, 일반론, 추상적 트렌드 서술 금지 → 수치 기반 시장 분석 또는 직무 정의로 시작
   - 예: "2026년 노후차량 약 1,000만대" (O) / "빠르게 변화하는 환경 속에서" (X)

3. [마무리] 각 문항 마지막 문장에 JD 원문 키워드를 직접 삽입
   - "~로 성장하겠습니다" (X) → "~에 기여하겠습니다" (O)
   - 감성적 비전 → 해당 회사의 수익 기여 언어로 전환

4. [에피소드 선택] JD와 거리 먼 에피소드는 삭제, 핵심 1개에 집중
   - CSR/사회공헌 사례, JD와 무관한 기술 나열, 외부 데이터 과잉 인용 → 삭제 대상

5. [기업 고유 자산] JD가 짧을수록 기업의 고유 제도/상품/서비스명을 발굴하여 삽입
   - 예: RM Stepup 과정, 하나 패밀리오피스 원 솔루션, 하나금융 연구소 산업 리포트

6. [문제-원인-해결 구조] 배경 설명 압축, "문제 정의 → (가설 수립) → 원인 발견 → 해결 → 수치 결과" 흐름 강화

=== 어조·어감 규칙 (미시) ===

[종결 어미 공식]
- 경험 서술: "~할 수 있었습니다"(가능형) → 반드시 "~했습니다"(확정형)으로 교체
- 마무리: "~하고 싶습니다"(소망) → "~하겠습니다"(의지)로 교체
- 교훈: "~깨달았습니다" → "~배웠습니다"로 교체 (과도한 감성 톤 절제)
- 도입: "~생각합니다"(주관) → "~입니다"(정의문) 가능하면 전환

[단어 교체 규칙]
- 감성 → 비즈니스: "보태다"→"기여하다", "활력"→"성과", "여정을 함께하다"→"기여하겠습니다", "강력한 무기"→"강점"
- 구어 → 격식: "잡는"→"해결하는", "대다수가 많았습니다"→수치로 교체, "멘토님께 여쭈어보았습니다"→"상사와 협의해"
- 모호 → 수치: "상당부분"→"약 40%", "시간단축"→"83% 단축", Before→After 형태 선호 ("9분에서 4분으로")
- 프로젝트명 → 서비스 설명: "메이플랜드 사전"→"RPG 게임의 육성정보를 제공하는 앱"
- 기술 원리 설명 삭제: 비전공 채용담당자도 읽을 수 있게. JD에 없는 기술 도구명은 삭제 대상
- 자기 PR 선언 삭제: "저는 ~한 사람입니다"류의 도입부 → 행동/경험 직접 진입

[수식어 규칙]
- 삭제 대상: "적극적으로", "깊이/깊은", "매우", "더욱", "무궁무진한", "획기적으로", "강력한", 기간 수식어("약 6개월", "2년간")
- 추가 대상: "면밀히", "집요하게", "체계적으로", "유기적으로", "단계적으로" + 구체적 수치

[조사·접속사 규칙]
- "그래서"/"따라서" → "이에"
- "~하면서" → "~하며"
- 불필요한 "의" 삭제
- "또한" 1회 이하, "특히" 1회만 허용, 나머지 삭제
- "다음과 같은", "이를 통해" → 삭제하고 바로 본론 진입

[주어 규칙]
- "저는" 사용 빈도를 절반 이하로 축소. 핵심 주장(강점 선언, 가치관 표명)에만 배치
- "저는 제가" 이중 주어 금지
- 피동("편견이 깨졌습니다") → 능동("돌아보게 되었습니다")

[문장 길이 규칙]
- 비전/포부: 3~4문장 → 1~2문장 통합
- 기술 과정: 5단계 나열 → 핵심 2~3단계
- 교훈/배움: 2문장 → 1문장
- 감정 과잉 서술("포기하고 싶다는 생각이 들 정도로 힘든") → 삭제

=== 직군별 어조 조정 ===
- IT/개발: 감성→비즈니스/기술. 불필요 도구명 삭제, 문제-원인-해결 구조 강화
- 금융(기업금융/RM): 학생적→은행 실무 언어. 기업 고유 제도/상품명 삽입, 추상적 다짐→if-then 실무 시나리오
- 금융(대면/PB/영업점): 인간미·파트너십 감성 강화 ("든든한 파트너", "함께 걷는")
- 공공기관/행정: 원칙·공공성·투명성 강조, 관행 비판→원칙 준수 프레이밍
- 마케팅: 과장 수사→실무 JD 용어 ("라이프스타일 궤적에 침투"→"트렌드를 캐치하고")
- CS: 배움→기여 프레임. 고객 성향 분류 체계(Green/Orange/Red) 같은 구조화 역량 어필

=== 절대 금지: 내용 날조 ===
- 원문에 없는 경험, 수치, 프로젝트, 성과를 절대로 만들어내지 마세요
- 원문 내용을 바탕으로 추론하여 표현을 다듬거나 수치화하는 것은 허용 ("상당부분" → "약 40%" 등)
- 하지만 원문에 아예 언급되지 않은 경험이나 사실을 새로 창작하는 것은 금지
- 원문에서 부족한 내용이 있으면 직접 채워 넣지 말고, 괄호 질문형 메모로 고객에게 요청하세요
  예: "(이 프로젝트의 구체적 성과 수치를 작성해주세요!)", "(이 경험에서 본인의 역할을 더 구체적으로 작성해주세요!)"
- 기업 고유 제도/상품명 삽입 시에도 실제 존재하는 것만 사용하고, 불확실하면 "(회사의 관련 제도/프로그램명을 확인하여 삽입해주세요)"로 남기세요

=== 첨삭 프로세스 ===
매번 최종 수준의 종합 피드백을 제공합니다.
구조 개편 + 어조/어감 정밀 조정 + 문법 교정을 한 번에 수행합니다.
고객이 수정본을 다시 가져오면 동일 수준으로 재첨삭합니다.
컨설턴트가 대신 쓸 수 없는 부분은 괄호로 질문형 메모를 남깁니다.
${trainingExamples ? '\n중요: 아래에 과거 컨설팅 사례가 제공됩니다. 이 사례들의 첨삭 패턴과 스타일을 정확히 학습하여 동일한 수준과 방향으로 첨삭해주세요. 특히 단어 선택, 어미 처리, 조사 사용, 수식어 절제 패턴을 일관되게 유지하세요.' : ''}
${trainingExamples}
반드시 아래 JSON 형식으로만 응답하세요:
{
  "revisedContent": "첨삭된 전체 자기소개서 텍스트",
  "comments": [
    {
      "originalText": "원본에서 수정한 부분",
      "revisedText": "수정된 텍스트",
      "reason": "수정 이유 설명",
      "category": "clarity|specificity|relevance|structure|expression|grammar"
    }
  ],
  "evaluation": {
    "specificity": 1-5,
    "logic": 1-5,
    "relevance": 1-5,
    "differentiation": 1-5,
    "expression": 1-5,
    "overall": "종합 평가 텍스트 (아래 형식으로 작성)"
  }
}

=== evaluation 작성 규칙 ===
각 항목 점수(1-5)를 매긴 후, overall에 다음을 포함하세요:

1. 각 항목별 현재 상태 진단 (왜 이 점수인지)
2. 각 항목별 점수를 올리기 위한 구체적 개선 방법
3. 고객이 직접 보완해야 할 내용 (AI가 대신 쓸 수 없는 부분)

overall 작성 예시:
"[구체성 3/5] 프로젝트 경험은 있으나 정량 성과가 부족합니다. '성능을 개선했습니다' → 구체적 수치(응답시간 몇 ms→몇 ms)를 추가하면 4점 이상 가능합니다.
[논리성 4/5] STAR 구조가 잘 갖춰져 있습니다. 다만 2번 문항의 '행동→결과' 연결이 약합니다. 어떤 행동이 어떤 결과로 이어졌는지 인과관계를 명확히 하세요.
[직무연관성 2/5] JD에서 요구하는 '데이터 분석' 역량이 자소서에 거의 드러나지 않습니다. 관련 경험이 있다면 추가하고, 마무리 문장에 JD 키워드를 반영하세요.
[차별성 3/5] 경험 자체는 독특하나, 표현이 일반적입니다. '저만의 KPI를 설정했다' 같은 고유한 행동을 부각하세요.
[표현력 3/5] 구어체 표현이 다수 남아있습니다. '잡는→해결하는', '느꼈고→배웠습니다' 등 격식체로 전환하세요."
${formatKnowhowForPrompt()}`;

  const userPrompt = `${REVISION_INSTRUCTION}

지원 회사: ${request.companyName}
지원 직무: ${request.position}
${request.jobPosting ? `\n공고 내용:\n${request.jobPosting}` : ''}
${request.clientMemo ? `\n컨설턴트 메모 (이 지원자의 특성):\n${request.clientMemo}` : ''}

--- 자기소개서 원문 ---
${request.originalContent}
--- 원문 끝 ---

위 자기소개서를 첨삭해주세요. 반드시 JSON 형식으로만 응답하세요.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI 응답에서 텍스트를 찾을 수 없습니다.');
  }

  let jsonStr = textBlock.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return JSON.parse(jsonStr);
}

// ===== 평가 전용 (첨삭 없이 평가만) =====

export interface EvaluationRequest {
  content: string;
  companyName: string;
  position: string;
  jobPosting?: string;
  originalContent?: string; // 원본 대비 비교 평가 시
}

function buildCalibrationExamples(companyName?: string, position?: string): string {
  const db = getDb();

  // 1. calibration_data 테이블에서 합격자소서 (산업군/회사 매칭 우선)
  let calibrations: any[] = [];

  // 같은 회사 합격자소서 우선
  if (companyName) {
    calibrations = db.prepare(`
      SELECT company_name, position, industry, content FROM calibration_data
      WHERE company_name LIKE ? ORDER BY created_at DESC LIMIT 2
    `).all(`%${companyName}%`);
  }

  // 부족하면 같은 산업군에서 보충
  if (calibrations.length < 3) {
    const more = db.prepare(`
      SELECT company_name, position, industry, content FROM calibration_data
      WHERE id NOT IN (${calibrations.map(() => '?').join(',') || '0'})
      ORDER BY created_at DESC LIMIT ?
    `).all(...calibrations.map((c: any) => c.id || 0), 3 - calibrations.length);
    calibrations = [...calibrations, ...more];
  }

  // 2. 학습 데이터의 final 버전도 포함
  const trainingFinals = db.prepare(`
    SELECT tc.company_name, tc.position, tc.direction_memo, tr.content
    FROM training_cases tc
    JOIN training_revisions tr ON tr.case_id = tc.id AND tr.stage = 'final'
    ORDER BY tc.created_at DESC LIMIT 2
  `).all() as any[];

  if (calibrations.length === 0 && trainingFinals.length === 0) return '';

  let examples = '\n\n=== 평가 기준 레퍼런스 (실제 합격/확정 자소서) ===\n';
  examples += '아래 사례들은 4~5점 수준입니다. 이 수준에 미치지 못하면 3점 이하로 평가하세요.\n';
  examples += '같은 업종/직무의 사례가 있으면 그 기준을 우선 적용하세요.\n';

  for (const c of calibrations) {
    examples += `\n--- [합격] ${c.company_name} ${c.position || ''} (${c.industry || '일반'}) ---\n`;
    examples += `${c.content.slice(0, 2000)}${c.content.length > 2000 ? '\n...(중략)' : ''}\n`;
  }

  for (const c of trainingFinals) {
    examples += `\n--- [확정] ${c.company_name || ''} ${c.position || ''} ---\n`;
    if (c.direction_memo) examples += `컨설팅 방향: ${c.direction_memo}\n`;
    examples += `${c.content.slice(0, 1500)}${c.content.length > 1500 ? '\n...(중략)' : ''}\n`;
  }

  examples += '\n=== 레퍼런스 끝 ===\n';
  return examples;
}

export async function performEvaluation(request: EvaluationRequest) {
  const anthropic = getClient();
  const calibration = buildCalibrationExamples(request.companyName, request.position);
  const styleProfile = loadStyleProfile();

  const systemPrompt = `당신은 자기소개서 평가 전문가입니다.
채용담당자 관점에서 자소서의 품질을 객관적으로 평가합니다.
${styleProfile}

=== 평가 기준 (루브릭) ===

[구체성] 경험과 성과의 구체적 서술 수준
  1점: 경험 언급 없이 추상적 서술만 ("열심히 했습니다")
  2점: 경험 있으나 수치/성과 전무 ("프로젝트를 진행했습니다")
  3점: 경험+부분 수치 있으나 Before→After 없음 ("매출이 증가했습니다")
  4점: 정량 성과 포함, 핵심 에피소드에 수치 있음 ("응답시간 9초→4초 단축")
  5점: 모든 에피소드에 정량 Before→After, STAR 구조 완비

[논리성] 문항 내 논리 흐름과 인과관계
  1점: 문장 간 연결 없음, 나열식
  2점: 시간순 나열이지만 인과관계 불명확
  3점: 기본 구조 있으나 행동→결과 연결이 약한 부분 존재
  4점: 문제→원인→해결→결과 흐름이 명확, 1-2곳 약함
  5점: 모든 문항이 탄탄한 인과구조, 읽는 사람이 자연스럽게 따라감

[직무연관성] JD 요구사항과의 매칭 정도
  1점: JD와 무관한 경험만 서술
  2점: JD 키워드 1-2개 언급하나 피상적
  3점: JD 관련 경험 있으나 마무리에 키워드 연결 부족
  4점: 소제목/도입부/마무리에 JD 키워드 반영, 1-2문항 약함
  5점: 모든 문항이 JD 키워드로 시작하고 끝남, 채용담당자가 즉시 매칭 가능

[차별성] 지원자만의 고유한 경험/관점
  1점: 누구나 쓸 수 있는 일반적 내용
  2점: 경험은 있으나 표현이 평범 ("소통 능력을 기르겠습니다")
  3점: 고유 경험 있으나 차별 포인트가 묻힘
  4점: 명확한 차별 포인트 1-2개, 고유 행동/KPI 언급
  5점: 읽자마자 "이 사람"이 각인됨, 대체 불가능한 경험 서술

[표현력] 문장 품질, 어조, 격식
  1점: 구어체, 맞춤법 오류 다수
  2점: 기본 격식 갖추나 감성적/추상적 표현 많음
  3점: 비즈니스 어조이나 수식어 과다, 문장 길이 불균형
  4점: 격식체 통일, 불필요 수식어 절제, 종결어미 일관
  5점: 한 글자도 고칠 데 없는 정밀한 표현, 직군별 어조 완벽
${calibration}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "specificity": 1-5,
  "logic": 1-5,
  "relevance": 1-5,
  "differentiation": 1-5,
  "expression": 1-5,
  "overall": "종합 평가 텍스트"
}

=== overall 작성 규칙 ===
각 항목별로 다음 형식으로 작성:
"[항목 점수/5] 현재 상태 진단. 구체적 개선 방법. (고객이 보완할 내용)"
${request.originalContent ? '\n원본 대비 개선/퇴보된 부분도 반드시 언급해주세요.' : ''}`;

  const userPrompt = `지원 회사: ${request.companyName}
지원 직무: ${request.position}
${request.jobPosting ? `\n공고 내용:\n${request.jobPosting}` : ''}
${request.originalContent ? `\n--- 원본 (첨삭 전) ---\n${request.originalContent}\n--- 원본 끝 ---\n` : ''}
--- 평가 대상 자기소개서 ---
${request.content}
--- 끝 ---

위 자기소개서를 루브릭 기준에 따라 평가해주세요. 반드시 JSON 형식으로만 응답하세요.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI 응답에서 텍스트를 찾을 수 없습니다.');
  }

  let jsonStr = textBlock.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  return JSON.parse(jsonStr);
}

// ===== 학습 데이터 패턴 분석 (저장 시 자동 실행) =====

export async function analyzeTrainingPattern(original: string, final: string): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `원본과 최종본을 비교하여 컨설턴트의 첨삭 패턴을 3줄 이내로 요약해주세요.

--- 원본 ---
${original.slice(0, 2000)}
--- 최종 ---
${final.slice(0, 2000)}

다음 형식으로 작성:
- 구조 변화: (예: 소제목 추가, 에피소드 축소)
- 어조 변화: (예: 감성→비즈니스, 구어→격식)
- 핵심 패턴: (예: JD 키워드 이식, 수치화)

텍스트로만 답하세요. JSON 아닙니다.`,
    }],
    system: '당신은 자기소개서 첨삭 패턴 분석가입니다. 원본과 최종본의 차이를 간결하게 요약합니다.',
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
}
