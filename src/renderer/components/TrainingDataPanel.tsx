import React, { useState, useEffect } from 'react';
import type { TrainingCase, TrainingRevision } from '../../shared/types';

const STAGES = [
  { value: 'draft', label: '초안' },
  { value: 'first', label: '1차 첨삭' },
  { value: 'second', label: '2차 첨삭' },
  { value: 'final', label: '최종' },
] as const;

interface Props {
  clientId: number;
  clientName: string;
}

export default function TrainingDataPanel({ clientId, clientName }: Props) {
  const [cases, setCases] = useState<TrainingCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<TrainingCase | null>(null);
  const [revisions, setRevisions] = useState<TrainingRevision[]>([]);
  const [showNewCase, setShowNewCase] = useState(false);
  const [activeStage, setActiveStage] = useState<string>('draft');
  const [stageContent, setStageContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', companyName: '', position: '', directionMemo: '' });

  useEffect(() => {
    loadCases();
  }, [clientId]);

  const loadCases = async () => {
    const data = await window.api.getTrainingCases(clientId);
    setCases(data);
  };

  const handleCreateCase = async () => {
    if (!newCase.title.trim()) {
      alert('사례 제목을 입력해주세요.');
      return;
    }
    await window.api.createTrainingCase({ ...newCase, clientId });
    setNewCase({ title: '', companyName: '', position: '', directionMemo: '' });
    setShowNewCase(false);
    loadCases();
  };

  const handleSelectCase = async (tc: TrainingCase) => {
    setSelectedCase(tc);
    const revs = await window.api.getTrainingRevisions(tc.id);
    setRevisions(revs);
    setActiveStage('draft');
    const draftRev = revs.find((r: TrainingRevision) => r.stage === 'draft');
    setStageContent(draftRev?.content || '');
  };

  const handleStageChange = (stage: string) => {
    setActiveStage(stage);
    const rev = revisions.find((r) => r.stage === stage);
    setStageContent(rev?.content || '');
  };

  const handleSaveRevision = async () => {
    if (!selectedCase || !stageContent.trim()) return;
    setIsSaving(true);
    try {
      await window.api.saveTrainingRevision({
        caseId: selectedCase.id,
        stage: activeStage,
        content: stageContent,
      });
      const revs = await window.api.getTrainingRevisions(selectedCase.id);
      setRevisions(revs);
      loadCases();
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async () => {
    try {
      const filePath = await window.api.openFile();
      if (filePath) {
        const text = await window.api.parseFile(filePath);
        setStageContent(text);
      }
    } catch (err: any) {
      alert(err.message || '파일을 열 수 없습니다.');
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (confirm('이 학습 사례를 삭제하시겠습니까?')) {
      await window.api.deleteTrainingCase(id);
      if (selectedCase?.id === id) {
        setSelectedCase(null);
        setRevisions([]);
      }
      loadCases();
    }
  };

  const getStageStatus = (stage: string) => {
    return revisions.some((r) => r.stage === stage);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
          학습 데이터 ({cases.length}건)
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewCase(true)}>
          + 사례 추가
        </button>
      </div>

      {/* 새 사례 입력 폼 */}
      {showNewCase && (
        <div style={{
          padding: '16px',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius)',
          marginBottom: '16px',
          border: '1px solid var(--gray-200)',
        }}>
          <div className="form-grid">
            <div className="form-group">
              <label>사례 제목 *</label>
              <input
                value={newCase.title}
                onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                placeholder="예: 삼성전자 마케팅 자소서"
              />
            </div>
            <div className="form-group">
              <label>회사명</label>
              <input
                value={newCase.companyName}
                onChange={(e) => setNewCase({ ...newCase, companyName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>직무</label>
              <input
                value={newCase.position}
                onChange={(e) => setNewCase({ ...newCase, position: e.target.value })}
              />
            </div>
            <div className="form-group full-width">
              <label>첨삭 방향 메모</label>
              <textarea
                value={newCase.directionMemo}
                onChange={(e) => setNewCase({ ...newCase, directionMemo: e.target.value })}
                placeholder="이 고객의 첨삭 방향, 주의사항, 강점/약점 등"
                rows={2}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewCase(false)}>취소</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreateCase}>저장</button>
          </div>
        </div>
      )}

      {/* 사례 목록 */}
      {cases.length === 0 && !showNewCase ? (
        <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
          학습 데이터가 없습니다. 과거 첨삭 사례를 추가하면 AI가 {clientName}님의 특성에 맞는 첨삭을 제공합니다.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* 사례 리스트 */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            {cases.map((tc) => (
              <div
                key={tc.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: selectedCase?.id === tc.id ? 'var(--primary-light)' : 'transparent',
                  border: selectedCase?.id === tc.id ? '1px solid var(--primary)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onClick={() => handleSelectCase(tc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{tc.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
                      {[tc.companyName, tc.position].filter(Boolean).join(' / ')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                      {tc.revisionCount || 0}개 단계 등록
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--danger)' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteCase(tc.id); }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 단계별 입력 */}
          {selectedCase && (
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  {selectedCase.title}
                </div>
                {selectedCase.directionMemo && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--gray-600)',
                    background: 'var(--warning-light)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius)',
                    marginBottom: '8px',
                  }}>
                    {selectedCase.directionMemo}
                  </div>
                )}
              </div>

              {/* 단계 탭 */}
              <div className="stage-tabs" style={{ marginBottom: '12px' }}>
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    className={`stage-tab ${activeStage === s.value ? 'active' : ''}`}
                    onClick={() => handleStageChange(s.value)}
                    style={{ position: 'relative' }}
                  >
                    {s.label}
                    {getStageStatus(s.value) && (
                      <span style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--success)',
                        marginLeft: '4px',
                        verticalAlign: 'middle',
                      }} />
                    )}
                  </button>
                ))}
              </div>

              {/* 내용 입력 */}
              <div style={{ position: 'relative' }}>
                <textarea
                  value={stageContent}
                  onChange={(e) => setStageContent(e.target.value)}
                  placeholder={`${STAGES.find((s) => s.value === activeStage)?.label} 내용을 입력하거나 파일을 업로드하세요...`}
                  style={{ minHeight: '200px', fontSize: '13px', lineHeight: '1.8' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleFileUpload}>
                    파일 업로드
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveRevision}
                    disabled={isSaving || !stageContent.trim()}
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
