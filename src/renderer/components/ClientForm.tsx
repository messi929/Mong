import React, { useState } from 'react';
import type { Client } from '../../shared/types';

interface ClientFormProps {
  client: Client | null;
  onSave: (data: Partial<Client>) => void;
  onClose: () => void;
}

export default function ClientForm({ client, onSave, onClose }: ClientFormProps) {
  const [form, setForm] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    education: client?.education || '',
    major: client?.major || '',
    experience: client?.experience || '',
    targetIndustry: client?.targetIndustry || '',
    targetPosition: client?.targetPosition || '',
    memo: client?.memo || '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{client ? '고객 정보 수정' : '새 고객 등록'}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>닫기</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>이름 *</label>
                <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>연락처</label>
                <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
              </div>
              <div className="form-group">
                <label>이메일</label>
                <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label>학력</label>
                <input value={form.education} onChange={(e) => handleChange('education', e.target.value)} placeholder="예: OO대학교" />
              </div>
              <div className="form-group">
                <label>전공</label>
                <input value={form.major} onChange={(e) => handleChange('major', e.target.value)} />
              </div>
              <div className="form-group">
                <label>희망 산업군</label>
                <input value={form.targetIndustry} onChange={(e) => handleChange('targetIndustry', e.target.value)} placeholder="예: IT, 금융, 제조" />
              </div>
              <div className="form-group">
                <label>희망 직무</label>
                <input value={form.targetPosition} onChange={(e) => handleChange('targetPosition', e.target.value)} placeholder="예: 개발, 마케팅, 기획" />
              </div>
              <div className="form-group full-width">
                <label>경력사항</label>
                <textarea
                  value={form.experience}
                  onChange={(e) => handleChange('experience', e.target.value)}
                  placeholder="주요 경력, 인턴 경험, 프로젝트 등"
                  rows={3}
                />
              </div>
              <div className="form-group full-width">
                <label>컨설턴트 메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => handleChange('memo', e.target.value)}
                  placeholder="이 고객의 강점, 약점, 주의할 점 등"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary">저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}
