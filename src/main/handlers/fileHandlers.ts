import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export function registerFileHandlers() {
  // Word 내보내기
  ipcMain.handle('file:exportWord', async (_, data: { content: string; fileName: string }) => {
    const { Document, Packer, Paragraph, TextRun } = require('docx');
    const result = await dialog.showSaveDialog({
      defaultPath: data.fileName.replace(/\.[^.]+$/, '') + '_첨삭.docx',
      filters: [{ name: 'Word', extensions: ['docx'] }],
    });
    if (result.canceled || !result.filePath) return null;

    const paragraphs = data.content.split('\n').map((line: string) =>
      new Paragraph({ children: [new TextRun({ text: line, size: 22, font: 'Malgun Gothic' })] })
    );
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  });

  // 텍스트 내보내기
  ipcMain.handle('file:exportText', async (_, data: { content: string; fileName: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: data.fileName.replace(/\.[^.]+$/, '') + '_첨삭.txt',
      filters: [{ name: '텍스트', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, data.content, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '문서 파일', extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'hwp', 'hwpx', 'txt'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx', 'doc'] },
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
        { name: 'HWP/HWPX', extensions: ['hwp', 'hwpx'] },
        { name: '텍스트', extensions: ['txt'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('file:parse', async (_, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    try {
      switch (ext) {
        case '.txt': return fs.readFileSync(filePath, 'utf-8');
        case '.pdf': return await parsePdf(filePath);
        case '.docx':
        case '.doc': return await parseWord(filePath);
        case '.xlsx':
        case '.xls': return parseExcel(filePath);
        case '.hwpx': return parseHwpx(filePath);
        case '.hwp': return parseHwp(filePath);
        default: return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (error: any) {
      throw new Error(`파일 파싱 실패: ${error.message}`);
    }
  });
}

async function parsePdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseWord(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseExcel(filePath: string): string {
  const workbook = XLSX.readFile(filePath);
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const text = XLSX.utils.sheet_to_csv(sheet);
    if (text.trim()) {
      lines.push(`[${sheetName}]`);
      lines.push(text);
      lines.push('');
    }
  }
  return lines.join('\n');
}

function parseHwpx(filePath: string): string {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  // section XML 파일들에서 텍스트 추출
  const sectionFiles = entries
    .filter(e => /Contents\/section\d*\.xml/i.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  if (sectionFiles.length === 0) {
    // fallback: 모든 XML에서 텍스트 시도
    const allXml = entries.filter(e => e.entryName.endsWith('.xml'));
    if (allXml.length === 0) return '[HWPX] 텍스트를 추출할 수 없습니다.';
    return extractTextFromHwpxEntries(allXml);
  }

  return extractTextFromHwpxEntries(sectionFiles);
}

function extractTextFromHwpxEntries(entries: AdmZip.IZipEntry[]): string {
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
  });

  const texts: string[] = [];

  for (const entry of entries) {
    const xml = entry.getData().toString('utf-8');
    const parsed = parser.parse(xml);
    collectTexts(parsed, texts);
  }

  return texts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function collectTexts(obj: any, texts: string[]): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed) texts.push(trimmed);
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) collectTexts(item, texts);
    return;
  }

  if (typeof obj === 'object') {
    // <t> 태그 (텍스트 노드) 우선
    if ('t' in obj) {
      const t = obj.t;
      if (typeof t === 'string' && t.trim()) texts.push(t.trim());
      else if (Array.isArray(t)) t.forEach((v: any) => { if (typeof v === 'string' && v.trim()) texts.push(v.trim()); });
    }
    // 하위 노드 재귀
    for (const key of Object.keys(obj)) {
      if (key === 't') continue;
      collectTexts(obj[key], texts);
    }
  }
}

function parseHwp(filePath: string): string {
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7A3\u3131-\u3163\u0020-\u007E\n\r\t]/g, ' ');
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 50) return cleaned;
    return '[HWP 파일] 텍스트 추출이 제한적입니다. HWPX 또는 Word(.docx)로 변환 후 업로드해주세요.';
  } catch {
    return '[HWP 파일] 파싱에 실패했습니다. HWPX 또는 Word(.docx)로 변환 후 업로드해주세요.';
  }
}
