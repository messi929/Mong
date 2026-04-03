import { ipcMain } from 'electron';
import { api } from '../apiClient';

export function registerTrainingHandlers() {
  ipcMain.handle('training:getCases', (_, clientId?: number) => {
    const query = clientId ? `?clientId=${clientId}` : '';
    return api.get(`/training/cases${query}`);
  });

  ipcMain.handle('training:getCase', (_, id: number) => api.get(`/training/cases/${id}`));

  ipcMain.handle('training:createCase', async (_, data: any) => {
    const result = await api.post('/training/cases', data);
    return result.id;
  });

  ipcMain.handle('training:deleteCase', (_, id: number) => api.delete(`/training/cases/${id}`));

  ipcMain.handle('training:getRevisions', (_, caseId: number) =>
    api.get(`/training/revisions?caseId=${caseId}`)
  );

  ipcMain.handle('training:saveRevision', async (_, data: any) => {
    const result = await api.post('/training/revisions', data);
    return result.id;
  });

  ipcMain.handle('training:deleteRevision', (_, id: number) =>
    api.delete(`/training/revisions/${id}`)
  );

  ipcMain.handle('training:getForPrompt', (_, clientId?: number) => {
    const query = clientId ? `?clientId=${clientId}` : '';
    return api.get(`/training/prompt${query}`);
  });
}
