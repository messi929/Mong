import React from 'react';
import { diffWords } from 'diff';
import type { RevisionComment, QuestionDiagnostic } from '../../shared/types';

const CATEGORY_LABELS: Record<string, string> = {
  clarity: '명확성',
  specificity: '구체성',
  relevance: '연관성',
  structure: '구조',
  expression: '표현',
  grammar: '문법',
  enrichment: '각색',
};

interface DiffViewProps {
  original: string;
  revised: string;
  comments: RevisionComment[];
  diagnostics?: QuestionDiagnostic[];
}

export default function DiffView({ original, revised, comments, diagnostics }: DiffViewProps) {
  const diff = diffWords(original, revised);

  return (
    <div>
      {/* 문항별 전략 진단 */}
      {diagnostics && diagnostics.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-600)' }}>
            문항별 진단 ({diagnostics.length}개)
          </h4>
          {diagnostics.map((d, i) => (
            <div key={i} style={{
              padding: '12px 14px', marginBottom: '10px',
              background: 'var(--surface)', border: '1px solid var(--gray-200)',
              borderLeft: '3px solid var(--primary)', borderRadius: 'var(--radius)',
              fontSize: '13px', lineHeight: '1.6',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--gray-700)' }}>
                Q{d.questionIndex}. <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>{d.questionExcerpt}</span>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--gray-500)', fontSize: '11px', fontWeight: 600 }}>진단</span>
                <div style={{ color: 'var(--gray-700)' }}>{d.diagnosis}</div>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>재설계 방향</span>
                <div style={{ color: 'var(--gray-700)' }}>{d.redesignDirection}</div>
              </div>
              {d.preservedFromOriginal && (
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--gray-500)', fontSize: '11px', fontWeight: 600 }}>보존</span>
                  <div style={{ color: 'var(--gray-600)' }}>{d.preservedFromOriginal}</div>
                </div>
              )}
              {d.remainingGaps && d.remainingGaps !== '(없음)' && d.remainingGaps.trim() !== '' && (
                <div>
                  <span style={{ color: 'var(--warning, #d97706)', fontSize: '11px', fontWeight: 600 }}>고객 보완 필요</span>
                  <div style={{ color: 'var(--gray-700)' }}>{d.remainingGaps}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diff 표시 */}
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: '2', fontSize: '14px', marginBottom: '24px' }}>
        {diff.map((part, i) => {
          if (part.added) {
            return <span key={i} className="diff-added">{part.value}</span>;
          }
          if (part.removed) {
            return <span key={i} className="diff-removed">{part.value}</span>;
          }
          return <span key={i}>{part.value}</span>;
        })}
      </div>

      {/* 첨삭 코멘트 */}
      {comments.length > 0 && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-600)' }}>
            첨삭 코멘트 ({comments.length}개)
          </h4>
          {comments.map((comment, i) => (
            <div key={i} className="comment-bubble">
              <div className="category">{CATEGORY_LABELS[comment.category] || comment.category}</div>
              <div style={{ marginBottom: '4px' }}>
                <span className="diff-removed">{comment.originalText}</span>
                {' → '}
                <span className="diff-added">{comment.revisedText}</span>
              </div>
              <div style={{ color: 'var(--gray-600)' }}>{comment.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
