import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('reports').filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const b = await chromium.launch();
for (const f of files) {
  const page = await b.newPage();
  await page.goto(`file://${process.cwd()}/reports/${f}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200); // 等字型
  await page.evaluate(() => {
    document.querySelectorAll('.read,.ev,.cal').forEach(e => e.classList.add('in'));
    const sky = document.getElementById('sky'); if (sky) sky.remove(); // 星空動畫不進PDF
  });
  await page.pdf({
    path: `reports/${f}.pdf`,
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
  });
  await page.close();
  console.log(f + '.pdf done');
}
await b.close();
