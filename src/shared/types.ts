// 고객 정보
export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  education?: string;        // 학력
  major?: string;            // 전공
  experience?: string;       // 경력사항
  targetIndustry?: string;   // 희망 산업군
  targetPosition?: string;   // 희망 직무
  memo?: string;             // 컨설턴트 메모
  createdAt: string;
  updatedAt: string;
}

// 첨삭 건 (회사별 자소서 단위)
export interface Consulting {
  id: number;
  clientId: number;
  companyName: string;       // 지원 회사명
  position: string;          // 지원 직무
  jobPosting?: string;       // 공고 내용
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  // join
  clientName?: string;
  // Phase 0 측정 지표
  editRatio?: number;        // first→final 변경률 (0.0-1.0)
  editBinary?: 0 | 1;        // 컨설턴트가 손댔는가
  activeTimeSeconds?: number;// 누적 작업 시간(초)
  outcome?: 'pending' | 'document_passed' | 'document_failed' | 'final_passed' | 'final_failed' | 'unknown';
  outcomeReceivedAt?: string;
}

// 첨삭 버전 (초안, 1차, 2차, 최종)
export interface Revision {
  id: number;
  consultingId: number;
  stage: 'draft' | 'first' | 'second' | 'final';
  content: string;           // 본문
  comments?: string;         // AI 첨삭 코멘트 (JSON)
  evaluation?: string;       // 종합 평가 (JSON)
  createdAt: string;
}

// AI 첨삭 요청
export interface RevisionRequest {
  consultingId: number;
  originalContent: string;
  stage: 'first' | 'second' | 'final';
  companyName: string;
  position: string;
  jobPosting?: string;
  clientMemo?: string;
}

// AI 첨삭 응답
export interface RevisionResponse {
  revisedContent: string;
  comments: RevisionComment[];
  evaluation: Evaluation;
}

// 개별 첨삭 코멘트
export interface RevisionComment {
  originalText: string;
  revisedText: string;
  reason: string;
  category: 'clarity' | 'specificity' | 'relevance' | 'structure' | 'expression' | 'grammar';
}

// 종합 평가
export interface Evaluation {
  specificity: number;       // 구체성 (1-5)
  logic: number;             // 논리성 (1-5)
  relevance: number;         // 직무연관성 (1-5)
  differentiation: number;   // 차별성 (1-5)
  expression: number;        // 표현력 (1-5)
  overall: string;           // 총평
}

// 대시보드 통계
export interface DashboardStats {
  totalClients: number;
  totalConsultings: number;
  inProgress: number;
  completed: number;
  thisMonthConsultings: number;
  recentConsultings: (Consulting & { clientName: string })[];
}

// 학습 데이터 사례
export interface TrainingCase {
  id: number;
  clientId?: number;
  title: string;             // 사례 제목
  companyName?: string;
  position?: string;
  directionMemo?: string;    // 이 사례의 첨삭 방향 메모
  createdAt: string;
  // join
  clientName?: string;
  revisionCount?: number;
}

// 학습 데이터 단계별 버전
export interface TrainingRevision {
  id: number;
  caseId: number;
  stage: 'draft' | 'first' | 'second' | 'final';
  content: string;
  createdAt: string;
}

// Stage 한글 매핑
export const STAGE_LABELS: Record<Revision['stage'], string> = {
  draft: '초안',
  first: '1차 첨삭',
  second: '2차 첨삭',
  final: '최종',
};

export const STATUS_LABELS: Record<Consulting['status'], string> = {
  draft: '초안',
  in_progress: '진행중',
  completed: '완료',
};

// 첨삭 결과 outcome (Phase 0 측정)
export type Outcome = 'pending' | 'document_passed' | 'document_failed' | 'final_passed' | 'final_failed' | 'unknown';

export const OUTCOME_LABELS: Record<Outcome, { label: string; color: string }> = {
  pending: { label: '결과 대기', color: 'var(--gray-400)' },
  document_passed: { label: '서류 통과', color: 'var(--primary)' },
  document_failed: { label: '서류 탈락', color: 'var(--danger)' },
  final_passed: { label: '최종 합격', color: 'var(--success)' },
  final_failed: { label: '최종 탈락', color: 'var(--danger)' },
  unknown: { label: '모름', color: 'var(--gray-300)' },
};

export const OUTCOME_OPTIONS: Array<{ value: Outcome; label: string }> = [
  { value: 'pending', label: '결과 대기' },
  { value: 'document_passed', label: '서류 통과' },
  { value: 'document_failed', label: '서류 탈락' },
  { value: 'final_passed', label: '최종 합격' },
  { value: 'final_failed', label: '최종 탈락' },
  { value: 'unknown', label: '모름' },
];
