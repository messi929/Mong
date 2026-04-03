import React, { useState, useEffect } from 'react';
import ClientForm from '../components/ClientForm';
import TrainingDataPanel from '../components/TrainingDataPanel';
import type { NavigationContext } from '../App';
import type { Client, Consulting } from '../../shared/types';

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'badge-draft', label: '초안' },
  in_progress: { cls: 'badge-progress', label: '진행중' },
  completed: { cls: 'badge-complete', label: '완료' },
};

interface Props {
  nav: NavigationContext;
  initialClientId?: number;
}

export default function ClientsPage({ nav, initialClientId }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [consultings, setConsultings] = useState<Consulting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  // initialClientId가 변경되면 해당 고객 선택
  useEffect(() => {
    if (initialClientId && clients.length > 0) {
      const c = clients.find(c => c.id === initialClientId);
      if (c) handleSelectClient(c);
    }
  }, [initialClientId, clients]);

  const loadClients = async () => {
    const data = await window.api.getClients();
    setClients(data);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const data = await window.api.searchClients(query);
      setClients(data);
    } else {
      loadClients();
    }
  };

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    const data = await window.api.getConsultings(client.id);
    setConsultings(data);
  };

  const handleSaveClient = async (data: Partial<Client>) => {
    if (editingClient) {
      await window.api.updateClient(editingClient.id, data);
    } else {
      await window.api.createClient(data);
    }
    setShowForm(false);
    setEditingClient(null);
    loadClients();
    if (selectedClient && editingClient) {
      const updated = await window.api.getClient(editingClient.id);
      setSelectedClient(updated);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (confirm('이 고객을 삭제하시겠습니까? 관련된 모든 첨삭 이력도 삭제됩니다.')) {
      await window.api.deleteClient(id);
      setSelectedClient(null);
      loadClients();
    }
  };

  const handleDeleteConsulting = async (id: number) => {
    if (confirm('이 첨삭 이력을 삭제하시겠습니까?')) {
      await window.api.deleteConsulting(id);
      if (selectedClient) {
        const data = await window.api.getConsultings(selectedClient.id);
        setConsultings(data);
      }
    }
  };

  const handleConsultingClick = (consulting: Consulting) => {
    nav.goToConsulting(consulting.clientId, consulting.id);
  };

  const handleStartConsulting = () => {
    if (selectedClient) {
      nav.goToConsulting(selectedClient.id);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 좌측: 고객 목록 */}
      <div className="sidebar-list">
        <div className="sidebar-header">
          <input
            placeholder="고객 검색..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
            onClick={() => { setEditingClient(null); setShowForm(true); }}>
            + 고객 추가
          </button>
        </div>
        <div className="sidebar-items">
          {clients.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <p style={{ fontSize: '13px' }}>등록된 고객이 없습니다</p>
            </div>
          ) : clients.map((client) => (
            <div key={client.id}
              className={`sidebar-item ${selectedClient?.id === client.id ? 'active' : ''}`}
              onClick={() => handleSelectClient(client)}>
              <div className="name">{client.name}</div>
              <div className="meta">
                {[client.targetIndustry, client.targetPosition].filter(Boolean).join(' / ') || '정보 없음'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 우측: 고객 상세 */}
      <div className="client-detail">
        {!selectedClient ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <h3>고객을 선택해주세요</h3>
            <p>좌측 목록에서 고객을 클릭하면 상세 정보를 볼 수 있습니다.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{selectedClient.name}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handleStartConsulting}>
                  새 첨삭 시작
                </button>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setEditingClient(selectedClient); setShowForm(true); }}>수정</button>
                <button className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteClient(selectedClient.id)}>삭제</button>
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-600)' }}>기본 정보</h3>
              <div className="info-grid">
                <InfoItem label="이메일" value={selectedClient.email} />
                <InfoItem label="연락처" value={selectedClient.phone} />
                <InfoItem label="학력" value={selectedClient.education} />
                <InfoItem label="전공" value={selectedClient.major} />
                <InfoItem label="희망 산업군" value={selectedClient.targetIndustry} />
                <InfoItem label="희망 직무" value={selectedClient.targetPosition} />
              </div>
              {selectedClient.experience && (
                <div className="form-group">
                  <label>경력사항</label>
                  <div className="value" style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{selectedClient.experience}</div>
                </div>
              )}
              {selectedClient.memo && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>컨설턴트 메모</label>
                  <div style={{ background: 'var(--warning-light)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                    {selectedClient.memo}
                  </div>
                </div>
              )}
            </div>

            {/* 첨삭 이력 */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-600)' }}>
                첨삭 이력 ({consultings.length}건)
              </h3>
              {consultings.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                  아직 첨삭 이력이 없습니다.
                  <button className="btn btn-sm btn-primary" style={{ marginLeft: '8px' }} onClick={handleStartConsulting}>
                    첨삭 시작
                  </button>
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>날짜</th><th>회사명</th><th>직무</th><th>상태</th><th></th></tr>
                  </thead>
                  <tbody>
                    {consultings.map((c) => {
                      const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
                      return (
                        <tr key={c.id}>
                          <td>{c.createdAt?.slice(0, 10)}</td>
                          <td>{c.companyName}</td>
                          <td>{c.position}</td>
                          <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => handleConsultingClick(c)}>
                                열기
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteConsulting(c.id)}>
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 학습 데이터 */}
            <TrainingDataPanel clientId={selectedClient.id} clientName={selectedClient.name} />
          </>
        )}
      </div>

      {showForm && (
        <ClientForm
          client={editingClient}
          onSave={handleSaveClient}
          onClose={() => { setShowForm(false); setEditingClient(null); }}
        />
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-item">
      <label>{label}</label>
      <div className="value">{value || '-'}</div>
    </div>
  );
}
