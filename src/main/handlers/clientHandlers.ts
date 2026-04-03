import { ipcMain } from 'electron';
import { api } from '../apiClient';

export function registerClientHandlers() {
  ipcMain.handle('client:getAll', () => api.get('/clients'));

  ipcMain.handle('client:get', (_, id: number) => api.get(`/clients/${id}`));

  ipcMain.handle('client:create', async (_, data: any) => {
    const result = await api.post('/clients', data);
    return result.id;
  });

  ipcMain.handle('client:update', (_, id: number, data: any) => api.put(`/clients/${id}`, data));

  ipcMain.handle('client:delete', (_, id: number) => api.delete(`/clients/${id}`));

  ipcMain.handle('client:search', (_, query: string) =>
    api.get(`/clients/search?q=${encodeURIComponent(query)}`)
  );
}
