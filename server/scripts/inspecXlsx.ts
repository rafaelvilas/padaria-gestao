import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Lê a primeira planilha de cada categoria para inspecionar estrutura
const BASE_PATH =
  'C:\\Users\\rafae\\OneDrive - Udiaço Comércio e Indústria de Ferro e Aço Ltda\\UDC\\Clientes\\Galpão\\Sistema Galpão\\Notas Tecnicas';

const dirs = fs.readdirSync(BASE_PATH).filter(d => fs.statSync(path.join(BASE_PATH, d)).isDirectory());

for (const dir of dirs.slice(0, 3)) {
  const catPath = path.join(BASE_PATH, dir);
  const files = fs.readdirSync(catPath).filter(f => f.endsWith('.xlsx')).slice(0, 1);
  for (const file of files) {
    const filePath = path.join(catPath, file);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ARQUIVO: ${dir}/${file}`);
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z30');

    // Mostra células A1 até P35
    for (let row = 1; row <= Math.min(35, range.e.r + 1); row++) {
      const rowData: string[] = [];
      for (let col = 0; col <= Math.min(15, range.e.c); col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row - 1, c: col });
        const cell = ws[cellRef];
        const val = cell ? String(cell.v ?? '').substring(0, 20) : '';
        if (val) rowData.push(`${XLSX.utils.encode_col(col)}${row}="${val}"`);
      }
      if (rowData.length > 0) console.log(`  Row ${row}: ${rowData.join(' | ')}`);
    }
  }
}

process.exit(0);
