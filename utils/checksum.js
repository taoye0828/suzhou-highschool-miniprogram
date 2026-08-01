const { canonicalJson } = require('./canonical-json')

const CHECKSUM_ALGORITHM = 'sha256'
const LEGACY_FNV_ALGORITHM = 'fnv1a32'

function sha256(input) {
  const text = unescape(encodeURIComponent(String(input)))
  const words = []
  const bitLength = text.length * 8
  for (let index = 0; index < text.length; index += 1) {
    words[index >> 2] = (words[index >> 2] || 0) |
      (text.charCodeAt(index) << (24 - (index % 4) * 8))
  }
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - bitLength % 32))
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength
  const constants = []
  const initial = []
  let candidate = 2
  while (constants.length < 64) {
    let prime = true
    for (let factor = 2; factor * factor <= candidate; factor += 1) {
      if (candidate % factor === 0) { prime = false; break }
    }
    if (prime) {
      if (initial.length < 8) initial.push((Math.sqrt(candidate) * 0x100000000) | 0)
      constants.push((Math.pow(candidate, 1 / 3) * 0x100000000) | 0)
    }
    candidate += 1
  }
  let hash = initial.slice()
  const schedule = new Array(64)
  const rotate = (value, amount) => (value >>> amount) | (value << (32 - amount))
  for (let offset = 0; offset < words.length; offset += 16) {
    const previous = hash.slice()
    for (let round = 0; round < 64; round += 1) {
      if (round < 16) schedule[round] = words[offset + round] | 0
      else {
        const x = schedule[round - 15]
        const y = schedule[round - 2]
        const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)
        const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)
        schedule[round] = (schedule[round - 16] + s0 + schedule[round - 7] + s1) | 0
      }
      const e = hash[4]
      const a = hash[0]
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const choice = (e & hash[5]) ^ (~e & hash[6])
      const temp1 = (hash[7] + sum1 + choice + constants[round] + schedule[round]) | 0
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const majority = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])
      const temp2 = (sum0 + majority) | 0
      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]]
    }
    hash = hash.map((value, index) => (value + previous[index]) | 0)
  }
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('')
}

function legacyFnv1a32(value) {
  let hash = 0x811c9dc5
  const input = unescape(encodeURIComponent(String(value)))
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function checksumInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const copy = { ...value }
  delete copy.checksum
  return copy
}

function checksumFor(value) {
  return sha256(canonicalJson(checksumInput(value)))
}

function verifyChecksum(value, checksum) {
  return Boolean(checksum && checksum.algorithm === CHECKSUM_ALGORITHM && checksum.value === checksumFor(value))
}

module.exports = {
  CHECKSUM_ALGORITHM,
  LEGACY_FNV_ALGORITHM,
  sha256,
  legacyFnv1a32,
  checksumInput,
  checksumFor,
  verifyChecksum
}
