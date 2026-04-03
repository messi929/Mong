import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../database';
import type { RevisionRequest, RevisionResponse } from '../../shared/types';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }
  return client;
}

export function setApiKey(apiKey: string) {
  client = new Anthropic({ apiKey });
}

const STAGE_LABELS: Record<string, string> = {
  draft: '초안',
  first: '1차 첨삭',
  second: '2차 첨삭',
  final: '최종',
};

// 단일 종합 첨삭 지시 — 매번 최종 수준의 전면 피드백 제공
const REVISION_INSTRUCTION = `자기소개서를 종합적으로 첨삭해주세요. 구조 개편부터 단어 하나하나의 어조까지 모두 수행합니다.

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

  // 고객별 사례 우선, 없으면 전체에서 가져오기
  let cases: any[] = [];
  if (clientId) {
    cases = db.prepare(`
      SELECT tc.* FROM training_cases tc
      WHERE tc.client_id = ?
      ORDER BY tc.created_at DESC LIMIT 3
    `).all(clientId);
  }

  // 고객별 사례가 없으면 전체에서
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

export async function performRevision(request: RevisionRequest & { clientId?: number }): Promise<RevisionResponse> {
  const anthropic = getClient();

  const trainingExamples = buildTrainingExamples(request.clientId);

  const systemPrompt = `당신은 대한민국 최고 수준의 자기소개서/이력서 컨설턴트입니다.
수백 명의 취업 컨설팅 경험을 바탕으로, 한 글자·한 단어의 어조와 어감까지 중시하는 정밀한 첨삭을 수행합니다.

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
[표현력 3/5] 구어체 표현이 다수 남아있습니다. '잡는→해결하는', '느꼈고→배웠습니다' 등 격식체로 전환하세요."`;

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

  try {
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    return JSON.parse(jsonStr) as RevisionResponse;
  } catch {
    throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
  }
}
