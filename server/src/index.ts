import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import { authMiddleware, registerAuthRoutes } from './auth';
import routes from './routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3100', 10);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize DB first (creates users table)
initDatabase();

// Auth middleware (JWT)
app.use('/api', authMiddleware);

// Auth routes (login, register)
registerAuthRoutes(routes);

// Routes
app.use('/api', routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Mong Consulting API running on port ${PORT}`);
  console.log(`[Server] Auth: JWT enabled`);
});
