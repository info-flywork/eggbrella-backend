/** ISO BMFF (MP4): ilk kutu 'ftyp' olmalı (4..8. baytlar). */
function isMp4(buffer) {
  return buffer.length >= 12 && buffer.toString('latin1', 4, 8) === 'ftyp';
}

module.exports = { isMp4 };
