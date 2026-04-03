import React, { useState, useEffect } from 'react';
import type { NavigationContext } from '../App';
import type { DashboardStats } from '../../shared/types';

declare global {
  interface Window { api: any; }
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'badge-draft', label: '초안' },
  in_progress: { cls: 'badge-progress', label: '진행중' },
  completed: { cls: 'badge-complete', label: '완료' },
};

interface QualityItem {
  companyName: string;
  position: string;
  clientName: string;
  date: string;
  average: number;
  scores: { specificity: number; logic: number; relevance: number; differentiation: number; expression: number };
}

interface QualityStats {
  items: QualityItem[];
  overallAvg: number;
  calibrationCount: number;
  trainingCount: number;
}

interface Props { nav: NavigationContext; }

export default function DashboardPage({ nav }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quality, setQuality] = useState<QualityStats | null>(null);
  const [tab, setTab] = useState<'overview' | 'quality'>('overview');

  useEffect(() => {
    window.api.getDashboardStats().then(setStats);
    window.api.getQualityStats().then(setQuality).catch(() => {});
  }, []);

  if (!stats) return <div className="loading"><span className="spinner" /> 로딩 중...</div>;

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>대시보드</h2>
        <div className="stage-tabs">
          <button className={`stage-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>개요</button>
          <button className={`stage-tab ${tab === 'quality' ? 'active' : ''}`} onClick={() => setTab('quality')}>품질</button>
        </div>
      </div>

      {tab === 'overview' ? (
        <>
          <div className="stats-grid">
            <StatCard value={stats.totalClients} label="총 고객" />
            <StatCard value={stats.thisMonthConsultings} label="이번 달 첨삭" />
            <StatCard value={stats.inProgress} label="진행중" color="var(--primary)" />
            <StatCard value={stats.completed} label="완료" color="var(--success)" />
          </div>

          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--gray-600)' }}>최근 첨삭</h3>
            {stats.recentConsultings.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <p>아직 첨삭 이력이 없습니다.</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }}
                  onClick={() => nav.goToConsulting()}>첨삭 시작</button>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>고객명</th><th>회사명</th><th>직무</th><th>상태</th><th>날짜</th></tr></thead>
                <tbody>
                  {stats.recentConsultings.map((c) => {
                    const badge = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
                    return (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav.goToConsulting(c.clientId, c.id)}>
                        <td style={{ fontWeight: 500 }}>{c.clientName}</td>
                        <td>{c.companyName}</td>
                        <td>{c.position}</td>
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                        <td style={{ color: 'var(--gray-400)' }}>{c.updatedAt?.slice(0, 10)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 품질 대시보드 */}
          <div className="stats-grid">
            <StatCard value={quality?.overallAvg || 0} label="평균 평가 점수" color="var(--primary)" decimal />
            <StatCard value={quality?.items.length || 0} label="평가된 첨삭" />
            <StatCard value={quality?.calibrationCount || 0} label="합격자소서 (캘리브레이션)" />
            <StatCard value={quality?.trainingCount || 0} label="학습 데이터" />
          </div>

          <div className="card">
            <h3 style={{ fontSize: '14px', marginBottom: '16px', color: 'var(--gray-600)' }}>최근 평가 이력</h3>
            {!quality || quality.items.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <p>아직 평가된 첨삭이 없습니다. 첨삭 후 확정하면 자동으로 평가됩니다.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>고객</th><th>회사</th><th>직무</th>
                    <th>구체성</th><th>논리성</th><th>연관성</th><th>차별성</th><th>표현력</th>
                    <th>평균</th><th>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{item.clientName}</td>
                      <td>{item.companyName}</td>
                      <td>{item.position}</td>
                      <td><ScoreBadge score={item.scores.specificity} /></td>
                      <td><ScoreBadge score={item.scores.logic} /></td>
                      <td><ScoreBadge score={item.scores.relevance} /></td>
                      <td><ScoreBadge score={item.scores.differentiation} /></td>
                      <td><ScoreBadge score={item.scores.expression} /></td>
                      <td><strong style={{ color: item.average >= 4 ? 'var(--success)' : item.average >= 3 ? 'var(--primary)' : 'var(--danger)' }}>
                        {item.average}
                      </strong></td>
                      <td style={{ color: 'var(--gray-400)' }}>{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ value, label, color, decimal }: { value: number; label: string; color?: string; decimal?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{decimal ? value.toFixed(1) : value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? 'var(--success)' : score >= 3 ? 'var(--primary)' : 'var(--danger)';
  return <span style={{ color, fontWeight: 600 }}>{score}</span>;
}

