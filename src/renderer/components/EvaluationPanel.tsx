import React, { useState } from 'react';
import type { Evaluation } from '../../shared/types';

const EVAL_ITEMS: { key: keyof Omit<Evaluation, 'overall'>; label: string }[] = [
  { key: 'specificity', label: '구체성' },
  { key: 'logic', label: '논리성' },
  { key: 'relevance', label: '직무연관성' },
  { key: 'differentiation', label: '차별성' },
  { key: 'expression', label: '표현력' },
];

function Stars({ count }: { count: number }) {
  return (
    <span className="eval-stars">
      {'★'.repeat(Math.max(0, Math.min(5, count)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, count)))}
    </span>
  );
}

function ScoreDelta({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  if (diff === 0) return null;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '4px', color: diff > 0 ? 'var(--success)' : 'var(--danger)' }}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

interface Props {
  evaluation: Evaluation;
  beforeEvaluation?: Evaluation | null;
  isEvaluating?: boolean;
  overallEditable?: boolean;
  onOverallChange?: (text: string) => void;
}

export default function EvaluationPanel({ evaluation, beforeEvaluation, isEvaluating, overallEditable, onOverallChange }: Props) {
  const [editingOverall, setEditingOverall] = useState(false);
  const [overallText, setOverallText] = useState(evaluation.overall);

  const avg = EVAL_ITEMS.reduce((sum, item) => sum + (evaluation[item.key] as number), 0) / EVAL_ITEMS.length;
  const beforeAvg = beforeEvaluation
    ? EVAL_ITEMS.reduce((sum, item) => sum + (beforeEvaluation[item.key] as number), 0) / EVAL_ITEMS.length
    : null;

  const handleOverallSave = () => {
    setEditingOverall(false);
    onOverallChange?.(overallText);
  };

  // 평가 중 로딩 상태
  if (isEvaluating) {
    return (
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-700)' }}>
          평가 중...
        </h3>
        <div className="eval-loading">
          {EVAL_ITEMS.map((item) => (
            <div key={item.key} className="eval-item">
              <span className="eval-label">{item.label}</span>
              <div className="eval-shimmer" />
            </div>
          ))}
          <div style={{ marginTop: '16px' }}>
            <div className="eval-shimmer" style={{ height: '80px', borderRadius: 'var(--radius)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-700)' }}>
        {beforeEvaluation ? '최종 평가' : '종합 평가'}
      </h3>

      {/* 평균 점수 */}
      <div style={{
        textAlign: 'center', padding: '16px', background: 'var(--surface)',
        borderRadius: 'var(--radius)', marginBottom: '16px', border: '1px solid var(--gray-200)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '8px' }}>
          {beforeAvg !== null && (
            <span style={{ fontSize: '16px', color: 'var(--gray-400)', textDecoration: 'line-through' }}>
              {beforeAvg.toFixed(1)}
            </span>
          )}
          <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--primary)' }}>
            {avg.toFixed(1)}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>/ 5.0</div>
        {beforeAvg !== null && (
          <div style={{
            marginTop: '6px', fontSize: '12px', fontWeight: 600,
            color: avg > beforeAvg ? 'var(--success)' : avg < beforeAvg ? 'var(--danger)' : 'var(--gray-400)',
          }}>
            {avg > beforeAvg ? `+${(avg - beforeAvg).toFixed(1)} 개선` : avg < beforeAvg ? `${(avg - beforeAvg).toFixed(1)} 하락` : '동일'}
          </div>
        )}
      </div>

      {/* Before/After 라벨 */}
      {beforeEvaluation && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '4px', fontSize: '10px', color: 'var(--gray-400)' }}>
          <span>첨삭 전</span>
          <span>첨삭 후</span>
        </div>
      )}

      {/* 항목별 점수 */}
      {EVAL_ITEMS.map((item) => (
        <div key={item.key} className="eval-item">
          <span className="eval-label">{item.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {beforeEvaluation && (
              <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                {beforeEvaluation[item.key] as number}
              </span>
            )}
            <Stars count={evaluation[item.key] as number} />
            {beforeEvaluation && (
              <ScoreDelta before={beforeEvaluation[item.key] as number} after={evaluation[item.key] as number} />
            )}
          </div>
        </div>
      ))}

      {/* 총평 */}
      <div style={{
        marginTop: '16px', padding: '12px', background: 'var(--surface)',
        borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)',
        maxHeight: '400px', overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '8px',
        }}>
          <h4 style={{ fontSize: '12px', color: 'var(--gray-500)' }}>총평</h4>
          {overallEditable && !editingOverall && (
            <button
              className="btn btn-sm btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px' }}
              onClick={() => { setOverallText(evaluation.overall); setEditingOverall(true); }}
            >
              수정
            </button>
          )}
        </div>

        {editingOverall ? (
          <>
            <textarea
              value={overallText}
              onChange={(e) => setOverallText(e.target.value)}
              style={{ minHeight: '150px', fontSize: '13px', lineHeight: '1.6' }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingOverall(false)}>취소</button>
              <button className="btn btn-sm btn-primary" onClick={handleOverallSave}>적용</button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
            {evaluation.overall}
          </p>
        )}
      </div>
    </div>
  );
}
