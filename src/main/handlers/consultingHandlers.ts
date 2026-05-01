import { ipcMain } from 'electron';
import { api } from '../apiClient';

export function registerConsultingHandlers() {
  ipcMain.handle('consulting:getAll', (_, clientId?: number) => {
    const query = clientId ? `?clientId=${clientId}` : '';
    return api.get(`/consultings${query}`);
  });

  ipcMain.handle('consulting:get', (_, id: number) => api.get(`/consultings/${id}`));

  ipcMain.handle('consulting:create', async (_, data: any) => {
    const result = await api.post('/consultings', data);
    return result.id;
  });

  ipcMain.handle('consulting:update', (_, id: number, data: any) => api.put(`/consultings/${id}`, data));

  ipcMain.handle('consulting:delete', (_, id: number) => api.delete(`/consultings/${id}`));

  // Revisions
  ipcMain.handle('revision:getAll', (_, consultingId: number) =>
    api.get(`/revisions?consultingId=${consultingId}`)
  );

  ipcMain.handle('revision:create', async (_, data: any) => {
    const result = await api.post('/revisions', data);
    return result.id;
  });

  ipcMain.handle('revision:update', (_, id: number, data: any) => api.put(`/revisions/${id}`, data));

  // Dashboard
  ipcMain.handle('dashboard:stats', () => api.get('/dashboard/stats'));
  ipcMain.handle('dashboard:quality', () => api.get('/dashboard/quality'));
  ipcMain.handle('dashboard:metrics', () => api.get('/dashboard/metrics'));
}
