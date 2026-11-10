const test = require('node:test');
const assert = require('node:assert/strict');
const { isMp4 } = require('../src/lib/mp4');

test('ftyp kutusu olan dosya mp4 sayılır', () => {
  const buf = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(8)]);
  assert.equal(isMp4(buf), true);
});

test('başka dosyalar reddedilir', () => {
  assert.equal(isMp4(Buffer.from('<html>hello</html>')), false);
  assert.equal(isMp4(Buffer.alloc(4)), false);
});
