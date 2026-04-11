with open('utils/precompute.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """async function precomputeAll() {
  const content = require('../database/content');
  const filesDb = require('../database/files');
  const bundlesDb = require('../database/bundles');

  const specs = await content.getSpecs();"""

new = """async function pLimit(fns, limit=3) {
  const results = [];
  let i = 0;
  async function worker() {
    while(i < fns.length) {
      const idx = i++;
      results[idx] = await fns[idx]();
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, fns.length)}, worker));
  return results;
}

async function precomputeAll() {
  const content = require('../database/content');
  const filesDb = require('../database/files');
  const bundlesDb = require('../database/bundles');

  const specs = await content.getSpecs();"""

# استبدل Promise.all بـ pLimit في precompute
content = content.replace(old, new)
content = content.replace(
    "  await Promise.all(specs.map(async sp => {",
    "  await pLimit(specs.map(sp => async () => {"
)
content = content.replace(
    "    await Promise.all(years.map(async yr => {",
    "    await pLimit(years.map(yr => async () => {"
)
content = content.replace(
    "      await Promise.all(sems.map(async sm => {",
    "      await pLimit(sems.map(sm => async () => {"
)
content = content.replace(
    "        await Promise.all(subs.map(async sb => {",
    "        await pLimit(subs.map(sb => async () => {"
)
content = content.replace(
    "          await Promise.all(cats.map(async cat => {",
    "          await pLimit(cats.map(cat => async () => {"
)

with open('utils/precompute.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Fixed")
