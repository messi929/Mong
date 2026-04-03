import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './database';

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_TOKEN || 'mong-jwt-secret';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 로그인/회원가입은 인증 불필요
  if (req.path === '/auth/login' || req.path === '/auth/register' || req.path === '/health') {
    return next();
  }

  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

export function registerAuthRoutes(router: any) {
  // 로그인
  router.post('/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
    });
  });

  // 회원가입 (누구나 가능)
  router.post('/auth/register', (req: Request, res: Response) => {
    const { username, password, displayName } = req.body;

    if (!username || !password || !displayName) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
    }

    const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
    }

    const userCount = (getDb().prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
    const hash = bcrypt.hashSync(password, 10);
    const role = userCount === 0 ? 'admin' : 'consultant';
    const result = getDb().prepare(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, displayName, role);

    // 가입 후 자동 로그인
    const token = jwt.sign(
      { id: result.lastInsertRowid, username, displayName, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: result.lastInsertRowid, username, displayName, role },
    });
  });

  // 현재 사용자 정보
  router.get('/auth/me', (req: Request, res: Response) => {
    res.json(req.user);
  });

  // 사용자 목록 (admin)
  router.get('/auth/users', (req: Request, res: Response) => {
    const rows = getDb().prepare('SELECT id, username, display_name, role, created_at FROM users').all();
    res.json(rows.map((r: any) => ({
      id: r.id, username: r.username, displayName: r.display_name, role: r.role, createdAt: r.created_at,
    })));
  });
}
