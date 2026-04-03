/**
 * 학습 데이터(docs/01~14번 폴더)를 서버에 일괄 등록
 * 실행: npx tsx scripts/import-training.ts
 */
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

const SERVER_URL = process.env.MONG_SERVER_URL || 'http://77.42.78.9:3100';
const API_TOKEN = process.env.MONG_API_TOKEN || 'f447e6e9c405574593e56c67c83a2530da7b6361d22b3c371d7285323b6cc1a6';
const DOCS_DIR = path.join(__dirname, '../docs');

const STAGE_MAP: Record<string, string> = {
  '최초': 'draft', '초안': 'draft', '원본': 'draft',
  '첨삭중': 'first', '1차': 'first',
  '2차': 'second',
  '최종': 'final', '완성': 'final',
};
const STAGE_KEYWORDS = Object.keys(STAGE_MAP).sort((a, b) => b.length - a.length);
const JD_KEYWORDS = ['JD', 'jd', '공고', '채용공고', '모집요강'];

function parseFileName(fileName: string): { stage: string; isJD: boolean } | null {
  const name = path.parse(fileName).name;
  if (JD_KEYWORDS.some(kw => name.includes(kw))) return { stage: 'jd', isJD: true };
  for (const kw of STAGE_KEYWORDS) {
    if (name.includes(kw)) return { stage: STAGE_MAP[kw], isJD: false };
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
    case '.hwpx': {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries().filter(e => /Contents\/section\d*\.xml/i.test(e.entryName));
      const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
      const texts: string[] = [];
      const targets = entries.length > 0 ? entries : zip.getEntries().filter(e => e.entryName.endsWith('.xml'));
      for (const entry of targets) {
        const xml = entry.getData().toString('utf-8');
        collectTexts(parser.parse(xml), texts);
      }
      return texts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    case '.hwp': {
      const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7A3\u3131-\u3163\u0020-\u007E\n\r\t]/g, ' ');
      return text.replace(/\s+/g, ' ').trim();
    }
    case '.txt': return buffer.toString('utf-8');
    default: return '';
  }
}

function collectTexts(obj: any, texts: string[]): void {
  if (!obj) return;
  if (typeof obj === 'string') { const t = obj.trim(); if (t) texts.push(t); return; }
  if (Array.isArray(obj)) { obj.forEach(i => collectTexts(i, texts)); return; }
  if (typeof obj === 'object') {
    if ('t' in obj) {
      const t = obj.t;
      if (typeof t === 'string' && t.trim()) texts.push(t.trim());
      else if (Array.isArray(t)) t.forEach((v: any) => { if (typeof v === 'string' && v.trim()) texts.push(v.trim()); });
    }
    for (const key of Object.keys(obj)) { if (key !== 't') collectTexts(obj[key], texts); }
  }
}

async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${SERVER_URL}/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  // 01~14번 폴더 (00번은 합격자소서, 별도 처리)
  const folders = fs.readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{2}\./.test(d.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`${folders.length}개 학습 데이터 폴더 발견\n`);

  let totalCases = 0, totalRevisions = 0;

  for (const folder of folders) {
    const folderPath = path.join(DOCS_DIR, folder.name);
    const supportedExts = ['.docx', '.doc', '.pdf', '.txt', '.hwp', '.hwpx'];
    const files = fs.readdirSync(folderPath).filter(f => supportedExts.includes(path.extname(f).toLowerCase()));

    console.log(`\n[${folder.name}] ${files.length}개 파일`);

    // 그룹키 추출 (폴더명에서)
    const folderTitle = folder.name.replace(/^\d+\.\s*/, '');
    const parts = folderTitle.split(/[_\s]+/).filter(Boolean);
    const companyName = parts[0] || folderTitle;
    const position = parts.slice(1).join(' ') || '';

    const fileData: { stage: string; content: string }[] = [];
    let jdContent = '';

    for (const fileName of files) {
      const parsed = parseFileName(fileName);
      if (!parsed) { console.log(`  SKIP: ${fileName} (키워드 없음)`); continue; }

      try {
        const content = await extractText(path.join(folderPath, fileName));
        if (!content || content.trim().length < 30) { console.log(`  SKIP: ${fileName} (텍스트 부족)`); continue; }

        if (parsed.isJD) {
          jdContent = content;
          console.log(`  JD: ${fileName} [${content.length}자]`);
        } else {
          fileData.push({ stage: parsed.stage, content });
          console.log(`  ${parsed.stage}: ${fileName} [${content.length}자]`);
        }
      } catch (err: any) {
        console.log(`  ERR: ${fileName} — ${err.message}`);
      }
    }

    if (fileData.length === 0) { console.log(`  → 건너뜀 (유효한 파일 없음)`); continue; }

    // 서버에 등록
    const caseResult = await apiPost('/training/cases', {
      title: folderTitle,
      companyName,
      position,
      directionMemo: jdContent ? `[JD]\n${jdContent}` : '',
    });

    for (const f of fileData) {
      await apiPost('/training/revisions', {
        caseId: caseResult.id,
        stage: f.stage,
        content: f.content,
      });
      totalRevisions++;
    }

    totalCases++;
    console.log(`  → 등록 완료 (ID: ${caseResult.id}, ${fileData.length}개 단계${jdContent ? ' + JD' : ''})`);
  }

  console.log(`\n===== 완료 =====`);
  console.log(`${totalCases}개 사례, ${totalRevisions}개 리비전 등록`);
}

main().catch(console.error);
