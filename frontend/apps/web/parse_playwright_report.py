import json
from pathlib import Path
path = Path('tests/results/playwright-report.json')
raw = path.read_bytes()
text = raw.decode('utf-16')
idx = text.find('"config"')
if idx == -1:
    raise RuntimeError('Could not find JSON config marker')
root = text.rfind('{', 0, idx)
if root == -1:
    raise RuntimeError('Could not find JSON start')
json_text = text[root: text.rfind('}')+1]
obj = json.loads(json_text)
modules = {}
for suite in obj.get('suites', []):
    module = Path(suite.get('file', '')).parent.as_posix()
    module = module or Path(suite.get('file', '')).stem
    if module not in modules:
        modules[module] = {'tests':0,'passed':0,'failed':0,'blocked':0}
    for nested in suite.get('suites', []):
        for spec in nested.get('specs', []):
            modules[module]['tests'] += 1
            if spec.get('ok'):
                modules[module]['passed'] += 1
            else:
                modules[module]['failed'] += 1
print(json.dumps(modules, indent=2, ensure_ascii=False))
print('stats', json.dumps(obj.get('stats', {}), indent=2, ensure_ascii=False))
