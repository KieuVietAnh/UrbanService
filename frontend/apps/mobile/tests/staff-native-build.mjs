// Local emulator validation only. The isolated staffValidation variant uses the
// mock API, a debug signing key, a distinct application ID, and testOnly=true.
// It is NEVER a production/release-distribution artifact. Install with adb -t.
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { mkdirSync, createWriteStream, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mobile = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(mobile, '.expo/staff-native-validation');
mkdirSync(out, { recursive: true });
const dryRun = process.argv.includes('--dry-run');
const manifestOnly = process.argv.includes('--manifest-only');
const bundleOnly = process.argv.includes('--bundle-only');
const log = createWriteStream(path.join(out, dryRun ? 'build-dry-run.log' : manifestOnly ? 'build-manifest.log' : bundleOnly ? 'build-bundle.log' : 'build.log'));
const initScript = fileURLToPath(new URL('./staff-native-validation.init.gradle', import.meta.url));
const task = manifestOnly ? ':app:processStaffValidationMainManifest' : bundleOnly ? ':app:createBundleStaffValidationJsAndAssets' : ':app:assembleStaffValidation';

// Ninja on Windows still rejects source files whose textual path exceeds 260
// characters, even when the OS long-path policy is enabled. pnpm's virtual-store
// paths can cross that limit, so expose only the eight autolinked native package
// roots through stable, short directory junctions used by the validation build.
const workspaceRoot = path.resolve(mobile, '../..');
const nativeLinkRoot = path.join(workspaceRoot, '.cxx-staff-validation', 'pkgs');
mkdirSync(nativeLinkRoot, { recursive: true });
const nativePackages = {
  a: '@react-native-async-storage/async-storage',
  g: 'react-native-gesture-handler',
  k: 'react-native-keyboard-controller',
  r: 'react-native-reanimated',
  s: 'react-native-safe-area-context',
  n: 'react-native-screens',
  v: 'react-native-svg',
  w: 'react-native-worklets',
};
for (const [shortName, packageName] of Object.entries(nativePackages)) {
  const target = realpathSync(path.join(workspaceRoot, 'node_modules', packageName));
  const link = path.join(nativeLinkRoot, shortName);
  if (existsSync(link)) {
    if (realpathSync(link) !== target) throw new Error(`Native package junction has an unexpected target: ${link}`);
    continue;
  }
  const result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'mklink', '/J', link, target], {
    windowsHide: true,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`Cannot create native package junction ${link}: ${result.stderr || result.stdout}`);
}
// Serialize native tasks on Windows: concurrent CMake/Ninja regeneration in
// linked pnpm packages can race and leave build.ninja perpetually dirty.
const args = [task, '--init-script', initScript, '-PreactNativeArchitectures=x86_64', '--no-daemon', '--max-workers=1', '--no-parallel', '--console=plain'];
if (dryRun) args.push('--dry-run');
if (!process.argv.includes('--online')) args.push('--offline');
const child = spawn('cmd.exe', ['/d', '/c', 'gradlew.bat', ...args], {
  cwd: path.join(mobile, 'android'), windowsHide: true,
  env: {
    ...process.env,
    CMAKE_BUILD_PARALLEL_LEVEL: '1',
    STAFF_NATIVE_LINK_ROOT: nativeLinkRoot.replaceAll('\\', '/'),
    NODE_ENV: 'production',
    EXPO_NO_METRO_WORKSPACE_ROOT: '1',
    EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8100',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { process.stdout.write(data); log.write(data); });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; log.end(); });
child.on('close', (code) => { log.end(); process.exitCode = code ?? 1; });
