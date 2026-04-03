import { Router, Request, Response } from 'express';
import { getDb } from './database';
import { performRevision, performEvaluation, analyzeTrainingPattern, invalidateProfileCache } from './aiEngine';

const router = Router();

// ============ Helper ============

const toClient = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  education: row.education,
  major: row.major,
  experience: row.experience,
  targetIndustry: row.target_industry,
  targetPosition: row.target_position,
  memo: row.memo,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toConsulting = (row: any) => ({
  id: row.id,
  clientId: row.client_id,
  companyName: row.company_name,
  position: row.position,
  jobPosting: row.job_posting,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  clientName: row.client_name,
});

const toRevision = (row: any) => ({
  id: row.id,
  consultingId: row.consulting_id,
  stage: row.stage,
  content: row.content,
  comments: row.comments,
  evaluation: row.evaluation,
  createdAt: row.created_at,
});

const toCase = (row: any) => ({
  id: row.id,
  clientId: row.client_id,
  title: row.title,
  companyName: row.company_name,
  position: row.position,
  directionMemo: row.direction_memo,
  createdAt: row.created_at,
  clientName: row.client_name,
  revisionCount: row.revision_count,
});

const toTrainingRevision = (row: any) => ({
  id: row.id,
  caseId: row.case_id,
  stage: row.stage,
  content: row.content,
  createdAt: row.created_at,
});

// ============ Clients ============

router.get('/clients', (req: Request, res: Response) => {
  const userId = req.user?.id;
  const rows = getDb().prepare('SELECT * FROM clients WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC').all(userId);
  res.json(rows.map(toClient));
});

router.get('/clients/search', (req: Request, res: Response) => {
  const userId = req.user?.id;
  const q = req.query.q as string || '';
  const rows = getDb().prepare(`
    SELECT * FROM clients
    WHERE (user_id = ? OR user_id IS NULL) AND (name LIKE ? OR email LIKE ? OR target_industry LIKE ? OR target_position LIKE ?)
    ORDER BY updated_at DESC
  `).all(userId, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json(rows.map(toClient));
});

router.get('/clients/:id', (req: Request, res: Response) => {
  const row = getDb().prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(row ? toClient(row) : null);
});

router.post('/clients', (req: Request, res: Response) => {
  const data = req.body;
  const userId = req.user?.id;
  const stmt = getDb().prepare(`
    INSERT INTO clients (name, email, phone, education, major, experience, target_industry, target_position, memo, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name, data.email, data.phone, data.education,
    data.major, data.experience, data.targetIndustry, data.targetPosition, data.memo, userId
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/clients/:id', (req: Request, res: Response) => {
  const data = req.body;
  getDb().prepare(`
    UPDATE clients SET
      name = ?, email = ?, phone = ?, education = ?, major = ?,
      experience = ?, target_industry = ?, target_position = ?, memo = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.name, data.email, data.phone, data.education,
    data.major, data.experience, data.targetIndustry, data.targetPosition, data.memo,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/clients/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ Consultings ============

router.get('/consultings', (req: Request, res: Response) => {
  const clientId = req.query.clientId as string | undefined;
  let query = `
    SELECT c.*, cl.name as client_name
    FROM consultings c
    JOIN clients cl ON c.client_id = cl.id
  `;
  const params: any[] = [];
  if (clientId) {
    query += ' WHERE c.client_id = ?';
    params.push(clientId);
  }
  query += ' ORDER BY c.updated_at DESC';
  res.json(getDb().prepare(query).all(...params).map(toConsulting));
});

router.get('/consultings/:id', (req: Request, res: Response) => {
  const row = getDb().prepare(`
    SELECT c.*, cl.name as client_name
    FROM consultings c
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.id = ?
  `).get(req.params.id);
  res.json(row ? toConsulting(row) : null);
});

router.post('/consultings', (req: Request, res: Response) => {
  const data = req.body;
  const result = getDb().prepare(`
    INSERT INTO consultings (client_id, company_name, position, job_posting, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.clientId, data.companyName, data.position, data.jobPosting, data.status || 'draft');
  res.json({ id: result.lastInsertRowid });
});

router.delete('/consultings/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM consultings WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ Revisions ============

router.get('/revisions', (req: Request, res: Response) => {
  const consultingId = req.query.consultingId as string;
  const rows = getDb().prepare(`
    SELECT * FROM revisions WHERE consulting_id = ? ORDER BY created_at ASC
  `).all(consultingId);
  res.json(rows.map(toRevision));
});

router.post('/revisions', (req: Request, res: Response) => {
  const data = req.body;
  const result = getDb().prepare(`
    INSERT INTO revisions (consulting_id, stage, content, comments, evaluation)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.consultingId, data.stage, data.content,
    data.comments ? JSON.stringify(data.comments) : null,
    data.evaluation ? JSON.stringify(data.evaluation) : null
  );

  const newStatus = data.stage === 'final' ? 'completed' : 'in_progress';
  getDb().prepare(`
    UPDATE consultings SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(newStatus, data.consultingId);

  res.json({ id: result.lastInsertRowid });
});

// ============ AI Revision ============

router.post('/ai/revise', async (req: Request, res: Response) => {
  try {
    const result = await performRevision(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Raw AI call (for profile building scripts)
router.post('/ai/revise-raw', async (req: Request, res: Response) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk').default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: req.body.user }],
      system: req.body.system,
    });
    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock) { res.status(500).json({ error: 'No text' }); return; }
    let jsonStr = textBlock.text.trim();
    const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();
    try { res.json(JSON.parse(jsonStr)); } catch { res.json({ raw: textBlock.text }); }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Style Profile CRUD
router.get('/style-profile', (_req: Request, res: Response) => {
  const row = getDb().prepare('SELECT * FROM style_profile ORDER BY version DESC LIMIT 1').get() as any;
  if (!row) { res.json(null); return; }
  res.json({ id: row.id, version: row.version, profile: JSON.parse(row.profile), createdAt: row.created_at });
});

router.post('/style-profile', (req: Request, res: Response) => {
  const { profile } = req.body;
  const current = getDb().prepare('SELECT MAX(version) as v FROM style_profile').get() as any;
  const nextVersion = (current?.v || 0) + 1;
  const result = getDb().prepare('INSERT INTO style_profile (version, profile) VALUES (?, ?)').run(nextVersion, profile);
  res.json({ id: result.lastInsertRowid, version: nextVersion });
});

router.post('/ai/analyzePattern', async (req: Request, res: Response) => {
  try {
    const { original, final: finalText } = req.body;
    const pattern = await analyzeTrainingPattern(original, finalText);
    res.json({ pattern });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/evaluate', async (req: Request, res: Response) => {
  try {
    const result = await performEvaluation(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ Training Cases ============

router.get('/training/cases', (req: Request, res: Response) => {
  const clientId = req.query.clientId as string | undefined;
  let query = `
    SELECT tc.*, cl.name as client_name,
      (SELECT COUNT(*) FROM training_revisions tr WHERE tr.case_id = tc.id) as revision_count
    FROM training_cases tc
    LEFT JOIN clients cl ON tc.client_id = cl.id
  `;
  const params: any[] = [];
  if (clientId) {
    query += ' WHERE tc.client_id = ?';
    params.push(clientId);
  }
  query += ' ORDER BY tc.created_at DESC';
  res.json(getDb().prepare(query).all(...params).map(toCase));
});

router.get('/training/cases/:id', (req: Request, res: Response) => {
  const row = getDb().prepare(`
    SELECT tc.*, cl.name as client_name,
      (SELECT COUNT(*) FROM training_revisions tr WHERE tr.case_id = tc.id) as revision_count
    FROM training_cases tc
    LEFT JOIN clients cl ON tc.client_id = cl.id
    WHERE tc.id = ?
  `).get(req.params.id);
  res.json(row ? toCase(row) : null);
});

router.post('/training/cases', (req: Request, res: Response) => {
  const data = req.body;
  const result = getDb().prepare(`
    INSERT INTO training_cases (client_id, title, company_name, position, direction_memo)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.clientId || null, data.title, data.companyName, data.position, data.directionMemo);
  res.json({ id: result.lastInsertRowid });
});

router.delete('/training/cases/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM training_cases WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ Training Revisions ============

router.get('/training/revisions', (req: Request, res: Response) => {
  const caseId = req.query.caseId as string;
  const rows = getDb().prepare(`
    SELECT * FROM training_revisions WHERE case_id = ? ORDER BY
      CASE stage WHEN 'draft' THEN 1 WHEN 'first' THEN 2 WHEN 'second' THEN 3 WHEN 'final' THEN 4 END
  `).all(caseId);
  res.json(rows.map(toTrainingRevision));
});

router.post('/training/revisions', (req: Request, res: Response) => {
  const data = req.body;
  const existing = getDb().prepare(
    'SELECT id FROM training_revisions WHERE case_id = ? AND stage = ?'
  ).get(data.caseId, data.stage) as any;

  if (existing) {
    getDb().prepare(
      'UPDATE training_revisions SET content = ? WHERE case_id = ? AND stage = ?'
    ).run(data.content, data.caseId, data.stage);
    res.json({ id: existing.id });
  } else {
    const result = getDb().prepare(
      'INSERT INTO training_revisions (case_id, stage, content) VALUES (?, ?, ?)'
    ).run(data.caseId, data.stage, data.content);
    res.json({ id: result.lastInsertRowid });
  }

  // 스타일 프로파일 캐시 무효화 (새 데이터 반영)
  invalidateProfileCache();

  // 5건마다 프로파일 자동 재빌드 체크
  if (data.stage === 'final') {
    const count = (getDb().prepare(
      "SELECT COUNT(*) as cnt FROM training_revisions WHERE stage = 'final'"
    ).get() as any).cnt;
    const profileVersion = (getDb().prepare(
      'SELECT MAX(version) as v FROM style_profile'
    ).get() as any)?.v || 0;

    // 새 final이 5의 배수가 될 때마다 재빌드 필요 플래그
    if (count % 5 === 0 && count > 0) {
      console.log(`[StyleProfile] ${count}건 도달 — 프로파일 재빌드 권장 (현재 v${profileVersion})`);
    }
  }
});

router.delete('/training/revisions/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM training_revisions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ Training for Prompt ============

router.get('/training/prompt', (req: Request, res: Response) => {
  const db = getDb();
  const clientId = req.query.clientId as string | undefined;

  let cases: any[];
  if (clientId) {
    cases = db.prepare(`
      SELECT tc.* FROM training_cases tc
      WHERE tc.client_id = ?
      ORDER BY tc.created_at DESC LIMIT 3
    `).all(clientId);
  } else {
    cases = db.prepare(`
      SELECT tc.* FROM training_cases tc
      ORDER BY tc.created_at DESC LIMIT 3
    `).all();
  }

  const result = cases.map((tc: any) => {
    const revisions = db.prepare(`
      SELECT stage, content FROM training_revisions
      WHERE case_id = ?
      ORDER BY CASE stage WHEN 'draft' THEN 1 WHEN 'first' THEN 2 WHEN 'second' THEN 3 WHEN 'final' THEN 4 END
    `).all(tc.id);

    return {
      title: tc.title,
      companyName: tc.company_name,
      position: tc.position,
      directionMemo: tc.direction_memo,
      revisions: revisions.map((r: any) => ({ stage: r.stage, content: r.content })),
    };
  });

  res.json(result);
});

// ============ Import (server-side: receive parsed text) ============

router.post('/import/execute', (req: Request, res: Response) => {
  const { groups, clientId } = req.body;
  // groups: [{ title, companyName, position, files: [{ stage, content }] }]
  const db = getDb();

  const insertCase = db.prepare(`
    INSERT INTO training_cases (client_id, title, company_name, position, direction_memo)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertRevision = db.prepare(`
    INSERT INTO training_revisions (case_id, stage, content) VALUES (?, ?, ?)
  `);

  let totalCases = 0;
  let totalRevisions = 0;
  const importedCases: { title: string; stages: string[] }[] = [];

  const transaction = db.transaction(() => {
    for (const group of groups) {
      const caseResult = insertCase.run(
        clientId || null, group.title, group.companyName || '', group.position || '', group.directionMemo || ''
      );
      const caseId = caseResult.lastInsertRowid;
      totalCases++;

      const stages: string[] = [];
      for (const file of group.files) {
        if (file.content && file.content.trim()) {
          insertRevision.run(caseId, file.stage, file.content);
          totalRevisions++;
          stages.push(file.stage);
        }
      }
      importedCases.push({ title: group.title, stages });
    }
  });

  transaction();

  res.json({
    totalCases,
    totalRevisions,
    cases: importedCases,
  });
});

// ============ Dashboard ============

router.get('/dashboard/stats', (_req: Request, res: Response) => {
  const db = getDb();
  const totalClients = (db.prepare('SELECT COUNT(*) as cnt FROM clients').get() as any).cnt;
  const totalConsultings = (db.prepare('SELECT COUNT(*) as cnt FROM consultings').get() as any).cnt;
  const inProgress = (db.prepare("SELECT COUNT(*) as cnt FROM consultings WHERE status = 'in_progress'").get() as any).cnt;
  const completed = (db.prepare("SELECT COUNT(*) as cnt FROM consultings WHERE status = 'completed'").get() as any).cnt;
  const thisMonth = (db.prepare(`
    SELECT COUNT(*) as cnt FROM consultings
    WHERE created_at >= date('now', 'start of month', 'localtime')
  `).get() as any).cnt;

  const recent = db.prepare(`
    SELECT c.*, cl.name as client_name
    FROM consultings c
    JOIN clients cl ON c.client_id = cl.id
    ORDER BY c.updated_at DESC LIMIT 10
  `).all().map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    companyName: row.company_name,
    position: row.position,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientName: row.client_name,
  }));

  res.json({
    totalClients,
    totalConsultings,
    inProgress,
    completed,
    thisMonthConsultings: thisMonth,
    recentConsultings: recent,
  });
});

// ============ Calibration Data (합격자소서) ============

router.get('/calibration', (_req: Request, res: Response) => {
  const rows = getDb().prepare('SELECT * FROM calibration_data ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/calibration', (req: Request, res: Response) => {
  const { companyName, position, industry, content, source } = req.body;
  const result = getDb().prepare(
    'INSERT INTO calibration_data (company_name, position, industry, content, source) VALUES (?, ?, ?, ?, ?)'
  ).run(companyName, position || '', industry || '', content, source || 'accepted');
  res.json({ id: result.lastInsertRowid });
});

router.post('/calibration/batch', (req: Request, res: Response) => {
  const { items } = req.body;
  const insert = getDb().prepare(
    'INSERT INTO calibration_data (company_name, position, industry, content, source) VALUES (?, ?, ?, ?, ?)'
  );
  let count = 0;
  const transaction = getDb().transaction(() => {
    for (const item of items) {
      if (item.content && item.content.trim().length > 50) {
        insert.run(item.companyName, item.position || '', item.industry || '', item.content, item.source || 'accepted');
        count++;
      }
    }
  });
  transaction();
  res.json({ imported: count });
});

router.delete('/calibration/:id', (req: Request, res: Response) => {
  getDb().prepare('DELETE FROM calibration_data WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ Quality Stats ============

router.get('/dashboard/quality', (_req: Request, res: Response) => {
  const db = getDb();

  // evaluation이 있는 최근 revision들에서 점수 추출
  const rows = db.prepare(`
    SELECT r.evaluation, c.company_name, c.position, cl.name as client_name, r.created_at
    FROM revisions r
    JOIN consultings c ON r.consulting_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE r.evaluation IS NOT NULL
    ORDER BY r.created_at DESC LIMIT 20
  `).all() as any[];

  const items = rows.map((row: any) => {
    try {
      const ev = JSON.parse(row.evaluation);
      const avg = (ev.specificity + ev.logic + ev.relevance + ev.differentiation + ev.expression) / 5;
      return {
        companyName: row.company_name,
        position: row.position,
        clientName: row.client_name,
        date: row.created_at?.slice(0, 10),
        scores: ev,
        average: Math.round(avg * 10) / 10,
      };
    } catch { return null; }
  }).filter(Boolean);

  // 전체 평균
  const overallAvg = items.length > 0
    ? Math.round(items.reduce((sum: number, i: any) => sum + i.average, 0) / items.length * 10) / 10
    : 0;

  // 캘리브레이션 데이터 수
  const calibrationCount = (db.prepare('SELECT COUNT(*) as cnt FROM calibration_data').get() as any).cnt;
  const trainingCount = (db.prepare('SELECT COUNT(*) as cnt FROM training_cases').get() as any).cnt;

  res.json({ items, overallAvg, calibrationCount, trainingCount });
});

// ============ Health Check ============

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
