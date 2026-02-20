import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESOURCES_DIR = path.join(__dirname, '../resources');

const files = [
  '目录信息.xlsx',
  '知识点信息.xlsx',
  '题目信息.xlsx'
];

console.log('Excel Structure Analysis');
console.log('========================\n');

files.forEach(filename => {
  const filepath = path.join(RESOURCES_DIR, filename);

  try {
    const workbook = xlsx.readFile(filepath);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`File: ${filename}`);
    console.log(`${'='.repeat(60)}\n`);

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

      console.log(`Sheet: ${sheetName}`);
      console.log(`Rows: ${data.length}`);

      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`Columns (${columns.length}):`);
        columns.forEach(col => console.log(`  - ${col}`));

        console.log(`\nSample Row 1:`);
        console.log(JSON.stringify(data[0], null, 2));

        if (data.length > 1) {
          console.log(`\nSample Row 2:`);
          console.log(JSON.stringify(data[1], null, 2));
        }
      }
      console.log();
    });
  } catch (error) {
    console.error(`✗ Failed to read ${filename}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('Analysis complete.');
console.log('Use this information to design database schema.');
console.log('='.repeat(60));
