/**
 * 합격자소서 hwpx/hwp 파일 추가 파싱 → 캘리브레이션 등록
 */
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

const SERVER_URL = process.env.MONG_SERVER_URL || 'http://77.42.78.9:3100';
const API_TOKEN = process.env.MONG_API_TOKEN || 'f447e6e9c405574593e56c67c83a2530da7b6361d22b3c371d7285323b6cc1a6';
const FOLDER = path.join(__dirname, '../docs/00. 합격자소서');

function parseHwpx(filePath: string): string {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().filter(e => /Contents\/section\d*\.xml/i.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName));
  const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
  const texts: string[] = [];
  const targets = entries.length > 0 ? entries : zip.getEntries().filter(e => e.entryName.endsWith('.xml'));
  for (const entry of targets) {
    const xml = entry.getData().toString('utf-8');
    collectTexts(parser.parse(xml), texts);
  }
  return texts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseHwp(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\uAC00-\uD7A3\u3131-\u3163\u0020-\u007E\n\r\t]/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
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

function parseFileName(fileName: string): { companyName: string; position: string; industry: string } {
  const name = path.parse(fileName).name;
  const industryMap: [RegExp, string][] = [
    [/은행|금융|증권|카드|보험|농협|수협|하나|국민|우리|신한|경남/, '금융'],
    [/IT|SW|개발|프론트|백엔드|플랫폼|데이터|오토에버/, 'IT'],
    [/공단|공사|행정/, '공공기관'],
    [/마케팅|PM|CS|영업/, '마케팅/영업'],
  ];
  let industry = '일반';
  for (const [regex, ind] of industryMap) { if (regex.test(name)) { industry = ind; break; } }
  const cleaned = name.replace(/^\d{2,4}\s*(상|하|하반기|상반기)?\s*/, '').replace(/합격자소서.*$/, '').replace(/[()]/g, '').trim();
  const parts = cleaned.split(/[_\s]+/).filter(Boolean);
  return { companyName: parts[0] || cleaned, position: parts.slice(1).join(' ') || '', industry };
}

async function main() {
  const hwpFiles = fs.readdirSync(FOLDER).filter(f => /\.(hwpx?|hwp)$/i.test(f));
  console.log(`${hwpFiles.length}개 hwp/hwpx 파일\n`);

  const items: any[] = [];
  for (const fileName of hwpFiles) {
    const filePath = path.join(FOLDER, fileName);
    const ext = path.extname(fileName).toLowerCase();
    const { companyName, position, industry } = parseFileName(fileName);

    try {
      const content = ext === '.hwpx' ? parseHwpx(filePath) : parseHwp(filePath);
      if (content.length < 50) { console.log(`  SKIP: ${fileName} (텍스트 부족: ${content.length}자)`); continue; }
      items.push({ companyName, position, industry, content, source: 'accepted' });
      console.log(`  OK: ${fileName} → ${companyName} / ${position} (${industry}) [${content.length}자]`);
    } catch (err: any) {
      console.log(`  ERR: ${fileName} — ${err.message}`);
    }
  }

  console.log(`\n${items.length}개 파싱. 서버 등록...`);
  const res = await fetch(`${SERVER_URL}/api/calibration/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify({ items }),
  });
  const result = await res.json();
  console.log(`등록 완료: ${result.imported}건`);
}

main().catch(console.error);
