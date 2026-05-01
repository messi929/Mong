import React, { useState, useEffect } from 'react';
import type { NavigationContext } from '../App';
import { OUTCOME_LABELS, OUTCOME_OPTIONS } from '../../shared/types';
import type { DashboardStats, Outcome } from '../../shared/types';

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

interface MetricRecent {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string;
  position: string;
  finalizedAt: string;
  editRatio: number | null;
  editBinary: 0 | 1 | null;
  activeTimeSeconds: number | null;
  outcome: Outcome | null;
  daysSinceFinalized: number;
}

interface PhaseZeroMetrics {
  totalCompleted: number;
  pendingOutcome: number;
  pendingOutcomeOverdue: number;
  editRatioAvg30d: number | null;
  editRatioAvgAll: number | null;
  untouchedRate30d: number | null;
  untouchedRateAll: number | null;
  avgActiveTimeSeconds30d: number | null;
  avgActiveTimeSecondsAll: number | null;
  sampleSize30d: number;
  sampleSizeAll: number;
  outcomeDistribution: Record<string, number>;
  recent: MetricRecent[];
}

interface Props { nav: NavigationContext; }

export default function DashboardPage({ nav }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quality, setQuality] = useState<QualityStats | null>(null);
  const [metrics, setMetrics] = useState<PhaseZeroMetrics | null>(null);
  const [tab, setTab] = useState<'overview' | 'quality' | 'metrics'>('overview');

  const loadAll = () => {
    window.api.getDashboardStats().then(setStats);
    window.api.getQualityStats().then(setQuality).catch(() => {});
    window.api.getDashboardMetrics().then(setMetrics).catch(() => {});
  };

  useEffect(() => { loadAll(); }, []);

  const updateOutcome = async (consultingId: number, outcome: string) => {
    try {
      await window.api.updateConsulting(consultingId, { outcome });
      // 메트릭만 새로 로드 (overview/quality는 그대로)
      const fresh = await window.api.getDashboardMetrics();
      setMetrics(fresh);
    } catch { /* 무시 */ }
  };

  if (!stats) return <div className="loading"><span className="spinner" /> 로딩 중...</div>;

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600 }}>대시보드</h2>
        <div className="stage-tabs">
          <button className={`stage-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>개요</button>
          <button className={`stage-tab ${tab === 'quality' ? 'active' : ''}`} onClick={() => setTab('quality')}>품질</button>
          <button className={`stage-tab ${tab === 'metrics' ? 'active' : ''}`} onClick={() => setTab('metrics')}>
            측정
            {metrics && metrics.pendingOutcomeOverdue > 0 && (
              <span style={{ marginLeft: '6px', background: 'var(--danger)', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '11px' }}>
                {metrics.pendingOutcomeOverdue}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === 'metrics' ? (
        <PhaseZeroTab metrics={metrics} nav={nav} updateOutcome={updateOutcome} />
      ) : tab === 'overview' ? (
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

function StatCard({ value, label, color, decimal, suffix }: { value: number; label: string; color?: string; decimal?: boolean; suffix?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>
        {decimal ? value.toFixed(1) : value}{suffix || ''}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? 'var(--success)' : score >= 3 ? 'var(--primary)' : 'var(--danger)';
  return <span style={{ color, fontWeight: 600 }}>{score}</span>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return '-';
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}시간` : `${h}시간 ${rem}분`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value * 100)}%`;
}

function PhaseZeroTab({ metrics, nav, updateOutcome }: {
  metrics: PhaseZeroMetrics | null;
  nav: NavigationContext;
  updateOutcome: (id: number, outcome: string) => void;
}) {
  if (!metrics) {
    return <div className="loading"><span className="spinner" /> 측정 데이터 로딩...</div>;
  }

  if (metrics.totalCompleted === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px' }}>
        <h3>아직 완료된 첨삭이 없습니다</h3>
        <p>첨삭을 마무리하면 자동으로 측정값이 쌓입니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <StatCard
          value={metrics.editRatioAvg30d !== null ? Math.round(metrics.editRatioAvg30d * 100) : 0}
          label={`평균 수정률 (최근 30일, ${metrics.sampleSize30d}건)`}
          color="var(--primary)"
          suffix="%"
        />
        <StatCard
          value={metrics.untouchedRate30d !== null ? Math.round(metrics.untouchedRate30d * 100) : 0}
          label="무수정 통과율 (30일)"
          color={metrics.untouchedRate30d && metrics.untouchedRate30d > 0.3 ? 'var(--success)' : 'var(--gray-400)'}
          suffix="%"
        />
        <StatCard
          value={Math.round((metrics.avgActiveTimeSeconds30d || 0) / 60)}
          label="평균 작업시간 (30일)"
          suffix="분"
        />
        <StatCard
          value={metrics.pendingOutcomeOverdue}
          label="결과 입력 대기 (30일+)"
          color={metrics.pendingOutcomeOverdue > 0 ? 'var(--danger)' : 'var(--gray-400)'}
        />
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-600)' }}>
          전체 추이 (총 {metrics.sampleSizeAll}건)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', fontSize: '13px' }}>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>전체 평균 수정률</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatPercent(metrics.editRatioAvgAll)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>전체 무수정 통과율</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatPercent(metrics.untouchedRateAll)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>전체 평균 작업시간</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatDuration(metrics.avgActiveTimeSecondsAll)}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-600)' }}>결과 분포 (완료 첨삭 기준)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {OUTCOME_OPTIONS.map(opt => {
            const cnt = metrics.outcomeDistribution[opt.value] || 0;
            const cfg = OUTCOME_LABELS[opt.value];
            return (
              <div key={opt.value} style={{ padding: '8px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', minWidth: '100px' }}>
                <div style={{ fontSize: '12px', color: cfg.color, fontWeight: 500 }}>{cfg.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{cnt}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--gray-600)' }}>최근 완료 첨삭 + 측정값</h3>
        <table className="table">
          <thead>
            <tr>
              <th>고객</th><th>회사</th><th>직무</th>
              <th>수정률</th><th>손댐</th><th>작업시간</th>
              <th>경과</th><th>결과</th>
            </tr>
          </thead>
          <tbody>
            {metrics.recent.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }}>
                <td onClick={() => nav.goToConsulting(r.clientId, r.id)} style={{ fontWeight: 500 }}>{r.clientName}</td>
                <td onClick={() => nav.goToConsulting(r.clientId, r.id)}>{r.companyName}</td>
                <td onClick={() => nav.goToConsulting(r.clientId, r.id)}>{r.position}</td>
                <td>{formatPercent(r.editRatio)}</td>
                <td>{r.editBinary === 0 ? <span style={{ color: 'var(--success)' }}>×</span>
                    : r.editBinary === 1 ? <span style={{ color: 'var(--gray-500)' }}>○</span>
                    : '-'}</td>
                <td>{formatDuration(r.activeTimeSeconds)}</td>
                <td style={{ color: r.daysSinceFinalized > 30 && r.outcome === 'pending' ? 'var(--danger)' : 'var(--gray-400)' }}>
                  {r.daysSinceFinalized}일 전
                </td>
                <td>
                  <select
                    value={r.outcome || 'pending'}
                    onChange={(e) => updateOutcome(r.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: '12px', padding: '2px 4px', color: OUTCOME_LABELS[r.outcome || 'pending']?.color }}
                  >
                    {OUTCOME_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

