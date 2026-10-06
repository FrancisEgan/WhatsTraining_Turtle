// Run from any directory: node WhatsTraining_Turtle/tests/check-chains.cjs
// Class data uses one spell record per line; fail if that format changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../Classes/Turtle');
const totals = { classes: 0, spells: 0, chains: 0, prerequisites: 0, overrides: 0 };
const normalize = name => name.replace(/^(Mind-numbing Poison) (II|III)$/, '$1');
const races = ['HUMAN', 'DWARF', 'NIGHTELF', 'GNOME', 'UNDEAD', 'ORC', 'TAUREN', 'TROLL', 'HIGHELF', 'GOBLIN'];

for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.lua')).sort()) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  const spells = new Map();
  let bucket;
  for (const line of text.split(/\r?\n/)) {
    const level = /^\s*\[(\d+)\] = \{$/.exec(line);
    if (level) bucket = +level[1];
    if (!line.includes('{id=')) continue;
    const match = /\{id=(\d+),name="([^"]+)",subText="([^"]*)",level=(\d+),icon="([^"]+)",/.exec(line);
    assert(match, `${file}: malformed spell record: ${line}`);
    assert(/\},?$/.test(line), `${file}: malformed record ending: ${line}`);
    const [, id, name, subText, spellLevel] = match;
    assert(!spells.has(+id), `${file}: duplicate spell ID ${id}`);
    assert.equal(+spellLevel, bucket, `${file}: ${id} is in the wrong level bucket`);
    const restriction = /races=\{([^}]+)\}/.exec(line);
    const singleRace = /(?:^|,)race="([^"]+)"/.exec(line);
    const allowed = restriction ? [...restriction[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : singleRace ? [singleRace[1]] : races;
    const required = /requiredIds=\{([^}]*)\}/.exec(line);
    spells.set(+id, {
      id: +id, name, chain: normalize(name), rank: +(/^Rank (\d+)$/.exec(subText) || [])[1] || 0,
      level: +spellLevel, allowed,
      required: required ? required[1].split(',').map(Number) : [],
    });
  }
  const groups = new Map();
  for (const spell of spells.values()) {
    if (!spell.rank) continue;
    if (!groups.has(spell.chain)) groups.set(spell.chain, []);
    groups.get(spell.chain).push(spell);
  }
  for (const [name, chain] of groups) {
    // 6554 is an isolated, explicitly obsolete client record, not a rank of current Pummel.
    if (name === 'zzOLD Pummel') {
      assert.equal(chain.length, 1);
      assert.equal(chain[0].id, 6554);
      assert.equal(chain[0].required.length, 0);
      continue;
    }
    const maxRank = Math.max(...chain.map(s => s.rank));
    for (let rank = 1; rank <= maxRank; rank++) {
      assert(chain.some(s => s.rank === rank), `${file}: ${name} is missing rank ${rank}`);
    }
    for (const spell of chain) {
      assert.equal(spell.required.length, spell.rank === 1 ? 0 : 1, `${file}: ${spell.name} rank ${spell.rank} must require only its preceding rank`);
    }
    totals.chains++;
  }
  for (const spell of spells.values()) {
    for (const id of spell.required) {
      const previous = spells.get(id);
      assert(previous, `${file}: ${spell.id} requires unknown spell ${id}`);
      assert.equal(previous.chain, spell.chain, `${file}: ${spell.id} requires a different spell family`);
      assert.equal(previous.rank, spell.rank - 1, `${file}: ${spell.id} skips or reverses a rank`);
      assert(previous.level <= spell.level, `${file}: ${spell.id} requires a higher level spell`);
      for (const race of spell.allowed) {
        assert(previous.allowed.includes(race), `${file}: ${spell.id} requires a spell unavailable to ${race}`);
      }
      totals.prerequisites++;
    }
    // Explicit graph traversal also catches any cycles introduced into unranked spells.
    const visit = (current, ancestors) => {
      assert(!ancestors.has(current.id), `${file}: cycle involving ${current.id}`);
      const next = new Set([...ancestors, current.id]);
      for (const id of current.required) visit(spells.get(id), next);
    };
    visit(spell, new Set());
  }
  const block = /OverridenSpells\["[^"]+"\]\s*=\s*\{([\s\S]*?)\r?\n\}/.exec(text);
  for (const match of (block ? block[1] : '').matchAll(/\[(\d+)\]\s*=\s*\{([^}]+)\}/g)) {
    const source = spells.get(+match[1]);
    assert(source, `${file}: override source ${match[1]} is missing`);
    const ids = match[2].split(',').map(Number);
    assert.equal(new Set(ids).size, ids.length, `${file}: repeated override IDs for ${source.id}`);
    for (const id of ids) {
      const previous = spells.get(id);
      assert(previous, `${file}: override target ${id} is missing`);
      assert.notEqual(id, source.id, `${file}: override refers to itself`);
      if (source.id === 9634 && id === 5487) continue; // Dire Bear Form replaces Bear Form.
      assert.equal(source.chain, previous.chain, `${file}: override crosses spell families`);
      assert(previous.rank < source.rank, `${file}: override references an equal or higher rank`);
    }
    if (source.rank) {
      const expected = [...spells.values()].filter(s => s.chain === source.chain && s.rank < source.rank).map(s => s.id).sort((a, b) => a - b);
      assert.deepEqual([...ids].sort((a, b) => a - b), expected, `${file}: override does not cover every earlier rank of ${source.name}`);
    }
    totals.overrides++;
  }
  totals.classes++;
  totals.spells += spells.size;
  console.log(`PASS ${file}: ${spells.size} spell records`);
}
assert.equal(totals.classes, 9);
console.log('PASS all class rank chains:', JSON.stringify(totals));
