import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import { api } from '../apiClient';

// Stage mapping: filename keywords → DB stage
const STAGE_MAP: Record<string, string> = {
  '최초': 'draft', '초안': 'draft', '원본': 'draft',
  '첨삭중': 'first', '1차': 'first',
  '2차': 'second',
  '최종': 'final', '완성': 'final',
};
const STAGE_KEYWORDS = Object.keys(STAGE_MAP).sort((a, b) => b.length - a.length);

// JD 감지 키워드
const JD_KEYWORDS = ['JD', 'jd', '공고', '채용공고', '모집요강'];

interface ParsedFile {
  filePath: string;
  fileName: string;
  groupKey: string;
  stage: string;
  stageLabel: string;
  isJD: boolean;
}

function parseFileName(fileName: string): { groupKey: string; stage: string; stageLabel: string; isJD: boolean } | null {
  const nameWithoutExt = path.parse(fileName).name;

  // JD 파일 감지
  const isJD = JD_KEYWORDS.some(kw => nameWithoutExt.includes(kw));
  if (isJD) {
    const groupKey = nameWithoutExt.replace(/[_\s]*(JD|jd|공고|채용공고|모집요강)[_\s]*/g, '').trim();
    return { groupKey, stage: 'jd', stageLabel: 'JD', isJD: true };
  }

  // 일반 단계 파일
  for (const keyword of STAGE_KEYWORDS) {
    if (nameWithoutExt.includes(keyword)) {
      const stage = STAGE_MAP[keyword];
      const groupKey = nameWithoutExt.replace(keyword, '').trim();
      return { groupKey, stage, stageLabel: keyword, isJD: false };
    }
  }

  return null;
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  switch (ext) {
    case '.docx':
    case '.doc': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case '.pdf': {
      const data = await pdfParse(buffer);
      return data.text;
    }
    case '.hwpx': return parseHwpxBuffer(filePath);
    case '.hwp': {
      const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7A3\u3131-\u3163\u0020-\u007E\n\r\t]/g, ' ');
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.length > 50 ? cleaned : '';
    }
    case '.txt': return buffer.toString('utf-8');
    default: return buffer.toString('utf-8');
  }
}

function parseHwpxBuffer(filePath: string): string {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries()
    .filter(e => /Contents\/section\d*\.xml/i.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
  const texts: string[] = [];

  const targets = entries.length > 0 ? entries : zip.getEntries().filter(e => e.entryName.endsWith('.xml'));

  for (const entry of targets) {
    const xml = entry.getData().toString('utf-8');
    const parsed = parser.parse(xml);
    collectTexts(parsed, texts);
  }

  return texts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function collectTexts(obj: any, texts: string[]): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') { const t = obj.trim(); if (t) texts.push(t); return; }
  if (Array.isArray(obj)) { for (const item of obj) collectTexts(item, texts); return; }
  if (typeof obj === 'object') {
    if ('t' in obj) {
      const t = obj.t;
      if (typeof t === 'string' && t.trim()) texts.push(t.trim());
      else if (Array.isArray(t)) t.forEach((v: any) => { if (typeof v === 'string' && v.trim()) texts.push(v.trim()); });
    }
    for (const key of Object.keys(obj)) { if (key !== 't') collectTexts(obj[key], texts); }
  }
}

export function registerImportHandlers() {
  ipcMain.handle('import:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '학습 데이터 폴더 선택' });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('import:scanFolder', async (_, folderPath: string) => {
    const supportedExts = ['.docx', '.doc', '.pdf', '.txt', '.hwp', '.hwpx'];
    const allFiles = scanRecursive(folderPath, supportedExts);

    const parsed: ParsedFile[] = [];
    const errors: string[] = [];

    for (const { filePath, fileName } of allFiles) {
      const result = parseFileName(fileName);
      if (result) {
        parsed.push({ filePath, fileName, groupKey: result.groupKey, stage: result.stage, stageLabel: result.stageLabel, isJD: result.isJD });
      } else {
        errors.push(`"${fileName}" — 단계/JD 키워드를 찾을 수 없습니다`);
      }
    }

    const groups: Record<string, ParsedFile[]> = {};
    for (const f of parsed) {
      if (!groups[f.groupKey]) groups[f.groupKey] = [];
      groups[f.groupKey].push(f);
    }

    const stageLabels: Record<string, string> = { draft: '초안', first: '1차 첨삭', second: '2차 첨삭', final: '최종', jd: 'JD' };

    return {
      groups: Object.values(groups).map(gFiles => ({
        title: gFiles[0].groupKey,
        files: gFiles.map(f => ({ fileName: f.fileName, stage: f.stage, stageLabel: stageLabels[f.stage] || f.stage })),
      })),
      errors,
      totalFiles: parsed.length,
    };
  });

  ipcMain.handle('import:execute', async (_, folderPath: string, clientId?: number) => {
    const supportedExts = ['.docx', '.doc', '.pdf', '.txt', '.hwp', '.hwpx'];
    const allFiles = scanRecursive(folderPath, supportedExts);

    const parsed: ParsedFile[] = [];
    const errors: string[] = [];

    for (const { filePath, fileName } of allFiles) {
      const result = parseFileName(fileName);
      if (result) {
        parsed.push({ filePath, fileName, groupKey: result.groupKey, stage: result.stage, stageLabel: result.stageLabel, isJD: result.isJD });
      } else {
        errors.push(`"${fileName}" 건너뜀 — 키워드 없음`);
      }
    }

    const groupMap: Record<string, ParsedFile[]> = {};
    for (const f of parsed) {
      if (!groupMap[f.groupKey]) groupMap[f.groupKey] = [];
      groupMap[f.groupKey].push(f);
    }

    const groups: any[] = [];
    for (const [groupKey, groupFiles] of Object.entries(groupMap)) {
      const parts = groupKey.split(/\s+/);
      const companyName = parts[0] || groupKey;
      const position = parts.slice(1).join(' ') || '';

      const filesWithContent: any[] = [];
      let jdContent = '';

      for (const file of groupFiles) {
        try {
          const content = await extractText(file.filePath);
          if (!content.trim()) continue;

          if (file.isJD) {
            jdContent = content;
          } else {
            filesWithContent.push({ stage: file.stage, content });
          }
        } catch (err: any) {
          errors.push(`"${file.fileName}" 텍스트 추출 실패: ${err.message}`);
        }
      }

      if (filesWithContent.length > 0) {
        groups.push({
          title: groupKey,
          companyName,
          position,
          directionMemo: jdContent ? `[JD]\n${jdContent}` : '',
          files: filesWithContent,
        });
      }
    }

    // 서버에 전송 (directionMemo 포함)
    const result = await api.post('/import/execute', { groups, clientId });

    return {
      totalFiles: parsed.length,
      totalCases: result.totalCases,
      totalRevisions: result.totalRevisions,
      cases: result.cases,
      errors,
    };
  });
}

// 하위 폴더까지 재귀 스캔
function scanRecursive(dir: string, exts: string[]): { filePath: string; fileName: string }[] {
  const results: { filePath: string; fileName: string }[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanRecursive(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
      results.push({ filePath: fullPath, fileName: entry.name });
    }
  }

  return results;
}
