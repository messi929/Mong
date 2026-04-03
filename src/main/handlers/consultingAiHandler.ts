import { ipcMain } from 'electron';
import { api } from '../apiClient';

export function registerAiHandlers() {
  ipcMain.handle('ai:revise', async (_, data: any) => {
    return await api.post('/ai/revise', data);
  });

  ipcMain.handle('ai:evaluate', async (_, data: any) => {
    return await api.post('/ai/evaluate', data);
  });

  ipcMain.handle('ai:analyzePattern', async (_, data: any) => {
    return await api.post('/ai/analyzePattern', data);
  });

  // API key is now managed server-side
  ipcMain.handle('ai:setApiKey', () => {});
}
