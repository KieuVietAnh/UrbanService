import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const readProductionSources = () => {
  const roots = [
    new URL('../app/', import.meta.url),
    new URL('../src/', import.meta.url),
  ];

  return roots.flatMap((root) =>
    readdirSync(root, { recursive: true })
      .filter((name) => /\.(?:js|jsx|ts|tsx)$/.test(name))
      .map((name) => ({
        name: name.replaceAll('\\', '/'),
        source: readFileSync(new URL(name.replaceAll('\\', '/'), root), 'utf8'),
      })),
  );
};

test('resident and staff production bundles contain no sample records or remote placeholder imagery', () => {
  for (const file of readProductionSources()) {
    assert.doesNotMatch(file.source, /\b(?:FALLBACK_INCIDENTS|COMMUNITY_IMAGES|MOCK_DATA|DUMMY_DATA|SAMPLE_DATA)\b/, file.name);
    assert.doesNotMatch(file.source, /images\.unsplash\.com|picsum\.photos|via\.placeholder\.com/i, file.name);
    assert.doesNotMatch(file.source, /Math\.random\(\)/, `${file.name}: API records need stable identifiers`);
  }
});

test('resident home renders the real community feed and an honest empty state', () => {
  const hook = readFileSync(new URL('../src/features/home/hooks/useHomeData.ts', import.meta.url), 'utf8');
  const cards = readFileSync(new URL('../src/features/home/components/FeaturedIncidents.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/features/home/components/NearbyIncidents.tsx', import.meta.url), 'utf8');
  assert.match(hook, /communityApi\.getFeed/);
  assert.doesNotMatch(hook, /nearby:\s*tickets\.slice/);
  assert.match(cards, /items\.length === 0/);
  assert.match(cards, /communityApi\.getFeedDetail/);
  assert.match(cards, /\/\(resident\)\/community\/\$\{id\}/);
  assert.doesNotMatch(cards, /\b(?:120m|250m|380m|560m)\b/);
  assert.doesNotMatch(map, /bán kính 1 km/);
});

test('legacy resident routes never synthesize conversation or community records', () => {
  const inbox = readFileSync(new URL('../src/features/messaging/components/inbox-conversation-screen.tsx', import.meta.url), 'utf8');
  const community = readFileSync(new URL('../app/(resident)/community-legacy.tsx', import.meta.url), 'utf8');
  const ai = readFileSync(new URL('../src/features/messaging/components/ai-conversation-screen.tsx', import.meta.url), 'utf8');
  assert.match(inbox, /<Redirect/);
  assert.match(community, /<Redirect/);
  assert.doesNotMatch(ai, /id:\s*['"]welcome['"]/);
});
