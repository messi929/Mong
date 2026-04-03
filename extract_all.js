const mammoth = require('mammoth');
const nhwp = require('node-hwp');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function extractHwpx(filePath) {
  try {
    const list = execSync(`unzip -l "${filePath}" 2>&1`).toString();
    const sections = [...list.matchAll(/Contents\/section\d+\.xml/g)].map(m => m[0]).sort();
    let allText = '';
    for (const sec of sections) {
      const xml = execSync(`unzip -p "${filePath}" "${sec}"`).toString();
      const texts = [...xml.matchAll(/<hp:t>(.*?)<\/hp:t>/g)].map(m => m[1]);
      allText += texts.join('');
    }
    return allText.trim();
  } catch(e) { return `ERROR: ${e.message}`; }
}

function extractHwp(filePath) {
  return new Promise((resolve, reject) => {
    nhwp.open(filePath, function(err, doc) {
      if (err) { resolve(`ERROR: ${err.message}`); return; }
      function findText(node) {
        let texts = [];
        if (!node) return texts;
        if (node.value && typeof node.value === 'string') texts.push(node.value);
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) texts = texts.concat(findText(child));
        }
        return texts;
      }
      const body = doc._hml.children.find(c => c.name === 'BODY');
      resolve(body ? findText(body).join('\n') : 'NO BODY');
    });
  });
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({path: filePath});
  return result.value;
}

async function main() {
  const docsDir = 'C:/src/Mong/docs';
  const folders = fs.readdirSync(docsDir).filter(f => {
    const full = path.join(docsDir, f);
    return fs.statSync(full).isDirectory() && !f.startsWith('00');
  }).sort();

  for (const folder of folders) {
    const folderPath = path.join(docsDir, folder);
    const files = fs.readdirSync(folderPath).sort();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📁 ${folder}`);
    console.log('='.repeat(80));
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const ext = path.extname(file).toLowerCase();
      let text = '';
      
      try {
        if (ext === '.docx') text = await extractDocx(filePath);
        else if (ext === '.hwpx') text = extractHwpx(filePath);
        else if (ext === '.hwp') text = await extractHwp(filePath);
        else { text = `UNSUPPORTED: ${ext}`; }
      } catch(e) { text = `ERROR: ${e.message}`; }
      
      console.log(`\n--- ${file} ---`);
      console.log(text);
    }
  }
}

main().catch(console.error);
