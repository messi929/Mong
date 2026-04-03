import React, { useState } from 'react';
import type { Client } from '../../shared/types';

interface ImportGroup {
  title: string;
  files: { fileName: string; stage: string; stageLabel: string }[];
}

interface ScanResult {
  groups: ImportGroup[];
  errors: string[];
  totalFiles: number;
}

interface ImportResult {
  totalFiles: number;
  totalCases: number;
  totalRevisions: number;
  cases: { title: string; stages: string[] }[];
  errors: string[];
}

interface Props {
  clients: Client[];
  onClose: () => void;
  onComplete: () => void;
}

export default function ImportModal({ clients, onClose, onComplete }: Props) {
  const [step, setStep] = useState<'select' | 'preview' | 'importing' | 'done'>('select');
  const [folderPath, setFolderPath] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);

  const handleSelectFolder = async () => {
    const path = await window.api.importSelectFolder();
    if (path) {
      setFolderPath(path);
      const result = await window.api.importScanFolder(path);
      setScanResult(result);
      setStep('preview');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const result = await window.api.importExecute(folderPath, selectedClientId);
      setImportResult(result);
      setStep('done');
    } catch (err: any) {
      alert('Import 실패: ' + (err.message || '알 수 없는 오류'));
      setStep('preview');
    }
  };

  const handleDone = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>학습 데이터 일괄 Import</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>

        <div className="modal-body">
          {/* Step 1: 폴더 선택 */}
          {step === 'select' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>학습 데이터 폴더를 선택하세요</h3>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '20px', lineHeight: '1.6' }}>
                파일명에 단계 키워드가 포함되어야 합니다<br />
                예: <code>대한통운 IT 최초.docx</code>, <code>대한통운 IT 첨삭중.docx</code>, <code>대한통운 IT 최종.docx</code><br />
                지원 키워드: 최초/초안/원본, 첨삭중/1차, 2차, 최종/완성
              </p>
              <button className="btn btn-primary" onClick={handleSelectFolder}>
                폴더 선택
              </button>
            </div>
          )}

          {/* Step 2: 미리보기 */}
          {step === 'preview' && scanResult && (
            <div>
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--primary-light)', borderRadius: 'var(--radius)' }}>
                <strong>{scanResult.totalFiles}개 파일</strong>이 <strong>{scanResult.groups.length}개 사례</strong>로 감지되었습니다.
              </div>

              {/* 고객 연결 (선택) */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>연결할 고객 (선택사항)</label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">고객 미지정 (전체 공통 학습 데이터)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 사례별 미리보기 */}
              {scanResult.groups.map((group, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--gray-200)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {group.files.map((f, j) => (
                      <div
                        key={j}
                        style={{
                          fontSize: '12px',
                          padding: '3px 8px',
                          background: 'var(--surface)',
                          borderRadius: '4px',
                          border: '1px solid var(--gray-200)',
                        }}
                      >
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{f.stageLabel}</span>
                        <span style={{ color: 'var(--gray-400)', marginLeft: '6px' }}>{f.fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 에러 */}
              {scanResult.errors.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'var(--danger-light)', borderRadius: 'var(--radius)', fontSize: '12px' }}>
                  <strong>건너뛸 파일:</strong>
                  {scanResult.errors.map((err, i) => (
                    <div key={i} style={{ color: 'var(--danger)', marginTop: '4px' }}>{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Import 중 */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 16px' }} />
              <p>파일을 파싱하고 DB에 저장하는 중...</p>
            </div>
          )}

          {/* Step 4: 완료 */}
          {step === 'done' && importResult && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#10003;</div>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--success)' }}>Import 완료!</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div className="stat-card">
                  <div className="stat-value">{importResult.totalCases}</div>
                  <div className="stat-label">사례</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{importResult.totalRevisions}</div>
                  <div className="stat-label">단계별 버전</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{importResult.totalFiles}</div>
                  <div className="stat-label">파일</div>
                </div>
              </div>

              {importResult.cases.map((c, i) => (
                <div key={i} style={{ fontSize: '13px', marginBottom: '4px' }}>
                  <strong>{c.title}</strong> — {c.stages.join(', ')}
                </div>
              ))}

              {importResult.errors.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--danger)' }}>
                  {importResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('select')}>다시 선택</button>
              <button className="btn btn-primary" onClick={handleImport}>
                {scanResult?.totalFiles}개 파일 Import
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn btn-primary" onClick={handleDone}>확인</button>
          )}
        </div>
      </div>
    </div>
  );
}
