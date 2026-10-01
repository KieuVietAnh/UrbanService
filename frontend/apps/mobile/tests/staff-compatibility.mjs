import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { STAFF_SMOKE_PROFILES } from './staff-smoke-profiles.mjs';

// All business interactions remain inside staff-smoke's intercepted fixtures.
// Runs serially to avoid competing browser/Metro load during Android builds.
const galleryOnly = process.argv.includes('--gallery-only');
const requested = process.argv.slice(2).filter((argument) => argument !== '--gallery-only');
const names = galleryOnly ? [] : requested.length ? requested : Object.keys(STAFF_SMOKE_PROFILES).filter((name) => name !== 'baseline');
assert.ok(names.every((name) => STAFF_SMOKE_PROFILES[name] && name !== 'baseline'), 'Use known compatibility profile names; the primary baseline has its own all-screen gallery.');
const output = new URL('../../../docs/screenshots/mobile-staff-compatibility/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of names) {
  console.log('\nSTART Staff browser geometry profile: ' + name + ' (synthetic, not native Android)');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./staff-smoke.mjs', import.meta.url))], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)), windowsHide: true, stdio: 'inherit',
      env: { ...process.env, MOBILE_SMOKE_PROFILE: name, MOBILE_SMOKE_OUTPUT: '', MOBILE_SMOKE_WIDTH: '', MOBILE_SMOKE_HEIGHT: '', MOBILE_SMOKE_TEXT_SCALE: '', MOBILE_SMOKE_NO_SCREENSHOTS: '' },
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Staff compatibility profile failed: ' + name + ' (exit ' + code + ')')));
  });
}

const completed = [];
for (const name of Object.keys(STAFF_SMOKE_PROFILES).filter((item) => item !== 'baseline')) {
  try {
    const report = JSON.parse(await readFile(new URL(name + '/verification.json', output), 'utf8'));
    const manifest = JSON.parse(await readFile(new URL(name + '/manifest.json', output), 'utf8'));
    if (report.passed) completed.push({ name, ...report, manifest });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const geometryProblems = (checks = []) => checks.filter((check) => check.documentWidth > check.viewportWidth + 1 || check.clippedControls?.length || check.verticallyClippedControls?.length || check.clippedTabText?.length).length;
const geometryCapabilities = (checks = []) => ({ horizontalDocumentAndControls: true, verticallyReachableControls: checks.length > 0 && checks.every((check) => 'verticallyClippedControls' in check), fixedTabTextLines: checks.length > 0 && checks.every((check) => 'clippedTabText' in check) });
await writeFile(new URL('matrix.json', output), JSON.stringify({ schemaVersion: 2, evidence: 'Isolated fixture-backed Expo web stress tests. Not native Android hardware, keyboard, fontScale or system-bar proof.', profiles: completed.map(({ manifest, geometryChecks, ...item }) => ({ ...item, geometryChecks: geometryChecks?.length, geometryProblems: geometryProblems(geometryChecks), geometryCapabilities: geometryCapabilities(geometryChecks) })) }, null, 2) + '\n');
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const prefixList = ['01-home', '05-incident-filters', '20-chat-public', '40-resolution-form'];
await writeFile(new URL('index.html', output), `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Staff · Kiểm tra bố cục đa kích thước</title><style>*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:#182b45;font:16px/1.6 Arial,sans-serif}main{max-width:1440px;margin:auto;padding:32px}h1{line-height:1.2}p{max-width:960px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;align-items:start}figure{margin:0}img{width:100%;border:4px solid #172339;border-radius:16px}a{color:#0b56d9}section{border-top:1px solid #cdd8e7;margin-top:36px;padding-top:20px}figcaption{font-size:14px}small{color:#506077}</style><main><h1>Staff · Kiểm tra bố cục đa kích thước</h1><p>Các lượt kiểm thử đầy đủ chức năng đều dùng API fixture cô lập. Đây là Expo web: cỡ chữ được tăng bằng CSS; thanh hệ thống chỉ được mô phỏng bằng cách giảm chiều cao vùng hiển thị. Không thay đổi Android fontScale, không chứng minh bàn phím, cutout hay thanh điều hướng native. App cấu hình portrait; landscape là stress test bổ sung.</p><p><a href="../mobile-staff/index.html">Toàn bộ ảnh Staff ở kích thước chuẩn</a> · <a href="matrix.json">Kết quả kiểm thử</a></p>${completed.map((item) => { const capabilities = geometryCapabilities(item.geometryChecks); return `<section><h2><a href="${escape(item.name)}/index.html">${escape(item.profile.label)}</a></h2><p>${item.viewport.width} × ${item.viewport.height}; text × ${item.profile.textScale}; ${item.requests} API requests; ${item.geometryChecks.length} lần kiểm tra hình học; ${item.screenshots} ảnh chọn lọc. PASS, ${geometryProblems(item.geometryChecks)} lỗi hình học, không lỗi runtime/API ngoài fixture. Kiểm tra dọc controls/tab text: ${capabilities.verticallyReachableControls && capabilities.fixedTabTextLines ? 'có' : 'chưa có trong lượt chạy này'}.</p><div class="grid">${prefixList.map((prefix) => item.manifest.find((entry) => entry.file.startsWith(prefix))).filter(Boolean).map((entry) => `<figure><a href="${escape(item.name + '/' + entry.file)}"><img src="${escape(item.name + '/' + entry.file)}" alt="${escape(entry.title)}"></a><figcaption>${escape(entry.title)}</figcaption></figure>`).join('')}</div></section>`; }).join('')}</main></html>`);
console.log('Staff compatibility matrix: ' + completed.length + ' completed profiles; gallery ' + fileURLToPath(new URL('index.html', output)));
