import dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

import { setServerUrl, setApiToken, getServerUrl } from './apiClient';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerClientHandlers } from './handlers/clientHandlers';
import { registerConsultingHandlers } from './handlers/consultingHandlers';
import { registerAiHandlers } from './handlers/consultingAiHandler';
import { registerTrainingHandlers } from './handlers/trainingHandlers';
import { registerImportHandlers } from './handlers/importHandlers';

if (process.env.MONG_SERVER_URL) setServerUrl(process.env.MONG_SERVER_URL);

ipcMain.handle('app:getVersion', () => app.getVersion());

// Auth handlers (토큰 없이 호출 가능)
ipcMain.handle('auth:login', async (_, data: { username: string; password: string }) => {
  const url = `${getServerUrl()}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (res.ok && result.token) {
    setApiToken(result.token);
  }
  if (!res.ok) throw new Error(result.error || '로그인 실패');
  return result;
});

ipcMain.handle('auth:register', async (_, data: any) => {
  const url = `${getServerUrl()}/api/auth/register`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || '등록 실패');
  if (result.token) setApiToken(result.token);
  return result;
});

ipcMain.handle('auth:users', async () => {
  const { api } = require('./apiClient');
  return api.get('/auth/users');
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Mong Consulting',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  registerFileHandlers();
  registerClientHandlers();
  registerConsultingHandlers();
  registerAiHandlers();
  registerTrainingHandlers();
  registerImportHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== 자동 업데이트 =====
if (app.isPackaged) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 발견',
      message: `새 버전 ${info.version}이 있습니다. 다운로드를 시작합니다.`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 준비 완료',
      message: '업데이트가 다운로드되었습니다. 앱을 재시작하면 적용됩니다.',
      buttons: ['지금 재시작', '나중에'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', () => {
    // 업데이트 실패는 무시 (오프라인 등)
  });

  app.whenReady().then(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  });
}
