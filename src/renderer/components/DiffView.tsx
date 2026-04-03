import React from 'react';
import { diffWords } from 'diff';
import type { RevisionComment } from '../../shared/types';

const CATEGORY_LABELS: Record<string, string> = {
  clarity: '명확성',
  specificity: '구체성',
  relevance: '연관성',
  structure: '구조',
  expression: '표현',
  grammar: '문법',
};

interface DiffViewProps {
  original: string;
  revised: string;
  comments: RevisionComment[];
}

export default function DiffView({ original, revised, comments }: DiffViewProps) {
  const diff = diffWords(original, revised);

  return (
    <div>
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
