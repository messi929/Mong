import dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

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

// 로그 파일 경로 + 로그 폴더 열기
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info(`[boot] Mong Consulting v${app.getVersion()} | packaged=${app.isPackaged}`);

ipcMain.handle('app:getLogPath', () => log.transports.file.getFile().path);
ipcMain.handle('app:openLogFolder', () => {
  const logPath = log.transports.file.getFile().path;
  return shell.showItemInFolder(logPath);
});

// 수동 업데이트 확인
ipcMain.handle('app:checkForUpdates', async () => {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev', message: '개발 모드에서는 자동 업데이트가 비활성됩니다.' };
  }
  try {
    log.info('[updater] manual check requested');
    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version ?? null,
      isUpdateAvailable: result?.updateInfo?.version !== app.getVersion(),
    };
  } catch (err: any) {
    log.error('[updater] manual check failed:', err);
    return { ok: false, reason: 'error', message: err?.message || String(err) };
  }
});

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
  autoUpdater.logger = log;

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] update-available: ${info.version}`);
    dialog.showMessageBox({
      type: 'info',
      title: '업데이트 발견',
      message: `새 버전 ${info.version}이 있습니다. 다운로드를 시작합니다.`,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[updater] update-not-available: latest=${info.version}, current=${app.getVersion()}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[updater] download-progress: ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total} bytes)`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] update-downloaded: ${info.version}`);
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

  autoUpdater.on('error', (err) => {
    log.error('[updater] error:', err);
    const logPath = log.transports.file.getFile().path;
    dialog.showMessageBox({
      type: 'error',
      title: '업데이트 오류',
      message: '자동 업데이트 처리 중 오류가 발생했습니다.',
      detail: `${err?.message || String(err)}\n\n로그 파일:\n${logPath}`,
      buttons: ['확인'],
    });
  });

  app.whenReady().then(() => {
    log.info('[updater] startup check');
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[updater] startup check failed:', err);
    });
  });
}
