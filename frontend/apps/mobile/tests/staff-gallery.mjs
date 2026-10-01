import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export async function createStaffGallery(page, output) {
  const entries = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));
  const verification = JSON.parse(await readFile(new URL('verification.json', output), 'utf8'));
  const viewport = verification.viewport;
  const profile = verification.profile;
  const compatibility = profile && profile.name !== 'baseline';
  const geometryDescription = `Expo web ${viewport.width} × ${viewport.height}${profile?.textScale > 1 ? ' · cỡ chữ web × ' + profile.textScale : ''}`;
  const groupNames = [...new Set(entries.map((entry) => entry.group))];
  const card = (entry) => `<figure><a href="${escape(entry.file)}" target="_blank"><img src="${escape(entry.file)}" alt="${escape(entry.title)}" loading="eager"></a><figcaption>${escape(entry.title)}</figcaption></figure>`;
  const styles = `*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:#182b45;font-family:Arial,sans-serif}main{max-width:1360px;padding:42px 36px;margin:auto}header{margin-bottom:34px}small{color:#0b56d9;font-weight:700;letter-spacing:2px}h1{font-size:34px;line-height:1.18;margin:14px 0}p{color:#506077;line-height:1.7;max-width:1000px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}nav a{background:#fff;padding:10px 14px;border-radius:8px;color:#0b56d9;text-decoration:none;font-weight:600}h2{font-size:24px;margin:40px 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:24px;align-items:start}figure{margin:0;min-width:0}img{display:block;width:100%;border:6px solid #172339;border-radius:23px;background:#fff;box-shadow:0 10px 22px #1c315214}figcaption{font-size:14px;line-height:1.5;font-weight:600;padding:13px 4px;color:#33465f}.notice{background:#e2ebfa;padding:16px 20px;border-radius:10px}.contact .grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.contact main{padding:32px;max-width:none}.contact header{margin-bottom:22px}.contact h1{font-size:28px}.contact figcaption{font-size:13px}.contact p{margin:8px 0;font-size:14px}@media(max-width:700px){main{padding:24px 18px}h1{font-size:28px}.grid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}}`;
  const head = (title, contact = false) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${styles}</style></head><body class="${contact ? 'contact' : ''}"><main><header><small>URBANMIND / STAFF MOBILE</small><h1>${escape(title)}</h1><p>Ảnh chụp giao diện app đang chạy • ${escape(geometryDescription)} • Dữ liệu kiểm thử cô lập, không phải hồ sơ thật.</p>${compatibility ? '<p>Kiểm tra hình học trình duyệt, không phải bằng chứng native Android. Font và vùng hiển thị dự phòng thanh hệ thống là mô phỏng web.</p>' : ''}</header>`;
  const sections = groupNames.map((group, index) => `<section id="group-${index}"><h2>${escape(group)}</h2><div class="grid">${entries.filter((entry) => entry.group === group).map(card).join('')}</div></section>`).join('');
  await writeFile(new URL('index.html', output), head(compatibility ? 'Staff · ' + profile.label : 'Toàn bộ màn hình Staff') + `<p class="notice">${entries.length} ảnh ${compatibility ? 'chọn lọc từ lượt chạy đầy đủ chức năng để kiểm tra bố cục' : 'gồm các màn chính, phần cuộn của màn dài và trạng thái loading / rỗng / lỗi'}. Luồng mới: bắt đầu xử lý, SLA theo sự vụ, phân công đơn vị, liên hệ, tiến độ, tải minh chứng, gửi kết quả lần đầu và gửi lại sau NeedRework theo Incident. Mọi API đều dùng dữ liệu kiểm thử cô lập. Ảnh minh chứng dùng tệp mẫu, không phải hiện trường thật. Bấm vào ảnh để xem nguyên kích thước.</p><nav>${groupNames.map((group, index) => `<a href="#group-${index}">${escape(group)}</a>`).join('')}</nav>` + sections + '</main></body></html>');

  const groups = [
    { name: 'overview-main', title: 'Các màn hình chính · Incident là đầu việc', prefixes: ['01-home', '03-incidents', '05-incident-filters', '09-incident-overview', '10-incident-reports', '13-incident-timeline', '18-report-lookup', '11-report-primary'] },
    { name: 'overview-support', title: 'Trao đổi, thông báo và tài khoản', prefixes: ['19-conversations', '20-chat-public', '22-chat-internal', '23-notifications', '25-account', '26-account-edit', '14-incident-rework', '08-incidents-error'] },
    { name: 'overview-execution', title: 'Đơn vị xử lý, minh chứng và gửi kết quả', prefixes: ['29-provider-candidates-01', '30-provider-confirm-02', '34-provider-contacts-04', '35-provider-progress-02', '39-evidence-uploaded-02', '40-resolution-form-02', '41-resolution-confirm-02', '43-resolution-history-02'] },
    { name: 'overview-lifecycle', title: 'Bắt đầu xử lý, SLA sự vụ và gửi lại kết quả', prefixes: ['09-start-confirm-03', '09-start-conflict-03', '09-started-03', '10-incident-reports-03', '10-incident-reports-04', '47-resolution-rework-form-02', '47-resolution-rework-conflict-02', '47-resolution-rework-history-02'] },
  ];
  await page.setViewportSize({ width: 1280, height: 1500 });
  for (const group of groups) {
    const selected = group.prefixes.map((prefix) => entries.find((entry) => entry.file.startsWith(prefix)) || entries.findLast((entry) => entry.file.startsWith(prefix.replace(/-\d{2}$/, '')))).filter(Boolean);
    const html = new URL(group.name + '.html', output);
    await writeFile(html, head(group.title, true) + '<div class="grid">' + selected.map(card).join('') + '</div></main></body></html>');
    await page.goto(html.href);
    await page.evaluate(async () => { await Promise.all([...document.images].map((img) => img.decode())); await document.fonts.ready; });
    await page.screenshot({ path: fileURLToPath(new URL(group.name + '.png', output)), fullPage: true });
  }
}
