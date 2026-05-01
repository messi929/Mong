/**
 * 사용자 가이드 PDF 생성
 * 실행: npx tsx scripts/generate-guide-pdf.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUTPUT_DIR = path.join(__dirname, '../dist');
const HTML_PATH = path.join(OUTPUT_DIR, 'user-guide.html');
const PDF_PATH = path.join(OUTPUT_DIR, 'Mong Consulting 사용자 가이드.pdf');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Segoe UI', sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.7; }

  .cover { page-break-after: always; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
  .cover h1 { font-size: 36pt; color: #2563eb; font-weight: 800; letter-spacing: -1px; }
  .cover .subtitle { font-size: 16pt; color: #6b7280; margin-top: 12px; }
  .cover .version { font-size: 12pt; color: #9ca3af; margin-top: 40px; }
  .cover .date { font-size: 11pt; color: #9ca3af; margin-top: 8px; }

  h2 { font-size: 18pt; color: #2563eb; margin-top: 32px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #2563eb; page-break-after: avoid; }
  h3 { font-size: 14pt; color: #374151; margin-top: 24px; margin-bottom: 10px; page-break-after: avoid; }
  h4 { font-size: 12pt; color: #4b5563; margin-top: 16px; margin-bottom: 8px; }

  p { margin-bottom: 10px; }

  .screen { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 14px 0; }
  .screen-title { font-size: 10pt; font-weight: 700; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .screen-layout { display: flex; gap: 10px; min-height: 120px; }
  .screen-panel { flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 9pt; color: #6b7280; }
  .screen-panel.nav { flex: none; width: 100%; background: white; padding: 8px 12px; display: flex; gap: 12px; align-items: center; border-radius: 6px; margin-bottom: 8px; }
  .screen-panel.sidebar { flex: 0 0 120px; }
  .screen-panel.eval { flex: 0 0 100px; background: #f9fafb; }
  .screen-header { font-weight: 700; color: #374151; margin-bottom: 6px; font-size: 9pt; }

  .brand { font-weight: 800; color: #2563eb; font-size: 11pt; }
  .tab { padding: 3px 10px; border-radius: 4px; font-size: 8pt; display: inline-block; }
  .tab.active { background: #eff6ff; color: #2563eb; font-weight: 600; }
  .tab.inactive { color: #9ca3af; }

  .btn { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 8pt; font-weight: 600; }
  .btn-blue { background: #2563eb; color: white; }
  .btn-gray { background: white; border: 1px solid #e5e7eb; color: #374151; }
  .btn-green { background: #16a34a; color: white; }
  .btn-red { background: #dc2626; color: white; }

  .step { display: flex; gap: 12px; margin: 10px 0; align-items: flex-start; }
  .step-num { flex: 0 0 28px; height: 28px; background: #2563eb; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10pt; }
  .step-content { flex: 1; }

  .tip { background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 10pt; }
  .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 10pt; }

  .flow { display: flex; align-items: center; gap: 8px; margin: 14px 0; flex-wrap: wrap; }
  .flow-item { padding: 6px 14px; border-radius: 20px; font-size: 9pt; font-weight: 600; border: 1px solid #e5e7eb; background: white; }
  .flow-item.active { background: #2563eb; color: white; border-color: #2563eb; }
  .flow-item.green { background: #dcfce7; color: #16a34a; border-color: #16a34a; }
  .flow-arrow { color: #d1d5db; font-size: 14pt; }

  .timeline { display: flex; gap: 6px; align-items: center; margin: 10px 0; }
  .timeline-chip { padding: 4px 10px; border-radius: 12px; font-size: 8pt; border: 1px solid #e5e7eb; background: white; }
  .timeline-chip.original { border-left: 3px solid #9ca3af; }
  .timeline-chip.ai { border-left: 3px solid #2563eb; }
  .timeline-chip.edit { border-left: 3px solid #f59e0b; }
  .timeline-chip.confirm { border-left: 3px solid #16a34a; background: #dcfce7; }

  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; color: #6b7280; }

  .page-break { page-break-before: always; }

  .toc { margin: 20px 0; }
  .toc-item { padding: 6px 0; border-bottom: 1px dotted #e5e7eb; display: flex; justify-content: space-between; }
  .toc-item span:first-child { font-weight: 500; }
  .toc-item span:last-child { color: #9ca3af; }
</style>
</head>
<body>

<!-- 표지 -->
<div class="cover">
  <h1>Mong</h1>
  <div class="subtitle">AI 자소서 컨설팅 사용자 가이드</div>
  <div class="version">v3.1</div>
  <div class="date">2026년 5월</div>
</div>

<!-- 목차 -->
<h2>목차</h2>
<div class="toc">
  <div class="toc-item"><span>1. 시작하기</span><span>설치, 회원가입, 로그인</span></div>
  <div class="toc-item"><span>2. 첨삭하기</span><span>AI 첨삭 워크플로우 + 자동 저장</span></div>
  <div class="toc-item"><span>3. 결과 검토 및 수정</span><span>비교, 수정, 확정</span></div>
  <div class="toc-item"><span>4. 평가 시스템</span><span>5항목 평가, Before/After</span></div>
  <div class="toc-item"><span>5. 마무리 및 학습 등록</span><span>학습 토글, 결과 추적</span></div>
  <div class="toc-item"><span>6. 고객관리</span><span>고객 등록, 이력 조회, 결과 입력</span></div>
  <div class="toc-item"><span>7. 대시보드</span><span>개요·품질·측정</span></div>
  <div class="toc-item"><span>8. 기타 기능</span><span>다크모드, 내보내기, 임포트</span></div>
  <div class="toc-item"><span>9. Mong이 자소서를 다루는 방식</span><span>AI 작동 원칙</span></div>
</div>

<!-- 1. 시작하기 -->
<h2 class="page-break">1. 시작하기</h2>

<h3>1-1. 설치</h3>
<p>팀에서 공유받은 <strong>Mong Consulting Setup x.x.x.exe</strong> 파일을 실행하여 설치합니다. 별도의 설정 파일이나 서버 주소 입력은 필요 없습니다.</p>

<h3>1-2. 회원가입 / 로그인</h3>
<p>앱을 실행하면 로그인 화면이 표시됩니다.</p>

<div class="screen">
  <div class="screen-title">로그인 화면</div>
  <div style="text-align: center; padding: 20px;">
    <div style="display: inline-block; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 30px 28px; width: 280px; text-align: center;">
      <div class="brand" style="font-size: 22pt; margin-bottom: 4px;">Mong</div>
      <div style="color: #9ca3af; font-size: 9pt; margin-bottom: 20px;">AI 자소서 컨설팅</div>
      <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; text-align: left; font-size: 9pt; color: #9ca3af;">아이디</div>
      <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; margin-bottom: 14px; text-align: left; font-size: 9pt; color: #9ca3af;">비밀번호</div>
      <div class="btn btn-blue" style="width: 100%; padding: 8px; font-size: 10pt;">로그인</div>
      <div style="margin-top: 14px; font-size: 9pt; color: #9ca3af;">계정이 없으신가요? <span style="color: #2563eb; font-weight: 600;">회원가입</span></div>
    </div>
  </div>
</div>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-content"><strong>첫 사용 시</strong> 하단의 "회원가입"을 클릭합니다.</div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-content"><strong>이름, 아이디, 비밀번호</strong>를 입력하고 "가입하기"를 클릭합니다.</div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-content">가입 즉시 자동 로그인되어 메인 화면으로 이동합니다.</div>
</div>

<div class="tip">각 직원이 본인 계정으로 로그인하면, 본인이 등록한 고객만 조회됩니다.</div>

<!-- 2. 첨삭하기 -->
<h2 class="page-break">2. 첨삭하기</h2>

<h3>2-1. 화면 구성</h3>

<div class="screen">
  <div class="screen-title">첨삭하기 — 전체 레이아웃</div>
  <div class="screen-panel nav">
    <span class="brand">Mong</span>
    <span class="tab active">첨삭하기</span>
    <span class="tab inactive">고객관리</span>
    <span class="tab inactive">대시보드</span>
    <span style="margin-left: auto; font-size: 8pt; color: #9ca3af;">홍길동</span>
    <span class="btn btn-gray">Import</span>
    <span class="btn btn-gray">🌙</span>
    <span class="btn btn-gray">로그아웃</span>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 9pt;">
    <span style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 10px;">👤 고객 선택 ▾</span>
    <span style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 10px; color: #9ca3af;">회사명 *</span>
    <span style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 10px; color: #9ca3af;">직무 *</span>
    <span class="btn btn-gray">공고 ▼</span>
    <span style="margin-left: auto; font-size: 8pt; color: #16a34a;">✓ 자동 저장됨</span>
    <span style="margin-left: 8px;"><span class="btn btn-gray">새로 시작</span></span>
  </div>
  <div class="screen-layout">
    <div class="screen-panel">
      <div class="screen-header">원본 자기소개서</div>
      <div style="border: 2px dashed #d1d5db; border-radius: 6px; padding: 16px; text-align: center; color: #9ca3af; font-size: 8pt; margin-bottom: 8px;">파일 드래그 또는 클릭<br>PDF, Word, HWP, 텍스트 지원</div>
      <div style="color: #9ca3af; font-size: 8pt;">자기소개서를 입력하세요...</div>
      <div style="text-align: center; margin-top: 12px;"><span class="btn btn-blue">첨삭 시작</span></div>
    </div>
    <div class="screen-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="screen-header" style="margin: 0;">첨삭 결과</div>
        <div><span class="tab active">비교</span> <span class="tab inactive">결과</span> <span class="tab inactive">수정</span> <span class="btn btn-gray">파일</span> <span class="btn btn-gray">복사</span> <span class="btn btn-gray">내보내기</span> <span class="btn btn-gray">평가</span></div>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 9pt; padding: 30px;">첨삭 결과가 여기에 표시됩니다</div>
    </div>
  </div>
</div>

<h3>2-2. 첨삭 진행 순서</h3>

<div class="flow">
  <div class="flow-item active">① 고객 선택</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item active">② 회사/직무 입력</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item active">③ 자소서 입력</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item active">④ 첨삭 시작</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item green">⑤ 결과 확인</div>
</div>

<h4>① 고객 선택</h4>
<p>상단 정보바의 <strong>"고객 선택"</strong> 드롭다운을 클릭합니다. 기존 고객을 검색하거나, <strong>"+ 새 고객 등록"</strong>으로 즉석 등록할 수 있습니다.</p>

<h4>② 회사명 / 직무 입력</h4>
<p>지원 회사명과 직무는 <strong>필수</strong>입니다. "공고 ▼" 버튼으로 JD(공고 내용)도 입력할 수 있으며, JD 키워드가 첨삭에 자동 반영됩니다.</p>

<h4>③ 자소서 입력</h4>
<p>좌측 패널에 자기소개서를 입력합니다. 3가지 방법:</p>
<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li><strong>파일 드래그 앤 드롭</strong> — PDF, Word(.docx), HWP, HWPX, 텍스트 파일</li>
  <li><strong>파일 업로드 버튼</strong> — 파일 탐색기에서 선택</li>
  <li><strong>직접 입력</strong> — 텍스트 영역에 붙여넣기</li>
</ul>

<h4>④ 첨삭 시작</h4>
<p><strong>"첨삭 시작"</strong> 버튼을 클릭하면 AI가 분석을 시작합니다. (약 30초~1분 소요)</p>

<h3>2-3. 자동 저장 (v3.1)</h3>
<p>모든 작업은 <strong>자동으로 저장</strong>됩니다. 별도의 "저장" 버튼은 없습니다.</p>
<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li>"첨삭 시작" 클릭 시점에 컨설팅 건이 자동 생성됩니다.</li>
  <li>회사명·직무·공고 변경, 컨설턴트 직접 수정, AI 결과 등 모든 단계가 즉시 저장됩니다.</li>
  <li>상단 우측의 <strong>"✓ 자동 저장됨"</strong> 표시로 저장 상태를 확인할 수 있습니다.</li>
  <li>화면을 닫아도 작업이 유실되지 않으며, 같은 컨설팅을 다시 열면 마지막 상태로 복원됩니다.</li>
</ul>

<div class="tip">자동 저장은 컨설팅 데이터(회사·직무·자소서·수정본)에만 적용됩니다. <strong>학습 데이터 등록은 별도</strong>입니다 (5장 참조).</div>

<!-- 3. 결과 검토 및 수정 -->
<h2 class="page-break">3. 결과 검토 및 수정</h2>

<h3>3-1. 결과 보기 모드</h3>

<table>
  <tr><th>탭</th><th>설명</th></tr>
  <tr><td><strong>비교</strong></td><td>원본과 첨삭 결과를 나란히 비교. <span style="background:#dcfce7; color:#16a34a; padding:1px 4px; border-radius:3px;">추가</span>와 <span style="background:#fee2e2; color:#dc2626; padding:1px 4px; border-radius:3px; text-decoration:line-through;">삭제</span>가 하이라이트됩니다.</td></tr>
  <tr><td><strong>결과</strong></td><td>첨삭된 최종 텍스트만 표시합니다.</td></tr>
  <tr><td><strong>수정</strong></td><td>컨설턴트가 AI 결과를 직접 편집할 수 있습니다.</td></tr>
</table>

<h3>3-2. 결과 확인 후 선택지</h3>

<p>AI 첨삭 결과가 나오면, 우측 하단에 액션 버튼이 표시됩니다.</p>

<div class="screen">
  <div class="screen-title">결과 확인 모드 — 액션바</div>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 9pt; color: #9ca3af;">결과를 검토하세요. 수정이 필요하면 '수정' 탭을 누르세요.</span>
    <span><span class="btn btn-blue">이대로 확정</span> <span class="btn btn-gray">수정하기</span></span>
  </div>
</div>

<div class="screen">
  <div class="screen-title">수정 모드 — 액션바</div>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 9pt; color: #f59e0b; font-weight: 600;">수정됨</span>
    <span><span class="btn btn-blue">수정본으로 확정</span> <span class="btn btn-gray">AI 재첨삭 요청</span></span>
  </div>
</div>

<table>
  <tr><th>버튼</th><th>동작</th></tr>
  <tr><td><strong>이대로 확정</strong></td><td>AI 결과를 그대로 최종본으로 채택합니다.</td></tr>
  <tr><td><strong>수정하기</strong></td><td>"수정" 탭으로 전환하여 직접 편집합니다.</td></tr>
  <tr><td><strong>수정본으로 확정</strong></td><td>컨설턴트가 편집한 내용을 최종본으로 채택합니다.</td></tr>
  <tr><td><strong>AI 재첨삭 요청</strong></td><td>(선택) 수정본을 AI에게 다시 보내 추가 첨삭을 요청합니다.</td></tr>
</table>

<div class="tip"><strong>"AI 재첨삭 요청"은 선택사항</strong>입니다. 컨설턴트가 수정한 내용이 곧 최종본이 될 수 있으며, 반드시 AI를 다시 거칠 필요는 없습니다.</div>

<h3>3-3. 수정 방법</h3>
<p>"수정" 탭에서 두 가지 방법으로 수정할 수 있습니다:</p>
<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li><strong>직접 편집</strong> — 텍스트 영역에서 바로 수정</li>
  <li><strong>파일 업로드/드래그</strong> — 수정된 파일을 우측 패널에 드래그하거나 "파일" 버튼으로 업로드</li>
</ul>

<h3>3-4. 버전 타임라인</h3>
<p>화면 하단에 작업 이력이 타임라인으로 표시됩니다. 각 버전을 클릭하면 해당 시점의 내용을 확인할 수 있습니다.</p>

<div class="screen">
  <div class="screen-title">버전 타임라인</div>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 14px; display: flex; align-items: center; gap: 6px;">
    <span style="font-size: 8pt; font-weight: 600; color: #6b7280; margin-right: 8px;">이력</span>
    <span class="timeline-chip original">📄 원본 14:30</span>
    <span style="color: #d1d5db;">→</span>
    <span class="timeline-chip ai">⚡ AI 첨삭 14:31</span>
    <span style="color: #d1d5db;">→</span>
    <span class="timeline-chip edit">✎ 컨설턴트 수정 14:35</span>
    <span style="color: #d1d5db;">→</span>
    <span class="timeline-chip confirm">✓ 최종 확정 14:36</span>
  </div>
</div>

<!-- 4. 평가 시스템 -->
<h2 class="page-break">4. 평가 시스템</h2>

<h3>4-1. 5항목 평가</h3>
<p>우측 "평가" 버튼을 클릭하면 평가 패널이 열립니다. AI가 5가지 항목을 1~5점으로 평가합니다.</p>

<table>
  <tr><th>항목</th><th>평가 기준</th></tr>
  <tr><td><strong>구체성</strong></td><td>경험과 성과의 정량적 서술 수준 (수치, Before→After)</td></tr>
  <tr><td><strong>논리성</strong></td><td>문항 내 논리 흐름, 문제→원인→해결→결과 구조</td></tr>
  <tr><td><strong>직무연관성</strong></td><td>JD 요구사항과의 매칭 정도, 키워드 반영</td></tr>
  <tr><td><strong>차별성</strong></td><td>지원자만의 고유한 경험/관점</td></tr>
  <tr><td><strong>표현력</strong></td><td>문장 품질, 격식 어조, 종결어미 일관성</td></tr>
</table>

<h3>4-2. Before/After 비교</h3>
<p><strong>확정 시 자동으로 재평가</strong>가 실행됩니다. 원본 대비 최종본의 점수 변화를 한눈에 확인할 수 있습니다.</p>

<div class="screen">
  <div class="screen-title">평가 패널 — Before/After</div>
  <div style="display: inline-block; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; width: 200px;">
    <div style="font-size: 10pt; font-weight: 600; color: #374151; margin-bottom: 10px;">최종 평가</div>
    <div style="text-align: center; margin-bottom: 10px;">
      <span style="font-size: 12pt; color: #9ca3af; text-decoration: line-through;">2.8</span>
      <span style="font-size: 24pt; font-weight: 700; color: #2563eb; margin-left: 8px;">4.2</span>
      <div style="font-size: 9pt; color: #16a34a; font-weight: 600;">+1.4 개선</div>
    </div>
    <div style="font-size: 8pt;">
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb;"><span>구체성</span><span>★★★★☆ <span style="color:#16a34a;">+2</span></span></div>
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb;"><span>논리성</span><span>★★★★★ <span style="color:#16a34a;">+1</span></span></div>
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb;"><span>직무연관성</span><span>★★★★☆ <span style="color:#16a34a;">+2</span></span></div>
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e7eb;"><span>차별성</span><span>★★★☆☆</span></div>
      <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>표현력</span><span>★★★★☆ <span style="color:#16a34a;">+2</span></span></div>
    </div>
  </div>
</div>

<h3>4-3. 총평</h3>
<p>각 항목별 진단, 개선 방법, 고객이 보완할 사항이 포함됩니다. 컨설턴트가 총평을 <strong>직접 수정</strong>할 수도 있으며, 수정된 총평은 저장 시 학습 데이터에 반영됩니다.</p>

<!-- 5. 마무리 및 학습 등록 -->
<h2 class="page-break">5. 마무리 및 학습 등록</h2>

<h3>5-1. 흐름 (v3.1)</h3>

<div class="flow">
  <div class="flow-item">결과 확인</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item active">확정</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item">메모 + 학습 토글</div>
  <div class="flow-arrow">→</div>
  <div class="flow-item green">마무리</div>
</div>

<p>"확정"을 클릭하면 작업이 *최종본*으로 잠기고, 자동으로 재평가가 실행됩니다. 그다음 다음 두 가지를 정한 뒤 <strong>"마무리"</strong>를 누릅니다.</p>

<h4>① 컨설팅 방향 메모 (선택)</h4>
<p>이번 첨삭의 핵심 방향을 한 줄로 적습니다. (예: "JD 키워드 이식 중심, 금융 어조 적용")</p>

<h4>② 학습 데이터 등록 토글</h4>
<p><strong>"이 사례를 학습 데이터로 추가"</strong> 체크박스로 학습 등록 여부를 결정합니다.</p>

<div class="screen">
  <div class="screen-title">확정 후 — 마무리 영역</div>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px;">
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 10px; font-size: 9pt; color: #9ca3af; margin-bottom: 10px;">컨설팅 방향 메모 (예: JD 키워드 이식 중심, 금융 어조 적용)</div>
    <div style="font-size: 9pt; margin-bottom: 10px;">
      <span style="margin-right: 6px;">☑</span>
      이 사례를 학습 데이터로 추가
      <span style="color: #9ca3af; font-size: 8pt;">(컨설턴트 수정 있음 — 추천)</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 8pt; color: #9ca3af;">확정 완료 — "마무리"를 누르면 학습 등록이 처리됩니다</span>
      <span><span class="btn btn-gray">확정 해제</span> <span class="btn btn-blue">마무리</span></span>
    </div>
  </div>
</div>

<table>
  <tr><th>상황</th><th>토글 기본값</th><th>이유</th></tr>
  <tr><td>컨설턴트가 직접 수정한 후 확정</td><td><strong>ON</strong> (체크됨)</td><td>컨설턴트의 판단이 담긴 결과 → 학습 가치 높음</td></tr>
  <tr><td>AI 결과를 그대로 확정 (수정 없음)</td><td><strong>OFF</strong> (체크 안 됨)</td><td>AI가 AI를 학습하는 순환 방지. 의식적으로 체크할 때만 등록.</td></tr>
</table>

<h4>③ 마무리 클릭</h4>
<p>"마무리"를 누르면:</p>
<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li>(자동 저장은 이미 완료된 상태) 컨설팅이 완료 상태로 잠깁니다.</li>
  <li>학습 토글이 <strong>ON</strong>이면 원본→최종본이 학습 데이터에 추가되고, AI가 다음 첨삭 시 이 패턴을 참고합니다.</li>
  <li>학습 토글이 <strong>OFF</strong>면 학습 데이터로 등록하지 않습니다 (컨설팅 자체는 이력으로 남음).</li>
</ul>

<div class="tip"><strong>확정 해제</strong>는 마무리 *전*까지만 가능합니다. 마무리 후에는 잠깁니다. 확정 해제하면 다시 "수정" 모드로 돌아가 추가 편집할 수 있습니다.</div>

<h3>5-2. 학습 시스템 작동 방식</h3>
<p>Mong은 컨설턴트의 첨삭 스타일을 학습합니다. <strong>마무리 시 학습 토글을 켜고 사용할수록 컨설턴트의 스타일에 가까워집니다.</strong></p>

<table>
  <tr><th>데이터</th><th>용도</th></tr>
  <tr><td>합격자소서 (캘리브레이션)</td><td>평가 기준점 (4~5점 레퍼런스)</td></tr>
  <tr><td>첨삭 사례 (training_cases)</td><td>컨설턴트 스타일 학습 (마무리 시 토글 ON으로 추가)</td></tr>
  <tr><td>스타일 프로파일</td><td>어미/단어/구조 규칙 자동 추출</td></tr>
  <tr><td>전문가 노하우 (EXPERT_KNOWHOW)</td><td>컨설턴트 본인이 작성한 판단 프레임워크 (advisory)</td></tr>
</table>

<div class="warning">학습 토글을 무분별하게 켜지 마세요. <strong>컨설턴트가 직접 수정한 결과만 켜는 것이 권장</strong>됩니다. 그렇지 않으면 AI가 자기 결과를 다시 학습하는 순환이 발생해 품질이 떨어질 수 있습니다.</div>

<!-- 6. 고객관리 -->
<h2 class="page-break">6. 고객관리</h2>

<div class="screen">
  <div class="screen-title">고객관리 화면</div>
  <div class="screen-layout">
    <div class="screen-panel sidebar">
      <div class="screen-header">고객 목록</div>
      <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 8px; font-size: 8pt; color: #9ca3af; margin-bottom: 6px;">고객 검색...</div>
      <div class="btn btn-blue" style="width: 100%; text-align: center; margin-bottom: 8px;">+ 고객 추가</div>
      <div style="padding: 6px 8px; background: #eff6ff; border-left: 2px solid #2563eb; border-radius: 4px; font-size: 8pt; margin-bottom: 4px;"><strong>김철수</strong><br><span style="color:#9ca3af;">금융 / 은행원</span></div>
      <div style="padding: 6px 8px; font-size: 8pt; margin-bottom: 4px;">이영희<br><span style="color:#9ca3af;">IT / 개발</span></div>
    </div>
    <div class="screen-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div class="screen-header" style="margin:0; font-size: 12pt;">김철수</div>
        <div><span class="btn btn-blue">새 첨삭 시작</span> <span class="btn btn-gray">수정</span> <span class="btn btn-red">삭제</span></div>
      </div>
      <div style="font-size: 8pt; margin-bottom: 10px;">
        <strong>기본 정보</strong><br>
        이메일: kim@test.com | 학력: OO대학교 | 희망: 금융 / 은행원
      </div>
      <div style="font-size: 8pt;">
        <strong>첨삭 이력 (2건)</strong>
        <table style="font-size: 8pt;">
          <tr><th>날짜</th><th>회사</th><th>직무</th><th>상태</th><th>결과</th><th></th></tr>
          <tr><td>2026-04-04</td><td>하나은행</td><td>기업금융</td><td><span style="background:#dcfce7; color:#16a34a; padding:1px 6px; border-radius:10px; font-size:7pt;">완료</span></td><td style="color:#16a34a;">최종 합격 ▾</td><td><span class="btn btn-gray">열기</span> <span class="btn btn-red">삭제</span></td></tr>
        </table>
      </div>
    </div>
  </div>
</div>

<h3>6-1. 고객 등록</h3>
<p>좌측 <strong>"+ 고객 추가"</strong> 버튼 또는 첨삭하기 화면에서 인라인 등록이 가능합니다.</p>

<h3>6-2. 첨삭 이력 확인</h3>
<p>고객 선택 → 첨삭 이력에서 <strong>"열기"</strong>를 클릭하면 해당 첨삭 내용이 첨삭 페이지에 복원됩니다.</p>

<h3>6-3. 결과 입력하기 (v3.1)</h3>
<p>고객의 자소서가 실제로 합격했는지 추적할 수 있습니다. 첨삭 이력 테이블의 <strong>"결과" 컬럼</strong> 드롭다운을 클릭하면 단계를 선택할 수 있습니다.</p>

<table>
  <tr><th>옵션</th><th>의미</th></tr>
  <tr><td>결과 대기</td><td>아직 결과 없음 (기본값)</td></tr>
  <tr><td>서류 통과</td><td>1차 서류 전형 통과</td></tr>
  <tr><td>서류 탈락</td><td>1차 서류 전형 탈락</td></tr>
  <tr><td>최종 합격</td><td>최종 합격</td></tr>
  <tr><td>최종 탈락</td><td>면접 등 최종 탈락</td></tr>
  <tr><td>모름</td><td>추적 불가, 클라이언트 응답 없음</td></tr>
</table>

<div class="tip">결과를 입력해두면 대시보드 측정 탭에서 합격률 추세를 확인할 수 있고, 시간이 지나면서 어떤 첨삭 패턴이 합격에 기여했는지 분석할 수 있는 자료가 됩니다.</div>

<h3>6-4. 페이지 간 이동</h3>
<table>
  <tr><th>출발</th><th>동작</th><th>도착</th></tr>
  <tr><td>첨삭하기</td><td>"고객 정보" 버튼</td><td>고객관리 (해당 고객 선택)</td></tr>
  <tr><td>고객관리</td><td>"새 첨삭 시작" 버튼</td><td>첨삭하기 (고객 자동 선택)</td></tr>
  <tr><td>고객관리</td><td>이력 "열기" 버튼</td><td>첨삭하기 (이전 내용 복원)</td></tr>
  <tr><td>대시보드</td><td>최근 첨삭 행 클릭</td><td>첨삭하기 (해당 건 열기)</td></tr>
</table>

<!-- 7. 대시보드 -->
<h2 class="page-break">7. 대시보드</h2>

<h3>7-1. 개요 탭</h3>
<p>총 고객 수, 이번 달 첨삭 건수, 진행중/완료 현황과 최근 첨삭 목록을 확인합니다.</p>

<h3>7-2. 품질 탭</h3>
<p>첨삭 품질을 추적합니다. 평가된 모든 첨삭의 항목별 점수를 확인할 수 있습니다.</p>

<h3>7-3. 측정 탭 (v3.1)</h3>
<p>컨설턴트의 작업 패턴과 시스템의 효과를 정량 측정합니다. 측정 탭 옆에 30일 넘은 미입력 결과가 있으면 빨간 배지로 표시됩니다.</p>

<table>
  <tr><th>지표</th><th>의미</th><th>활용</th></tr>
  <tr><td><strong>평균 수정률</strong></td><td>AI 결과를 컨설턴트가 얼마나 손봤는지 (글자 단위 차이 비율)</td><td>낮을수록 AI 품질이 좋음. 시간 지나며 추세를 본다.</td></tr>
  <tr><td><strong>무수정 통과율</strong></td><td>컨설턴트가 손대지 않고 AI 결과를 그대로 확정한 비율</td><td>높을수록 AI 결과의 만족도가 높음.</td></tr>
  <tr><td><strong>평균 작업시간</strong></td><td>컨설팅 한 건당 컨설턴트가 화면을 본 시간 (2분 idle 자동 제외)</td><td>시간 단축이 품질 유지와 함께 일어나면 시스템 효과 증명.</td></tr>
  <tr><td><strong>결과 입력 대기 (30일+)</strong></td><td>마무리 후 30일이 지났는데 outcome이 "결과 대기"인 컨설팅 수</td><td>입력해야 합격률 데이터가 의미를 가짐. 클릭해서 입력 처리.</td></tr>
</table>

<div class="screen">
  <div class="screen-title">측정 탭 — 일부</div>
  <div style="display: flex; gap: 8px; margin-bottom: 8px;">
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700; color:#2563eb;">12%</div>
      <div style="font-size:8pt; color:#9ca3af;">평균 수정률 (30일, 8건)</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700; color:#16a34a;">38%</div>
      <div style="font-size:8pt; color:#9ca3af;">무수정 통과율 (30일)</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700;">14분</div>
      <div style="font-size:8pt; color:#9ca3af;">평균 작업시간 (30일)</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700; color:#dc2626;">3</div>
      <div style="font-size:8pt; color:#9ca3af;">결과 입력 대기</div>
    </div>
  </div>
</div>

<p>아래에는 결과 분포(서류 통과/탈락/최종 합격/탈락)와 최근 완료된 컨설팅의 측정값 표가 표시됩니다. 표의 결과 드롭다운에서 바로 outcome을 변경할 수 있습니다.</p>

<div class="screen">
  <div class="screen-title">대시보드 — 품질 탭</div>
  <div style="display: flex; gap: 10px; margin-bottom: 10px;">
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700; color:#2563eb;">4.1</div>
      <div style="font-size:8pt; color:#9ca3af;">평균 평가 점수</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700;">12</div>
      <div style="font-size:8pt; color:#9ca3af;">평가된 첨삭</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700;">27</div>
      <div style="font-size:8pt; color:#9ca3af;">합격자소서</div>
    </div>
    <div style="flex:1; background:white; border:1px solid #e5e7eb; border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:18pt; font-weight:700;">23</div>
      <div style="font-size:8pt; color:#9ca3af;">학습 데이터</div>
    </div>
  </div>
</div>

<!-- 8. 기타 기능 -->
<h2 class="page-break">8. 기타 기능</h2>

<h3>8-1. 다크모드</h3>
<p>상단 네비게이션의 <strong>🌙/☀️ 버튼</strong>으로 다크모드를 전환합니다. 설정은 자동 저장됩니다.</p>

<h3>8-2. Word 내보내기</h3>
<p>첨삭 결과 우측의 <strong>"내보내기"</strong> 버튼을 클릭하면 현재 내용을 Word(.docx) 파일로 저장합니다.</p>

<h3>8-3. 학습 데이터 Import</h3>
<p>상단의 <strong>"Import"</strong> 버튼으로 과거 첨삭 사례를 일괄 등록할 수 있습니다.</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-content">폴더를 선택합니다. 파일명에 단계 키워드가 포함되어야 합니다.<br>
    <code>대한통운 IT 최초.docx</code> / <code>대한통운 IT 첨삭중.docx</code> / <code>대한통운 IT 최종.docx</code></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-content">미리보기에서 자동 감지된 그룹과 단계를 확인합니다.</div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-content">"Import" 버튼으로 일괄 등록합니다. JD 파일(_JD.docx)도 자동 인식됩니다.</div>
</div>

<table>
  <tr><th>키워드</th><th>매핑 단계</th></tr>
  <tr><td>최초, 초안, 원본</td><td>초안 (draft)</td></tr>
  <tr><td>첨삭중, 1차</td><td>1차 첨삭 (first)</td></tr>
  <tr><td>2차</td><td>2차 첨삭 (second)</td></tr>
  <tr><td>최종, 완성</td><td>최종 (final)</td></tr>
  <tr><td>JD, 공고</td><td>JD (direction_memo에 저장)</td></tr>
</table>

<h3>8-4. 자동 업데이트</h3>
<p>앱 실행 시 새 버전이 있으면 자동으로 알림이 표시됩니다. "지금 재시작"을 클릭하면 업데이트가 적용됩니다.</p>

<h3>8-5. 탭 전환 시 상태 유지</h3>
<p>첨삭 중 고객관리나 대시보드 탭으로 이동했다가 돌아와도 <strong>작업 내용이 유지</strong>됩니다.</p>

<!-- 9. Mong이 자소서를 다루는 방식 -->
<h2 class="page-break">9. Mong이 자소서를 다루는 방식</h2>

<p>Mong의 AI는 무조건 자소서를 *수정*하는 도구가 아닙니다. 다음 두 가지 메타 원칙을 우선 적용합니다.</p>

<h3>9-1. 이미 좋은 자소서는 손대지 않습니다</h3>

<p>원문이 다음 기준을 대부분 충족하면 AI는 <strong>거의 변경하지 않고 원문을 그대로 반환</strong>합니다. 맞춤법 정도만 교정합니다.</p>

<table>
  <tr><th>충족 신호</th></tr>
  <tr><td>도입부 첫 3줄이 일반론("빠르게 변화하는") 없이 수치·상황으로 시작</td></tr>
  <tr><td>모든 문항에 [행동/기술 + 정량성과] 형식 소제목</td></tr>
  <tr><td>JD 핵심 동사·키워드가 도입부와 마무리에 자연스럽게 박힘</td></tr>
  <tr><td>정량 수치가 Before→After 형태 ("9분→4분", "12% 단축")</td></tr>
  <tr><td>종결 어미 격식체 통일 ("했습니다", "기여하겠습니다")</td></tr>
  <tr><td>평균 회귀 단어("열정/도전/성장/주도적/혁신") 거의 없음</td></tr>
  <tr><td>한 문항당 에피소드 1개 집중 (나열 아님)</td></tr>
</table>

<p>일부만 충족하면 미충족 부분만 핀포인트 수정합니다. <strong>이미 좋은 부분은 절대 건드리지 않습니다.</strong></p>

<div class="tip">"수정 안 함"도 컨설팅의 일부입니다. AI 결과의 comments에 "원문 품질 우수, 큰 수정 불필요"라고 명시되며, 평가는 4-5점이 부여됩니다.</div>

<h3>9-2. 사람이 쓴 글처럼 만듭니다</h3>

<p>채용담당자가 자소서를 보고 "GPT 같다"고 느끼면 신뢰도가 즉시 떨어집니다. AI는 <strong>다음 신호를 회피</strong>합니다.</p>

<table>
  <tr><th>회피 대상</th><th>이유</th></tr>
  <tr><td>모든 문장 비슷한 길이로 정렬</td><td>사람의 글은 짧고 긴 리듬이 섞임</td></tr>
  <tr><td>"이를 통해", "다음과 같은", "결과적으로" 같은 형식 연결어</td><td>AI 흔적의 대표 신호</td></tr>
  <tr><td>모든 결론 "~하겠습니다"로 매끈한 마무리</td><td>사람은 종결을 다양하게 함</td></tr>
  <tr><td>추상명사 위주 표현 ("성장과 도전의 기회")</td><td>구체성 결여, 자동 생성 느낌</td></tr>
  <tr><td>감정 평탄화 (인상적 사건도 같은 어조)</td><td>사람의 글은 강조 분배 불균형</td></tr>
</table>

<p>그리고 <strong>다음을 적극적으로 보존·강화</strong>합니다.</p>

<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li><strong>원문 작성자의 어휘</strong>를 보존합니다. 본인이 쓴 단어를 다른 단어로 바꾸지 않습니다 (평균 회귀 단어 제외).</li>
  <li>문장 길이를 의도적으로 흐트러트립니다 (긴 문장 옆에 짧은 문장).</li>
  <li>첨삭한 부분의 톤이 <strong>주변 원문 톤과 일치</strong>하도록 합니다.</li>
  <li>약간의 <strong>불완전함</strong>을 허용합니다. 너무 매끄러운 결론보다 살짝 거친 마무리가 더 사람 같습니다.</li>
  <li>작성자만 알 만한 디테일(구체 수치, 고유 명칭, 의외성)을 <strong>반드시 보존</strong>합니다.</li>
</ul>

<div class="warning"><strong>"AI 흔적이 남는 룰"보다 "사람의 글로 보이는 결과"가 우선합니다.</strong> 어떤 일반 룰이 결과를 AI스럽게 만들면 그 룰을 적용하지 않습니다.</div>

<h3>9-3. 절대 하지 않는 것</h3>
<ul style="margin-left: 20px; margin-bottom: 10px;">
  <li><strong>원문에 없는 경험·수치·프로젝트를 창작하지 않습니다.</strong> 추론으로 표현을 다듬는 것은 가능 ("상당부분" → "약 40%")하지만, 없는 사실을 만들어내지 않습니다.</li>
  <li>부족한 부분은 <strong>괄호 질문형 메모</strong>로 고객에게 요청합니다. 예: "(이 프로젝트의 구체 성과 수치를 작성해주세요!)"</li>
  <li>회사의 고유 제도/상품명도 <strong>실재 확인</strong> 후에만 사용합니다. 불확실하면 "(회사의 관련 제도명을 확인하여 삽입해주세요)"로 남깁니다.</li>
</ul>

<div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 9pt;">
  Mong Consulting v3.1 — AI 자소서 컨설팅 사용자 가이드<br>
  © 2026
</div>

</body>
</html>`;

fs.writeFileSync(HTML_PATH, html, 'utf-8');
console.log('HTML 생성:', HTML_PATH);
console.log('PDF 변환을 위해 Electron을 사용합니다...');

// Electron으로 PDF 렌더링
const electronScript = `
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 794, height: 1123 });
  await win.loadFile('${HTML_PATH.replace(/\\/g, '/')}');
  await new Promise(r => setTimeout(r, 2000));
  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  fs.writeFileSync('${PDF_PATH.replace(/\\/g, '/')}', pdf);
  console.log('PDF saved:', '${PDF_PATH.replace(/\\/g, '/')}');
  app.quit();
});
`;

const scriptPath = path.join(OUTPUT_DIR, '_pdf-gen.cjs');
fs.writeFileSync(scriptPath, electronScript);

try {
  execSync(`npx electron "${scriptPath}"`, { cwd: path.join(__dirname, '..'), stdio: 'inherit', timeout: 30000 });
  fs.unlinkSync(scriptPath);
  fs.unlinkSync(HTML_PATH);
  console.log('\n✅ PDF 생성 완료:', PDF_PATH);
} catch (e: any) {
  console.error('PDF 생성 실패:', e.message);
  console.log('HTML 파일은 유지됩니다:', HTML_PATH);
}
