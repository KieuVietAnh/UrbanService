import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import StreamZip from 'node-stream-zip';

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** Reproducible deliverable: package only successful-manifest files, not stale diagnostics. */
export async function createStaffArchive(output) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', output), 'utf8'));
  const verification = JSON.parse(await readFile(new URL('verification.json', output), 'utf8'));
  assert.equal(verification.passed, true);
  assert.equal(verification.screenshots, manifest.length);
  const names = [...new Set([
    'manifest.json', 'verification.json', 'index.html',
    ...manifest.map((entry) => entry.file),
    ...['overview-main', 'overview-support', 'overview-execution', 'overview-lifecycle'].flatMap((name) => [name + '.html', name + '.png']),
  ])];
  assert.ok(names.every((name) => /^[\w.-]+$/.test(name)), 'Archive entries must stay in the screenshot directory');
  const locals = [];
  const centrals = [];
  let offset = 0;
  const originalFiles = new Map();
  for (const name of names) {
    const data = await readFile(new URL(name, output));
    const compressed = deflateRawSync(data);
    const entryName = 'mobile-staff/' + name;
    const filename = Buffer.from(entryName);
    originalFiles.set(entryName, data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(((2026 - 1980) << 9) | (9 << 5) | 1, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(((2026 - 1980) << 9) | (9 << 5) | 1, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const archive = new URL('../mobile-staff.zip', output);
  await writeFile(archive, Buffer.concat([...locals, directory, end]));
  const reader = new StreamZip.async({ file: fileURLToPath(archive) });
  try {
    const entries = await reader.entries();
    assert.equal(Object.keys(entries).length, names.length);
    for (const [name, expected] of originalFiles) assert.deepEqual(await reader.entryData(name), expected, 'ZIP roundtrip must preserve ' + name);
  } finally { await reader.close(); }
  console.log('ZIP verified: ' + names.length + ' files (' + manifest.length + ' screen captures + galleries/metadata).');
}
