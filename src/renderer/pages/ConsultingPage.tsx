import React, { useState, useRef, useEffect } from 'react';
import DiffView from '../components/DiffView';
import EvaluationPanel from '../components/EvaluationPanel';
import type { NavigationContext } from '../App';
import type { Client, RevisionResponse, RevisionComment, Evaluation } from '../../shared/types';

declare global {
  interface Window { api: any; }
}

type Phase = 'input' | 'review' | 'confirmed';

interface VersionEntry {
  type: 'original' | 'ai' | 'consultant' | 'confirmed';
  label: string;
  content: string;
  comments?: RevisionComment[];
  evaluation?: Evaluation;
  timestamp: string;
}

interface Props {
  nav: NavigationContext;
  clients: Client[];
  onClientsChange: () => void;
  initialClientId?: number;
  initialConsultingId?: number;
}

export default function ConsultingPage({ nav, clients, onClientsChange, initialClientId, initialConsultingId }: Props) {
  // ===== 고객/지원 정보 =====
  const [clientId, setClientId] = useState<number | undefined>(initialClientId);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');
  const [jobPosting, setJobPosting] = useState('');
  const [showJobPosting, setShowJobPosting] = useState(false);
  const [clientMemo, setClientMemo] = useState('');
  const [consultingMemo, setConsultingMemo] = useState('');

  // ===== 콘텐츠 =====
  const [originalContent, setOriginalContent] = useState('');
  const [revisedContent, setRevisedContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [comments, setComments] = useState<RevisionComment[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [beforeEvaluation, setBeforeEvaluation] = useState<Evaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ===== UI 상태 =====
  const [phase, setPhase] = useState<Phase>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'result' | 'edit'>('diff');
  const [showEval, setShowEval] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [consultingId, setConsultingId] = useState<number | undefined>();
  const [isSaved, setIsSaved] = useState(false);

  // ===== 버전 이력 =====
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedClient = clients.find(c => c.id === clientId);
  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.includes(clientSearch) || (c.targetIndustry || '').includes(clientSearch) || (c.targetPosition || '').includes(clientSearch))
    : clients;

  const hasEdits = editedContent.trim() !== '' && editedContent !== revisedContent;

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (selectedClient) setClientMemo(selectedClient.memo || '');
  }, [clientId]);

  // 과거 첨삭 이력 불러오기
  useEffect(() => {
    if (!initialConsultingId) return;
    (async () => {
      try {
        const consulting = await window.api.getConsulting(initialConsultingId);
        if (!consulting) return;
        setConsultingId(initialConsultingId);
        setClientId(consulting.clientId);
        setCompanyName(consulting.companyName);
        setPosition(consulting.position);
        if (consulting.jobPosting) { setJobPosting(consulting.jobPosting); setShowJobPosting(true); }

        const revisions = await window.api.getRevisions(initialConsultingId);
        if (revisions.length > 0) {
          const draft = revisions.find((r: any) => r.stage === 'draft');
          const final = revisions.find((r: any) => r.stage === 'final') || revisions.find((r: any) => r.stage === 'first');

          if (draft) {
            setOriginalContent(draft.content);
            addVersion('original', '원본', draft.content);
          }
          if (final) {
            setRevisedContent(final.content);
            setEditedContent(final.content);
            if (final.comments) {
              try { setComments(JSON.parse(final.comments)); } catch {}
            }
            if (final.evaluation) {
              try { setEvaluation(JSON.parse(final.evaluation)); setShowEval(true); } catch {}
            }
            addVersion('ai', 'AI 첨삭', final.content,
              final.comments ? JSON.parse(final.comments) : undefined,
              final.evaluation ? JSON.parse(final.evaluation) : undefined);
            setPhase('review');
          }

          // 컨설턴트 수정본
          const consultant = revisions.find((r: any) => r.stage === 'second');
          if (consultant) {
            addVersion('consultant', '컨설턴트 수정', consultant.content);
            setEditedContent(consultant.content);
          }

          setIsSaved(true);
          showSuccess('이전 첨삭 이력을 불러왔습니다.');
        }
      } catch (err: any) {
        showError('이력 불러오기 실패: ' + (err.message || ''));
      }
    })();
  }, [initialConsultingId]);

  // ===== 메시지 =====
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 3000); };
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  // ===== 파일 처리 =====
  const handleFileUpload = async () => {
    try {
      const filePath = await window.api.openFile();
      if (filePath) { const text = await window.api.parseFile(filePath); setOriginalContent(text); }
    } catch (err: any) { showError(err.message || '파일을 열 수 없습니다.'); }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    try {
      const filePath = window.api.getPathForFile(files[0]);
      if (filePath) { const text = await window.api.parseFile(filePath); setOriginalContent(text); }
    } catch (err: any) { showError(err.message || '파일을 열 수 없습니다.'); }
  };

  const handleRightFileUpload = async () => {
    try {
      const filePath = await window.api.openFile();
      if (filePath) { const text = await window.api.parseFile(filePath); setEditedContent(text); setViewMode('edit'); }
    } catch (err: any) { showError(err.message || '파일을 열 수 없습니다.'); }
  };

  const handleRightDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!revisedContent) return;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    try {
      const filePath = window.api.getPathForFile(files[0]);
      if (filePath) { const text = await window.api.parseFile(filePath); setEditedContent(text); setViewMode('edit'); }
    } catch (err: any) { showError(err.message || '파일을 열 수 없습니다.'); }
  };

  // ===== 고객 생성 (인라인) =====
  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const id = await window.api.createClient({ name: newClientName, targetIndustry: '', targetPosition: position || '' });
      await onClientsChange();
      setClientId(id); setNewClientName(''); setShowNewClient(false); setShowClientDropdown(false);
      showSuccess(`"${newClientName}" 고객이 등록되었습니다.`);
    } catch { showError('고객 생성 실패'); }
  };

  // ===== 버전 추가 =====
  const addVersion = (type: VersionEntry['type'], label: string, content: string, cmt?: RevisionComment[], ev?: Evaluation) => {
    const entry: VersionEntry = { type, label, content, comments: cmt, evaluation: ev, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
    setVersions(prev => { const next = [...prev, entry]; setActiveVersion(next.length - 1); return next; });
  };

  // ===== AI 첨삭 (최초 or 재첨삭) =====
  const handleRevise = async (contentOverride?: string) => {
    if (!originalContent.trim() && !contentOverride) { showError('자기소개서를 입력해주세요.'); return; }
    if (!companyName.trim() || !position.trim()) { showError('회사명과 직무를 입력해주세요.'); return; }

    setIsLoading(true); setErrorMsg('');

    try {
      const contentToRevise = contentOverride || originalContent;

      // 첫 첨삭 시 원본 기록
      if (versions.length === 0) addVersion('original', '원본', originalContent);

      const result: RevisionResponse = await window.api.requestRevision({
        originalContent: contentToRevise, stage: 'first',
        companyName, position, jobPosting, clientMemo, clientId,
      });

      setRevisedContent(result.revisedContent);
      setEditedContent(result.revisedContent);
      setComments(result.comments);
      setEvaluation(result.evaluation);
      setShowEval(true);
      setViewMode('diff');
      setPhase('review');
      setIsSaved(false);

      addVersion('ai', 'AI 첨삭', result.revisedContent, result.comments, result.evaluation);
    } catch (err: any) {
      showError(err.message || '첨삭에 실패했습니다.');
    } finally { setIsLoading(false); }
  };

  // ===== 확정: 현재 내용을 최종으로 + 재평가 =====
  const handleConfirm = async () => {
    const finalContent = hasEdits ? editedContent : revisedContent;

    if (hasEdits) {
      addVersion('consultant', '컨설턴트 수정', editedContent);
    }
    addVersion('confirmed', '최종 확정', finalContent);

    setPhase('confirmed');
    setViewMode('result');
    setRevisedContent(finalContent);
    setEditedContent(finalContent);
    setShowEval(true);

    // 최종본 재평가 (원본 대비)
    setBeforeEvaluation(evaluation); // 기존 AI 평가를 "before"로
    setIsEvaluating(true);
    try {
      const origContent = versions.find(v => v.type === 'original')?.content || originalContent;
      const result = await window.api.requestEvaluation({
        content: finalContent,
        companyName,
        position,
        jobPosting,
        originalContent: origContent,
      });
      setEvaluation(result);
      showSuccess('확정 + 재평가 완료. "저장"을 눌러 이력에 기록하세요.');
    } catch (err: any) {
      showSuccess('확정되었습니다. (재평가 실패 — 기존 평가를 유지합니다)');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ===== AI 재첨삭 요청: 수정본을 AI에게 다시 =====
  const handleReRevise = () => {
    if (!hasEdits) { showError('수정한 내용이 없습니다. 먼저 내용을 수정해주세요.'); return; }
    addVersion('consultant', '컨설턴트 수정', editedContent);
    setOriginalContent(editedContent); // diff 기준을 수정본으로
    handleRevise(editedContent);
  };

  // ===== 저장 =====
  const handleSave = async () => {
    if (!clientId) { showError('고객을 선택하거나 새로 등록해주세요.'); return; }
    if (!companyName.trim() || !position.trim()) { showError('회사명과 직무를 입력해주세요.'); return; }

    try {
      let cId = consultingId;
      if (!cId) {
        cId = await window.api.createConsulting({
          clientId, companyName, position, jobPosting, status: phase === 'confirmed' ? 'completed' : 'in_progress',
        });
        setConsultingId(cId);
      }

      const original = versions.find(v => v.type === 'original');
      const confirmed = versions.filter(v => v.type === 'confirmed').pop();
      const lastAi = versions.filter(v => v.type === 'ai').pop();

      // 원본 저장
      if (original) {
        await window.api.createRevision({ consultingId: cId, stage: 'draft', content: original.content });
      }

      // 최종 확정본 저장
      const finalContent = confirmed?.content || editedContent || revisedContent;
      const finalStage = phase === 'confirmed' ? 'final' : 'first';
      await window.api.createRevision({
        consultingId: cId, stage: finalStage, content: finalContent,
        comments: lastAi?.comments, evaluation: lastAi?.evaluation,
      });

      // 학습 데이터 저장 (원본 → 최종 확정본) — AI 결과든 컨설턴트 수정이든 확정된 건 모두 학습
      if (original) {
        const hasConsultantVersion = versions.some(v => v.type === 'consultant');
        const memoText = consultingMemo
          || (hasConsultantVersion ? '컨설턴트 수정 후 확정' : 'AI 첨삭 결과 확정');
        const trainingCaseId = await window.api.createTrainingCase({
          clientId, title: `${companyName} ${position}`, companyName, position,
          directionMemo: memoText,
        });
        await window.api.saveTrainingRevision({ caseId: trainingCaseId, stage: 'draft', content: original.content });
        await window.api.saveTrainingRevision({ caseId: trainingCaseId, stage: 'final', content: finalContent });

        // 패턴 분석 (비동기, 저장 후 백그라운드)
        window.api.analyzePattern({ original: original.content, final: finalContent })
          .then((res: any) => { if (res?.pattern) showSuccess('패턴 분석 완료: ' + res.pattern.slice(0, 80) + '...'); })
          .catch(() => {});
      }

      setIsSaved(true);
      showSuccess('저장 완료! 고객 이력에서 확인할 수 있습니다.');
    } catch (err: any) { showError('저장 실패: ' + (err.message || '')); }
  };

  // ===== 초기화 =====
  const handleClear = () => {
    setOriginalContent(''); setRevisedContent(''); setEditedContent('');
    setComments([]); setEvaluation(null); setBeforeEvaluation(null); setIsEvaluating(false);
    setCompanyName(''); setPosition(''); setJobPosting(''); setClientMemo(''); setConsultingMemo('');
    setShowEval(false); setViewMode('diff'); setPhase('input');
    setErrorMsg(''); setSuccessMsg('');
    setVersions([]); setActiveVersion(-1);
    setConsultingId(undefined); setClientId(undefined);
    setIsSaved(false); setShowJobPosting(false);
  };

  // ===== 버전 클릭 =====
  const handleVersionClick = (idx: number) => {
    const v = versions[idx];
    setActiveVersion(idx);
    if (v.type === 'ai') {
      setRevisedContent(v.content); setEditedContent(v.content);
      if (v.comments) setComments(v.comments);
      if (v.evaluation) { setEvaluation(v.evaluation); setShowEval(true); }
      setViewMode('diff');
    } else if (v.type === 'consultant' || v.type === 'confirmed') {
      setEditedContent(v.content);
      setViewMode(v.type === 'confirmed' ? 'result' : 'edit');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ===== 상단 정보바 ===== */}
      <div className="info-bar">
        <div className="info-bar-group" ref={dropdownRef} style={{ position: 'relative', minWidth: '200px' }}>
          <div className="client-selector" onClick={() => setShowClientDropdown(!showClientDropdown)}>
            <span className="client-selector-icon">&#128100;</span>
            <span>{selectedClient ? selectedClient.name : '고객 선택'}</span>
            <span className="client-selector-arrow">&#9662;</span>
          </div>
          {showClientDropdown && (
            <div className="dropdown-menu">
              <input className="dropdown-search" placeholder="이름 검색..." value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus />
              <div className="dropdown-items">
                {filteredClients.map(c => (
                  <div key={c.id} className={`dropdown-item ${c.id === clientId ? 'active' : ''}`}
                    onClick={() => { setClientId(c.id); setShowClientDropdown(false); setClientSearch(''); }}>
                    <span className="dropdown-item-name">{c.name}</span>
                    <span className="dropdown-item-meta">{[c.targetIndustry, c.targetPosition].filter(Boolean).join(' / ')}</span>
                  </div>
                ))}
                {filteredClients.length === 0 && !showNewClient && <div className="dropdown-empty">일치하는 고객이 없습니다</div>}
              </div>
              <div className="dropdown-footer">
                {!showNewClient ? (
                  <button className="btn btn-sm btn-primary" style={{ width: '100%' }}
                    onClick={(e) => { e.stopPropagation(); setShowNewClient(true); setNewClientName(clientSearch); }}>+ 새 고객 등록</button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <input placeholder="고객 이름" value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()} autoFocus style={{ flex: 1 }} />
                    <button className="btn btn-sm btn-primary" onClick={handleCreateClient}>등록</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setShowNewClient(false)}>취소</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <input className="info-bar-input" placeholder="회사명 *" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
          style={errorMsg.includes('회사') ? { borderColor: 'var(--danger)' } : {}} />
        <input className="info-bar-input" placeholder="직무 *" value={position} onChange={(e) => setPosition(e.target.value)}
          style={errorMsg.includes('직무') ? { borderColor: 'var(--danger)' } : {}} />
        <button className={`btn btn-sm ${showJobPosting ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowJobPosting(!showJobPosting)}>공고 {showJobPosting ? '▲' : '▼'}</button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {selectedClient && (
            <button className="btn btn-sm btn-secondary" onClick={() => nav.goToClients(clientId)}>고객 정보</button>
          )}
          {phase !== 'input' && (
            <>
              <button className={`btn btn-sm ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleSave} disabled={isSaved}>{isSaved ? '저장됨' : '저장'}</button>
              <button className="btn btn-sm btn-secondary" onClick={handleClear}>새로 시작</button>
            </>
          )}
        </div>
      </div>

      {showJobPosting && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
          <textarea placeholder="공고(JD) 내용을 붙여넣으세요" value={jobPosting}
            onChange={(e) => setJobPosting(e.target.value)} style={{ minHeight: '80px', fontSize: '13px' }} />
        </div>
      )}

      {(errorMsg || successMsg) && (
        <div className={`msg-bar ${errorMsg ? 'msg-error' : 'msg-success'}`}>
          {errorMsg || successMsg}
          <button onClick={() => { setErrorMsg(''); setSuccessMsg(''); }} className="msg-close">&times;</button>
        </div>
      )}

      {/* ===== 메인 영역 ===== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="split-panel" style={{ flex: 1 }}>
          {/* ===== 좌측: 원본 ===== */}
          <div className="panel">
            <div className="panel-header">
              <h3>원본 자기소개서</h3>
              <button className="btn btn-secondary btn-sm" onClick={handleFileUpload}>파일 업로드</button>
            </div>
            <div className="panel-body" onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}>
              {!originalContent && (
                <div className={`drop-zone${isDragging ? ' active' : ''}`} onClick={handleFileUpload}>
                  <p style={{ fontSize: '15px', marginBottom: '6px' }}>{isDragging ? '여기에 놓으세요!' : '파일 드래그 또는 클릭'}</p>
                  <p style={{ fontSize: '12px' }}>PDF, Word, HWP, 텍스트 지원</p>
                </div>
              )}
              <textarea className="content-textarea" placeholder="자기소개서를 입력하세요..."
                value={originalContent} onChange={(e) => setOriginalContent(e.target.value)}
                onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                style={{ marginTop: originalContent ? 0 : '12px' }} />
            </div>

            {/* 좌측 하단: 최초 첨삭 버튼만 */}
            {phase === 'input' && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray-200)', textAlign: 'center' }}>
                <button className="btn btn-primary" onClick={() => handleRevise()}
                  disabled={isLoading || !originalContent.trim()}
                  style={{ width: '180px', height: '38px', fontSize: '14px' }}>
                  {isLoading ? <><span className="spinner" style={{ width: '14px', height: '14px' }} /> 첨삭 중...</> : '첨삭 시작'}
                </button>
              </div>
            )}
          </div>

          {/* ===== 우측: 결과 + 액션 ===== */}
          <div className="panel" onDrop={handleRightDrop} onDragOver={(e) => e.preventDefault()}>
            <div className="panel-header">
              <h3>{viewMode === 'edit' ? '수정 중' : phase === 'confirmed' ? '최종 확정본' : '첨삭 결과'}</h3>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {revisedContent && (
                  <>
                    <div className="stage-tabs">
                      <button className={`stage-tab ${viewMode === 'diff' ? 'active' : ''}`} onClick={() => setViewMode('diff')}>비교</button>
                      <button className={`stage-tab ${viewMode === 'result' ? 'active' : ''}`} onClick={() => setViewMode('result')}>결과</button>
                      <button className={`stage-tab ${viewMode === 'edit' ? 'active' : ''}`}
                        onClick={() => { if (!editedContent) setEditedContent(revisedContent); setViewMode('edit'); }}>수정</button>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleRightFileUpload}>파일</button>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => navigator.clipboard.writeText(viewMode === 'edit' ? editedContent : revisedContent)}>복사</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      const content = viewMode === 'edit' ? editedContent : revisedContent;
                      window.api.exportWord({ content, fileName: `${companyName} ${position}` });
                    }}>내보내기</button>
                    <button className={`btn btn-sm ${showEval ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setShowEval(!showEval)}>평가</button>
                  </>
                )}
              </div>
            </div>

            <div className="panel-body">
              {isLoading ? (
                <div className="loading"><span className="spinner" />AI가 분석 중입니다...</div>
              ) : !revisedContent ? (
                <div className="empty-state">
                  <h3>첨삭 결과가 여기에 표시됩니다</h3>
                  <p>좌측에 자기소개서를 입력하고 '첨삭 시작'을 눌러주세요.</p>
                </div>
              ) : viewMode === 'diff' ? (
                <DiffView original={originalContent} revised={revisedContent} comments={comments} />
              ) : viewMode === 'edit' ? (
                <textarea className="content-textarea" value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="내용을 수정하세요. 수정 파일을 드래그해도 됩니다."
                  style={{ minHeight: '100%' }} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '14px' }}>{phase === 'confirmed' ? editedContent : revisedContent}</div>
              )}
            </div>

            {/* ===== 우측 하단: 액션 바 ===== */}
            {revisedContent && phase === 'review' && !isLoading && (
              <div className="action-bar">
                {viewMode === 'edit' ? (
                  // 수정 모드
                  <>
                    <div className="action-bar-status">
                      {hasEdits ? (
                        <span className="action-status-edited">수정됨</span>
                      ) : (
                        <span className="action-status-hint">내용을 수정하거나 파일을 드래그하세요</span>
                      )}
                    </div>
                    <div className="action-bar-buttons">
                      <button className="btn btn-primary" onClick={handleConfirm}>
                        {hasEdits ? '수정본으로 확정' : '이대로 확정'}
                      </button>
                      {hasEdits && (
                        <button className="btn btn-secondary" onClick={handleReRevise}>
                          AI 재첨삭 요청
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  // 비교/결과 모드
                  <>
                    <div className="action-bar-status">
                      <span className="action-status-hint">결과를 검토하세요. 수정이 필요하면 '수정' 탭을 누르세요.</span>
                    </div>
                    <div className="action-bar-buttons">
                      <button className="btn btn-primary" onClick={handleConfirm}>이대로 확정</button>
                      <button className="btn btn-secondary"
                        onClick={() => { if (!editedContent) setEditedContent(revisedContent); setViewMode('edit'); }}>
                        수정하기
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 확정 후: 컨설팅 메모 입력 */}
            {phase === 'confirmed' && (
              <div className="action-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <input
                  placeholder="컨설팅 방향 메모 (예: JD 키워드 이식 중심, 금융 어조 적용)"
                  value={consultingMemo}
                  onChange={(e) => setConsultingMemo(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {isSaved ? '저장 완료' : '확정 완료 — "저장"을 눌러 이력에 기록하세요'}
                  </span>
                  {!isSaved && (
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      // 확정 버전을 이력에서 제거
                      setVersions(prev => prev.filter(v => v.type !== 'confirmed'));
                      setPhase('review');
                      setViewMode('edit');
                      showSuccess('확정 해제됨. 수정을 계속하세요.');
                    }}>
                      확정 해제
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {showEval && evaluation && (
          <div className="eval-panel" style={{ width: '280px' }}>
            <EvaluationPanel
              evaluation={evaluation}
              beforeEvaluation={beforeEvaluation}
              isEvaluating={isEvaluating}
              overallEditable={phase === 'confirmed'}
              onOverallChange={(text) => setEvaluation(prev => prev ? { ...prev, overall: text } : prev)}
            />
          </div>
        )}
      </div>

      {/* ===== 하단 버전 타임라인 ===== */}
      {versions.length > 0 && (
        <div className="version-timeline">
          <div className="version-timeline-label">이력</div>
          <div className="version-timeline-items">
            {versions.map((v, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="version-arrow">&#8594;</span>}
                <button className={`version-chip ${v.type} ${i === activeVersion ? 'active' : ''}`}
                  onClick={() => handleVersionClick(i)} title={`${v.timestamp} — ${v.label}`}>
                  <span className="version-chip-icon">
                    {v.type === 'original' ? '&#128196;' : v.type === 'ai' ? '&#9889;' : v.type === 'confirmed' ? '&#10003;' : '&#9998;'}
                  </span>
                  {v.label}
                  <span className="version-chip-time">{v.timestamp}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
