import React, { useState } from 'react';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }
    await window.api.setApiKey?.(apiKey);
    localStorage.setItem('anthropic_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>설정</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Anthropic API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Claude API를 사용하기 위한 키입니다. 로컬에만 저장됩니다.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '저장됨!' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
