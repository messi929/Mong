import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // 앱
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  getLogPath: () => ipcRenderer.invoke('app:getLogPath'),
  openLogFolder: () => ipcRenderer.invoke('app:openLogFolder'),

  // 인증
  login: (data: any) => ipcRenderer.invoke('auth:login', data),
  register: (data: any) => ipcRenderer.invoke('auth:register', data),
  getUsers: () => ipcRenderer.invoke('auth:users'),

  // 파일 처리
  openFile: () => ipcRenderer.invoke('file:open'),
  parseFile: (filePath: string) => ipcRenderer.invoke('file:parse', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  exportWord: (data: any) => ipcRenderer.invoke('file:exportWord', data),
  exportText: (data: any) => ipcRenderer.invoke('file:exportText', data),

  // 고객 관리
  getClients: () => ipcRenderer.invoke('client:getAll'),
  getClient: (id: number) => ipcRenderer.invoke('client:get', id),
  createClient: (data: any) => ipcRenderer.invoke('client:create', data),
  updateClient: (id: number, data: any) => ipcRenderer.invoke('client:update', id, data),
  deleteClient: (id: number) => ipcRenderer.invoke('client:delete', id),
  searchClients: (query: string) => ipcRenderer.invoke('client:search', query),

  // 첨삭 컨설팅
  getConsultings: (clientId?: number) => ipcRenderer.invoke('consulting:getAll', clientId),
  getConsulting: (id: number) => ipcRenderer.invoke('consulting:get', id),
  createConsulting: (data: any) => ipcRenderer.invoke('consulting:create', data),
  updateConsulting: (id: number, data: any) => ipcRenderer.invoke('consulting:update', id, data),
  deleteConsulting: (id: number) => ipcRenderer.invoke('consulting:delete', id),

  // 첨삭 버전
  getRevisions: (consultingId: number) => ipcRenderer.invoke('revision:getAll', consultingId),
  createRevision: (data: any) => ipcRenderer.invoke('revision:create', data),
  updateRevision: (id: number, data: any) => ipcRenderer.invoke('revision:update', id, data),

  // AI 첨삭
  requestRevision: (data: any) => ipcRenderer.invoke('ai:revise', data),
  requestEvaluation: (data: any) => ipcRenderer.invoke('ai:evaluate', data),
  analyzePattern: (data: any) => ipcRenderer.invoke('ai:analyzePattern', data),
  setApiKey: (key: string) => ipcRenderer.invoke('ai:setApiKey', key),

  // 학습 데이터
  getTrainingCases: (clientId?: number) => ipcRenderer.invoke('training:getCases', clientId),
  getTrainingCase: (id: number) => ipcRenderer.invoke('training:getCase', id),
  createTrainingCase: (data: any) => ipcRenderer.invoke('training:createCase', data),
  deleteTrainingCase: (id: number) => ipcRenderer.invoke('training:deleteCase', id),
  getTrainingRevisions: (caseId: number) => ipcRenderer.invoke('training:getRevisions', caseId),
  saveTrainingRevision: (data: any) => ipcRenderer.invoke('training:saveRevision', data),
  deleteTrainingRevision: (id: number) => ipcRenderer.invoke('training:deleteRevision', id),
  getTrainingForPrompt: (clientId?: number) => ipcRenderer.invoke('training:getForPrompt', clientId),

  // 일괄 import
  importSelectFolder: () => ipcRenderer.invoke('import:selectFolder'),
  importScanFolder: (folderPath: string) => ipcRenderer.invoke('import:scanFolder', folderPath),
  importExecute: (folderPath: string, clientId?: number) => ipcRenderer.invoke('import:execute', folderPath, clientId),

  // 대시보드
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),
  getQualityStats: () => ipcRenderer.invoke('dashboard:quality'),
  getDashboardMetrics: () => ipcRenderer.invoke('dashboard:metrics'),
});
