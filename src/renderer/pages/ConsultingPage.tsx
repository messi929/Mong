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

interface RevisionIds {
  draft?: number;
  first?: number;
  second?: number;
  final?: number;
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
  const [aiInputContent, setAiInputContent] = useState(''); // 가장 최근 AI 입력 — diff 기준
  const [revisedContent, setRevisedContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [comments, setComments] = useState<RevisionComment[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [beforeEvaluation, setBeforeEvaluation] = useState<Evaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ===== UI/저장 상태 =====
  const [phase, setPhase] = useState<Phase>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'result' | 'edit'>('diff');
  const [showEval, setShowEval] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [consultingId, setConsultingId] = useState<number | undefined>();
  const [revisionIds, setRevisionIds] = useState<RevisionIds>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ===== 학습 등록 =====
  const [addToTraining, setAddToTraining] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // ===== 버전 이력 =====
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [activeVersion, setActiveVersion] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  // active time 추적: 첫 활동 후부터, 2분 idle 임계 적용
  const lastActivityRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  const pendingActiveDeltaRef = useRef<number>(0);
  // setState는 비동기라 같은 콜백 내 후속 호출에서 최신 값을 못 봄.
  // ensureConsulting → saveRevisionStage 경로에서 race를 막기 위해 ref로 즉시 동기화.
  const consultingIdRef = useRef<number | undefined>(undefined);
  const revisionIdsRef = useRef<RevisionIds>({});

  const selectedClient = clients.find(c => c.id === clientId);
  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.includes(clientSearch) || (c.targetIndustry || '').includes(clientSearch) || (c.targetPosition || '').includes(clientSearch))
    : clients;

  const hasEdits = editedContent.trim() !== '' && editedContent !== revisedContent;
  const hasConsultantEdit = versions.some(v => v.type === 'consultant');
  const diffOriginal = aiInputContent || originalContent;

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // active time 추적: 첫 활동 후부터 10초마다 누적, 마지막 활동에서 2분 넘게 지났으면 idle로 제외
  useEffect(() => {
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true } as any));

    const tick = setInterval(() => {
      const now = Date.now();
      if (lastActivityRef.current !== null) {
        const sinceActivity = now - lastActivityRef.current;
        if (sinceActivity < 120_000) {
          pendingActiveDeltaRef.current += (now - lastTickRef.current) / 1000;
        }
      }
      lastTickRef.current = now;
    }, 10_000);

    return () => {
      clearInterval(tick);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, []);

  // 60초마다 누적 active time을 서버로 flush (필드 변경 없을 때 백업)
  useEffect(() => {
    if (!consultingId) return;
    const interval = setInterval(async () => {
      const delta = pendingActiveDeltaRef.current;
      if (delta < 30) return;
      pendingActiveDeltaRef.current = 0;
      try {
        await window.api.updateConsulting(consultingId, { addActiveSeconds: delta });
      } catch {
        pendingActiveDeltaRef.current += delta;
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [consultingId]);

  useEffect(() => {
    if (selectedClient) setClientMemo(selectedClient.memo || '');
  }, [clientId]);

  // ref 동기화 (state 변경 시 즉시 반영)
  useEffect(() => { consultingIdRef.current = consultingId; }, [consultingId]);
  useEffect(() => { revisionIdsRef.current = revisionIds; }, [revisionIds]);

  // 새 첨삭 시작 시 client.targetPosition 자동 채움 (기존 컨설팅 로드 아닐 때만, 1회성)
  useEffect(() => {
    if (initialConsultingId) return;
    if (!selectedClient) return;
    if (position.trim()) return;
    if (selectedClient.targetPosition) setPosition(selectedClient.targetPosition);
  }, [selectedClient, initialConsultingId]);

  // 과거 첨삭 이력 불러오기
  useEffect(() => {
    if (!initialConsultingId) return;
    (async () => {
      try {
        const consulting = await window.api.getConsulting(initialConsultingId);
        if (!consulting) return;
        consultingIdRef.current = initialConsultingId;
        setConsultingId(initialConsultingId);
        setClientId(consulting.clientId);
        setCompanyName(consulting.companyName);
        setPosition(consulting.position);
        if (consulting.jobPosting) { setJobPosting(consulting.jobPosting); setShowJobPosting(true); }

        const revisions = await window.api.getRevisions(initialConsultingId);
        if (revisions.length > 0) {
          const draft = revisions.find((r: any) => r.stage === 'draft');
          const firsts = revisions.filter((r: any) => r.stage === 'first');
          const lastFirst = firsts.length > 0 ? firsts[firsts.length - 1] : undefined;
          const seconds = revisions.filter((r: any) => r.stage === 'second');
          const lastSecond = seconds.length > 0 ? seconds[seconds.length - 1] : undefined;
          const final = revisions.find((r: any) => r.stage === 'final');

          const ids: RevisionIds = {};
          if (draft) ids.draft = draft.id;
          if (lastFirst) ids.first = lastFirst.id;
          if (lastSecond) ids.second = lastSecond.id;
          if (final) ids.final = final.id;
          revisionIdsRef.current = ids;
          setRevisionIds(ids);

          if (draft) {
            setOriginalContent(draft.content);
            setAiInputContent(draft.content);
            addVersion('original', '원본', draft.content);
          }
          if (lastFirst) {
            const cmt = lastFirst.comments ? safeParse(lastFirst.comments) : undefined;
            const ev = lastFirst.evaluation ? safeParse(lastFirst.evaluation) : undefined;
            setRevisedContent(lastFirst.content);
            setEditedContent(lastFirst.content);
            if (cmt) setComments(cmt);
            if (ev) { setEvaluation(ev); setShowEval(true); }
            addVersion('ai', 'AI 첨삭', lastFirst.content, cmt, ev);
            setPhase('review');
          }
          if (lastSecond) {
            setEditedContent(lastSecond.content);
            addVersion('consultant', '컨설턴트 수정', lastSecond.content);
          }
          if (final) {
            setEditedContent(final.content);
            setRevisedContent(final.content);
            addVersion('confirmed', '최종 확정', final.content);
            setPhase('confirmed');
            setViewMode('result');
          }

          setAutoSaveStatus('saved');
          showSuccess('이전 첨삭 이력을 불러왔습니다.');
        }
      } catch (err: any) {
        showError('이력 불러오기 실패: ' + (err.message || ''));
      }
    })();
  }, [initialConsultingId]);

  // 컨설팅 필드 변경 → 디바운스 저장 (active time 델타 동봉)
  useEffect(() => {
    if (!consultingId) return;
    const t = setTimeout(async () => {
      const delta = pendingActiveDeltaRef.current;
      pendingActiveDeltaRef.current = 0;
      try {
        setAutoSaveStatus('saving');
        const payload: any = { companyName, position, jobPosting };
        if (delta > 0) payload.addActiveSeconds = delta;
        await window.api.updateConsulting(consultingId, payload);
        setAutoSaveStatus('saved');
      } catch {
        pendingActiveDeltaRef.current += delta;
        setAutoSaveStatus('idle');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [consultingId, companyName, position, jobPosting]);

  // 컨설턴트 수정 → 디바운스 저장 (second revision)
  useEffect(() => {
    if (!consultingId) return;
    if (phase !== 'review') return;
    if (!hasEdits) return;
    const t = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await saveRevisionStage('second', editedContent);
        setAutoSaveStatus('saved');
      } catch { setAutoSaveStatus('idle'); }
    }, 1500);
    return () => clearTimeout(t);
  }, [editedContent, consultingId, phase, hasEdits]);

  // ===== 헬퍼 =====
  const safeParse = (s: string) => { try { return JSON.parse(s); } catch { return undefined; } };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 3000); };
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const ensureConsulting = async (): Promise<number | undefined> => {
    if (consultingIdRef.current) return consultingIdRef.current;
    if (!clientId) { showError('고객을 선택하거나 새로 등록해주세요.'); return undefined; }
    if (!companyName.trim() || !position.trim()) { showError('회사명과 직무를 입력해주세요.'); return undefined; }
    try {
      const id = await window.api.createConsulting({
        clientId, companyName, position, jobPosting, status: 'draft',
      });
      consultingIdRef.current = id; // ref 즉시 동기화 (이후 같은 콜백 내 saveRevisionStage가 보게)
      setConsultingId(id);
      return id;
    } catch (err: any) {
      showError('컨설팅 생성 실패: ' + (err.message || ''));
      return undefined;
    }
  };

  // 단계별 저장: 기존 ID 있으면 업데이트, 없으면 생성. 'first'는 재첨삭마다 새 row 생성하기 위해 forceCreate 사용.
  // ref 기반으로 읽어 같은 콜백 내 setState race를 회피.
  const saveRevisionStage = async (
    stage: 'draft' | 'first' | 'second' | 'final',
    content: string,
    cmt?: RevisionComment[],
    ev?: Evaluation | null,
    forceCreate = false
  ) => {
    const cId = consultingIdRef.current;
    if (!cId) return;

    const existingId = revisionIdsRef.current[stage];
    if (existingId && !forceCreate) {
      await window.api.updateRevision(existingId, { content, comments: cmt, evaluation: ev });
    } else {
      const newId = await window.api.createRevision({
        consultingId: cId, stage, content, comments: cmt, evaluation: ev,
      });
      revisionIdsRef.current = { ...revisionIdsRef.current, [stage]: newId };
      setRevisionIds(prev => ({ ...prev, [stage]: newId }));
    }
  };

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

  // ===== 인라인 고객 등록 =====
  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const id = await window.api.createClient({
        name: newClientName,
        targetPosition: position || undefined,
      });
      await onClientsChange();
      setClientId(id);
      setNewClientName('');
      setShowNewClient(false);
      setShowClientDropdown(false);

      // 회사/직무가 채워져 있으면 곧장 draft Consulting 생성 (이력에 즉시 반영)
      if (companyName.trim() && position.trim()) {
        try {
          const cId = await window.api.createConsulting({
            clientId: id, companyName, position, jobPosting, status: 'draft',
          });
          consultingIdRef.current = cId;
          setConsultingId(cId);
          setAutoSaveStatus('saved');
          showSuccess(`"${newClientName}" 등록 + 첨삭 자동 저장 시작.`);
        } catch {
          showSuccess(`"${newClientName}" 고객이 등록되었습니다.`);
        }
      } else {
        showSuccess(`"${newClientName}" 고객이 등록되었습니다.`);
      }
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
    if (!clientId) { showError('고객을 선택하거나 새로 등록해주세요.'); return; }

    const cId = await ensureConsulting();
    if (!cId) return;

    setIsLoading(true); setErrorMsg('');

    try {
      const contentToRevise = contentOverride || originalContent;

      // 첫 첨삭 시 원본 저장 + 메모리 이력
      if (versions.length === 0) {
        addVersion('original', '원본', originalContent);
        await saveRevisionStage('draft', originalContent);
      }
      setAiInputContent(contentToRevise);

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

      addVersion('ai', 'AI 첨삭', result.revisedContent, result.comments, result.evaluation);

      // first revision은 재첨삭마다 새 row (학습/이력 추적용)
      await saveRevisionStage('first', result.revisedContent, result.comments, result.evaluation, true);
      setAutoSaveStatus('saved');
    } catch (err: any) {
      showError(err.message || '첨삭에 실패했습니다.');
    } finally { setIsLoading(false); }
  };

  // ===== 확정 =====
  const handleConfirm = async () => {
    const finalContent = hasEdits ? editedContent : revisedContent;

    if (hasEdits) {
      addVersion('consultant', '컨설턴트 수정', editedContent);
      try { await saveRevisionStage('second', editedContent); } catch { /* 무시 */ }
    }
    addVersion('confirmed', '최종 확정', finalContent);

    setPhase('confirmed');
    setViewMode('result');
    setRevisedContent(finalContent);
    setEditedContent(finalContent);
    setShowEval(true);

    try {
      await saveRevisionStage('final', finalContent);
      setAutoSaveStatus('saved');
    } catch { /* 저장 실패해도 UI는 확정 상태 유지 */ }

    // 학습 토글 기본값: 컨설턴트 수정이 있을 때만 ON (AI→AI 순환 방지)
    setAddToTraining(hasEdits || versions.some(v => v.type === 'consultant'));

    // 최종본 재평가 (원본 대비)
    setBeforeEvaluation(evaluation);
    setIsEvaluating(true);
    try {
      const origContent = versions.find(v => v.type === 'original')?.content || originalContent;
      const result = await window.api.requestEvaluation({
        content: finalContent,
        companyName, position, jobPosting,
        originalContent: origContent,
      });
      setEvaluation(result);
      showSuccess('확정 완료. 학습 등록 여부를 정한 뒤 "마무리"를 눌러주세요.');
    } catch {
      showSuccess('확정되었습니다. (재평가 실패 — 기존 평가 유지)');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ===== AI 재첨삭 =====
  const handleReRevise = () => {
    if (!hasEdits) { showError('수정한 내용이 없습니다. 먼저 내용을 수정해주세요.'); return; }
    addVersion('consultant', '컨설턴트 수정', editedContent);
    handleRevise(editedContent); // originalContent는 보존
  };

  // ===== 마무리 (학습 등록 처리) =====
  const handleFinalize = async () => {
    if (isFinalized) return;

    // 누적 active time flush
    if (consultingId) {
      const delta = pendingActiveDeltaRef.current;
      if (delta > 0) {
        pendingActiveDeltaRef.current = 0;
        try { await window.api.updateConsulting(consultingId, { addActiveSeconds: delta }); }
        catch { pendingActiveDeltaRef.current += delta; }
      }
    }

    try {
      const original = versions.find(v => v.type === 'original');
      const finalContent = versions.filter(v => v.type === 'confirmed').pop()?.content
        || editedContent || revisedContent;

      if (addToTraining && original && clientId) {
        const memoText = consultingMemo
          || (hasConsultantEdit ? '컨설턴트 수정 후 확정' : 'AI 첨삭 결과 확정');
        const trainingCaseId = await window.api.createTrainingCase({
          clientId, title: `${companyName} ${position}`, companyName, position,
          directionMemo: memoText,
        });
        await window.api.saveTrainingRevision({ caseId: trainingCaseId, stage: 'draft', content: original.content });
        await window.api.saveTrainingRevision({ caseId: trainingCaseId, stage: 'final', content: finalContent });

        window.api.analyzePattern({ original: original.content, final: finalContent })
          .then((res: any) => { if (res?.pattern) showSuccess('패턴 분석 완료: ' + res.pattern.slice(0, 80) + '...'); })
          .catch(() => {});
      }

      setIsFinalized(true);
      showSuccess(addToTraining ? '마무리 완료. 학습 데이터에 추가했습니다.' : '마무리 완료. (학습 미등록)');
    } catch (err: any) {
      showError('마무리 실패: ' + (err.message || ''));
    }
  };

  // ===== 초기화 =====
  const handleClear = () => {
    setOriginalContent(''); setRevisedContent(''); setEditedContent(''); setAiInputContent('');
    setComments([]); setEvaluation(null); setBeforeEvaluation(null); setIsEvaluating(false);
    setCompanyName(''); setPosition(''); setJobPosting(''); setClientMemo(''); setConsultingMemo('');
    setShowEval(false); setViewMode('diff'); setPhase('input');
    setErrorMsg(''); setSuccessMsg('');
    setVersions([]); setActiveVersion(-1);
    setConsultingId(undefined); setClientId(undefined);
    setRevisionIds({}); setAutoSaveStatus('idle');
    consultingIdRef.current = undefined;
    revisionIdsRef.current = {};
    setAddToTraining(false); setIsFinalized(false);
    setShowJobPosting(false);
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

  // ===== 자동저장 표시 =====
  const autoSaveText = !consultingId
    ? '입력 중'
    : autoSaveStatus === 'saving'
      ? '저장 중...'
      : autoSaveStatus === 'saved'
        ? '✓ 자동 저장됨'
        : '대기';

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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: autoSaveStatus === 'saved' ? 'var(--success)' : 'var(--gray-400)' }}>
            {autoSaveText}
          </span>
          {selectedClient && (
            <button className="btn btn-sm btn-secondary" onClick={() => nav.goToClients(clientId)}>고객 정보</button>
          )}
          {phase !== 'input' && (
            <button className="btn btn-sm btn-secondary" onClick={handleClear}>새로 시작</button>
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
                <DiffView original={diffOriginal} revised={revisedContent} comments={comments} />
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

            {/* 확정 후: 학습 등록 토글 + 마무리 */}
            {phase === 'confirmed' && (
              <div className="action-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <input
                  placeholder="컨설팅 방향 메모 (예: JD 키워드 이식 중심, 금융 어조 적용)"
                  value={consultingMemo}
                  onChange={(e) => setConsultingMemo(e.target.value)}
                  disabled={isFinalized}
                  style={{ fontSize: '13px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: isFinalized ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addToTraining}
                    onChange={(e) => setAddToTraining(e.target.checked)}
                    disabled={isFinalized}
                  />
                  <span>이 사례를 학습 데이터로 추가
                    {hasConsultantEdit
                      ? <small style={{ color: 'var(--gray-400)', marginLeft: '6px' }}>(컨설턴트 수정 있음 — 추천)</small>
                      : <small style={{ color: 'var(--warning)', marginLeft: '6px' }}>(AI 결과만 — 학습 비추천)</small>}
                  </span>
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {isFinalized ? '✓ 마무리 완료' : '확정 완료 — "마무리"를 누르면 학습 등록이 처리됩니다'}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isFinalized && (
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setVersions(prev => prev.filter(v => v.type !== 'confirmed'));
                        setPhase('review');
                        setViewMode('edit');
                        showSuccess('확정 해제됨. 수정을 계속하세요.');
                      }}>
                        확정 해제
                      </button>
                    )}
                    {!isFinalized && (
                      <button className="btn btn-primary btn-sm" onClick={handleFinalize}>
                        마무리
                      </button>
                    )}
                  </div>
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
                    {v.type === 'original' ? '📄' : v.type === 'ai' ? '⚡' : v.type === 'confirmed' ? '✓' : '✎'}
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
