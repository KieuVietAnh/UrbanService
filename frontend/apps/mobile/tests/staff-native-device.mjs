// Commands are restricted to the disposable, read-only emulator created for
// this task. Never target an attached phone or the production application.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serial = 'emulator-5560';
const adb = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const app = 'com.giaunh.urbanmind.staffvalidation';
const out = fileURLToPath(new URL('../../../docs/screenshots/mobile-staff-native/', import.meta.url));
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
if (run('shell', 'getprop', 'ro.kernel.qemu').toString().trim() !== '1') throw new Error('Refusing to operate outside the disposable emulator.');
const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'capture': {
    const name = args[0];
    if (!/^[a-z0-9-]+$/.test(name || '')) throw new Error('Use an explicit screenshot name.');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, name + '.png'), run('exec-out', 'screencap', '-p'));
    run('shell', 'uiautomator', 'dump', '/sdcard/staff-validation-window.xml');
    const xml = run('exec-out', 'cat', '/sdcard/staff-validation-window.xml');
    writeFileSync(path.join(out, name + '.xml'), xml);
    console.log(path.join(out, name + '.png'));
    const visibleNodes = [...xml.toString().matchAll(/<node\b[^>]*>/g)].map(([node]) => {
      const attr = (key) => node.match(new RegExp(`${key}="([^"]*)"`))?.[1] || '';
      return { text: attr('text'), description: attr('content-desc'), className: attr('class'), bounds: attr('bounds'), clickable: attr('clickable') === 'true' };
    }).filter((node) => node.text || node.description);
    console.log(JSON.stringify(visibleNodes, null, 2));
    break;
  }
  case 'tap':
    if (args.length !== 2 || !args.every((value) => /^\d+$/.test(value))) throw new Error('Invalid coordinates.');
    run('shell', 'input', 'tap', ...args); break;
  case 'swipe':
    if (args.length !== 4 || !args.every((value) => /^\d+$/.test(value))) throw new Error('Invalid coordinates.');
    run('shell', 'input', 'swipe', ...args, '400'); break;
  case 'text':
    if (args.length !== 1 || !/^[\w@.+!-]+$/.test(args[0])) throw new Error('Only simple synthetic fixture input is supported.');
    run('shell', 'input', 'text', args[0]); break;
  case 'clear':
    // Select all in the currently focused synthetic test field, then delete.
    run('shell', 'input', 'keycombination', '113', '29');
    run('shell', 'input', 'keyevent', '67');
    break;
  case 'back': run('shell', 'input', 'keyevent', '4'); break;
  case 'open':
    if (!/^staff(?:\/[a-zA-Z0-9_-]+)*$/.test(args[0] || '')) throw new Error('Only Staff fixture routes are allowed.');
    run('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'urbanmind://' + args[0], '-p', app); break;
  case 'launch': run('shell', 'am', 'start', '-n', app + '/com.giaunh.urbanmind.MainActivity'); break;
  case 'bars': {
    const overlay = args[0] === 'gesture' ? 'gestural' : args[0] === 'buttons' ? 'threebutton' : null;
    if (!overlay) throw new Error('Expected gesture or buttons.');
    console.log(run('shell', 'cmd', 'overlay', 'enable-exclusive', '--category', 'com.android.internal.systemui.navbar.' + overlay).toString()); break;
  }
  case 'font':
    if (!['1', '1.5', '2'].includes(args[0])) throw new Error('Expected a test font scale.');
    run('shell', 'settings', 'put', 'system', 'font_scale', args[0]); break;
  case 'window':
    if (args[0] === 'narrow') run('shell', 'wm', 'size', '720x1280');
    else if (args[0] === 'reset') run('shell', 'wm', 'size', 'reset');
    else throw new Error('Expected narrow or reset.');
    break;
  case 'rotation':
    if (!['portrait', 'landscape'].includes(args[0])) throw new Error('Expected portrait or landscape.');
    run('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
    run('shell', 'settings', 'put', 'system', 'user_rotation', args[0] === 'landscape' ? '1' : '0');
    break;
  case 'dark':
    if (!['yes', 'no'].includes(args[0])) throw new Error('Expected yes or no.');
    run('shell', 'cmd', 'uimode', 'night', args[0]); break;
  case 'info':
    for (const key of ['ro.build.version.release', 'ro.build.version.sdk', 'sys.boot_completed']) console.log(key + '=' + run('shell', 'getprop', key).toString().trim());
    console.log(run('shell', 'wm', 'size').toString()); console.log(run('shell', 'wm', 'density').toString());
    console.log('font_scale=' + run('shell', 'settings', 'get', 'system', 'font_scale').toString().trim());
    console.log(run('shell', 'cmd', 'overlay', 'list', 'android').toString()); break;
  case 'errors': {
    const errors = run('logcat', '-d', 'AndroidRuntime:E', 'ReactNativeJS:E', '*:S').toString().trim();
    if (errors) {
      console.error(errors);
      process.exitCode = 1;
    } else {
      console.log('No AndroidRuntime:E or ReactNativeJS:E lines.');
    }
    break;
  }
  default: throw new Error('Unknown validation command.');
}
