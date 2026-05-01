// Mong UI 스모크 테스트
// 기동 중인 Electron(CDP 9222)에 연결하여 핵심 흐름 자동 검증

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TEST_USER = { username: 'admin', password: 'admin123' };
const SAMPLE_RESUME = `안녕하십니까. 저는 컴퓨터공학을 전공하고 6개월간 IT 스타트업에서 백엔드 개발 인턴으로 근무한 경험이 있습니다. 적극적으로 팀에 참여하여 다양한 프로젝트를 수행했고, REST API 설계와 데이터베이스 최적화 업무를 맡아 진행했습니다. 무궁무진한 가능성을 가진 분야에서 더욱 성장하고 싶습니다.`;

const SHOTS_DIR = path.join(__dirname, '..', 'tmp-shots');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR);

async function shot(page, name) {
  const p = path.join(SHOTS_DIR, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false }).catch(() => {});
  console.log('  📸', p);
}

async function main() {
  console.log('[1/9] CDP 연결...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0];
  if (!context) throw new Error('No browser context found');

  let page = context.pages().find(p => p.url().includes('5173') || p.url().includes('index.html'));
  if (!page) page = await context.waitForEvent('page', { timeout: 10000 });
  console.log('  page url:', page.url());

  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGE ERROR: ' + e.message));

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-initial');

  // ===== 로그인 =====
  console.log('[2/9] 로그인...');
  const titleText = await page.locator('h1').first().textContent().catch(() => '');
  console.log('  현재 화면 h1:', titleText);

  // 이미 로그인된 상태(상단 nav '첨삭하기' 보임)면 스킵
  const navVisible = await page.locator('text=첨삭하기').first().isVisible().catch(() => false);
  if (navVisible) {
    console.log('  이미 로그인 상태 — 스킵');
  } else {
    const usernameInput = page.locator('input[placeholder="아이디"]');
    const passwordInput = page.locator('input[type="password"]');
    await usernameInput.waitFor({ timeout: 8000 });
    await usernameInput.fill(TEST_USER.username);
    await passwordInput.fill(TEST_USER.password);
    await shot(page, '02-login-filled');
    await page.locator('button[type="submit"]').first().click();
    console.log('  로그인 버튼 클릭 → API 응답 대기...');
    await page.waitForSelector('text=첨삭하기', { timeout: 20000 });
    console.log('  로그인 성공');
  }
  await shot(page, '03-after-login');

  // ===== 첨삭 페이지 =====
  console.log('[3/9] 첨삭 페이지 진입...');
  await page.locator('button.nav-tab:has-text("첨삭하기")').click();
  await page.waitForTimeout(800);

  // 자동저장 인디케이터 (consultingId 없을 땐 "입력 중")
  const autoSaveBefore = await page.locator('.info-bar > div').last().textContent().catch(() => '');
  console.log('  자동저장 인디케이터(시작 전):', autoSaveBefore.trim().slice(0, 50));

  // ===== 고객 선택 =====
  console.log('[4/9] 고객 선택...');
  await page.locator('.client-selector').click();
  await page.waitForTimeout(400);
  const itemCount = await page.locator('.dropdown-item').count();
  console.log('  드롭다운 항목 수:', itemCount);
  if (itemCount > 0) {
    const first = page.locator('.dropdown-item').first();
    const name = await first.locator('.dropdown-item-name').textContent();
    console.log('  선택:', name);
    await first.click();
  } else {
    console.log('  기존 고객 없음 → 새 고객 등록');
    await page.locator('button:has-text("+ 새 고객 등록")').click();
    await page.waitForTimeout(300);
    await page.locator('input[placeholder="고객 이름"]').fill('AUTOTEST_' + Date.now());
    await page.locator('button:has-text("등록")').click();
    await page.waitForTimeout(800);
  }

  // ===== 회사/직무 =====
  console.log('[5/9] 회사/직무/자소서 입력...');
  await page.locator('input[placeholder*="회사"]').fill('스모크테스트회사');
  await page.locator('input[placeholder*="직무"]').fill('백엔드');
  await page.locator('textarea[placeholder*="자기소개서"]').fill(SAMPLE_RESUME);
  await page.waitForTimeout(500);
  await shot(page, '05-form-filled');

  // ===== 첨삭 시작 =====
  console.log('[6/9] 첨삭 시작 (AI 호출 — 30~90초)...');
  await page.locator('button:has-text("첨삭 시작")').click();
  // 결과 패널의 "첨삭 결과" 헤더가 나타날 때까지
  await page.waitForSelector('button:has-text("이대로 확정")', { timeout: 120000 });
  await page.waitForTimeout(1500);
  await shot(page, '06-after-revise');

  const autoSaveAfter = await page.locator('.info-bar > div').last().textContent().catch(() => '');
  console.log('  자동저장 인디케이터(첨삭 후):', autoSaveAfter.trim().slice(0, 50));

  // ===== 확정 =====
  console.log('[7/9] 이대로 확정...');
  await page.locator('button:has-text("이대로 확정")').first().click();
  await page.waitForTimeout(5000);  // 재평가 시간 포함
  await shot(page, '07-after-confirm');

  const trainingToggle = await page.locator('text=학습 데이터로 추가').isVisible().catch(() => false);
  const finalizeBtn = await page.locator('button:has-text("마무리")').isVisible().catch(() => false);
  console.log('  학습 토글:', trainingToggle, '/ 마무리 버튼:', finalizeBtn);

  // ===== 마무리 =====
  console.log('[8/9] 마무리...');
  if (finalizeBtn) {
    await page.locator('button:has-text("마무리")').click();
    await page.waitForTimeout(2000);
    const done = await page.locator('text=/마무리 완료|마무리됨/').first().isVisible().catch(() => false);
    console.log('  마무리 완료 표시:', done);
    await shot(page, '08-finalized');
  }

  // ===== 측정 탭 =====
  console.log('[9/9] 대시보드 측정 탭...');
  await page.locator('button.nav-tab:has-text("대시보드")').click();
  await page.waitForTimeout(800);
  await page.locator('button.stage-tab:has-text("측정")').click();
  await page.waitForTimeout(2500);
  await shot(page, '09-metrics-tab');

  const cardCount = await page.locator('.stat-card').count();
  console.log('  stat-card 개수:', cardCount);
  const tableRows = await page.locator('table tbody tr').count();
  console.log('  최근 테이블 행:', tableRows);

  console.log('\n========== RESULT ==========');
  console.log('Console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 6).forEach(e => console.log('  ❗', e.slice(0, 200)));
  }
  console.log('스크린샷:', SHOTS_DIR);
  console.log('PASS');
  await browser.close();
}

main().catch(async e => {
  console.error('\n❌ TEST FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
