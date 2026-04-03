/**
 * 합격자소서를 파싱하여 서버 calibration_data 테이블에 등록
 * 실행: npx tsx scripts/import-calibration.ts
 */
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const SERVER_URL = process.env.MONG_SERVER_URL || 'http://77.42.78.9:3100';
const API_TOKEN = process.env.MONG_API_TOKEN || 'mong-team-secret-token-change-this';
const FOLDER = path.join(__dirname, '../docs/00. 합격자소서');

// 파일명에서 회사명, 직무, 산업군 추출
function parseFileName(fileName: string): { companyName: string; position: string; industry: string } {
  const name = path.parse(fileName).name;

  // 산업군 자동 분류
  const industryMap: [RegExp, string][] = [
    [/은행|금융|증권|카드|보험|농협|수협|하나|국민|우리|신한/, '금융'],
    [/IT|SW|개발|프론트|백엔드|플랫폼|데이터|오토에버/, 'IT'],
    [/공단|공사|공무원|행정|의료원/, '공공기관'],
    [/마케팅|PM|CS|영업/, '마케팅/영업'],
  ];

  let industry = '일반';
  for (const [regex, ind] of industryMap) {
    if (regex.test(name)) { industry = ind; break; }
  }

  // 회사명 추출 (날짜/반기 제거)
  const cleaned = name
    .replace(/^\d{2,4}\s*(상|하|하반기|상반기)?\s*/, '')
    .replace(/합격자소서.*$/, '')
    .replace(/[()]/g, '')
    .trim();

  // 회사명과 직무 분리
  const parts = cleaned.split(/[_\s]+/).filter(Boolean);
  const companyName = parts[0] || cleaned;
  const position = parts.slice(1).join(' ') || '';

  return { companyName, position, industry };
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
    case '.txt':
      return buffer.toString('utf-8');
    default:
      return '';
  }
}

async function main() {
  if (!fs.existsSync(FOLDER)) {
    console.error(`폴더를 찾을 수 없습니다: ${FOLDER}`);
    process.exit(1);
  }

  const supportedExts = ['.docx', '.doc', '.pdf', '.txt'];
  const files = fs.readdirSync(FOLDER)
    .filter(f => supportedExts.includes(path.extname(f).toLowerCase()))
    .sort();

  console.log(`${files.length}개 합격자소서 파일 발견\n`);

  const items: any[] = [];
  for (const fileName of files) {
    const filePath = path.join(FOLDER, fileName);
    const { companyName, position, industry } = parseFileName(fileName);

    try {
      const content = await extractText(filePath);
      if (content.trim().length < 50) {
        console.log(`  SKIP (텍스트 부족): ${fileName}`);
        continue;
      }

      items.push({ companyName, position, industry, content, source: 'accepted' });
      console.log(`  OK: ${fileName} → ${companyName} / ${position} (${industry}) [${content.length}자]`);
    } catch (err: any) {
      console.log(`  ERR: ${fileName} — ${err.message}`);
    }
  }

  console.log(`\n${items.length}개 파싱 완료. 서버에 등록 중...`);

  const res = await fetch(`${SERVER_URL}/api/calibration/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ items }),
  });

  const result = await res.json();
  console.log(`서버 등록 완료: ${result.imported}건`);
}

main().catch(console.error);
