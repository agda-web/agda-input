import { generateEntriesFromUCD } from './ucd.js'
import { generateEntriesFromQuail } from './quail.js'
import { generateEntriesFromAgdaMode } from './agda-mode.js'

/** See "agda-input-inherit" in agda-input.el.
 * @param {string} k */
function convertPrefix(k) {
  if (k.match(/^(_|\^[^lorv])/)) return k
  if (k.startsWith('\\')) {
    k = k.slice(1)
    if (!["geq", "leq", "bullet", "qed", "par"].includes(k))
      return k
  }
  return null
}

import fs from 'node:fs/promises'

/** @param {[string, ...any][]} entries */
function sortEntries(entries) {
  entries.sort(([a], [b]) => {
    return a > b ? 1 : a == b ? 0 : -1
  })
  return entries
}

/** @param {fs.FileHandle} hdl
 * @param {[string, string | string[]][]} entries  */
async function writeEntries(hdl, entries) {
  await hdl.appendFile('{\n')
  for (let [k, v] of entries) {
    if (typeof v === 'string') v = [v]
    v = Array.from(JSON.stringify(v))
      .map(s => s.replace(/\p{M}|\p{C}|\p{Z}/v, m => {
          const p = m.codePointAt(0)
          if (p == null) throw 0
          const h = p.toString(16)
          return p > 0xffff ? `\\u{${h.padStart(6, '0')}}` : `\\u${h.padStart(4, '0')}`
        }))
      .join('')

    await hdl.appendFile(`${JSON.stringify(k)}: ${v},\n`)
  }
  await hdl.appendFile('}\n')
}

async function main() {
  // [(ucd + quail) filter by agda] + agda inp

  const unicodeData = await fs.readFile('../data/UnicodeData.txt', 'utf-8')
  const unicodeEntries = generateEntriesFromUCD(unicodeData.split('\n').filter(x => x.trim()))

  const quailData = await fs.readFile('../data/latin-ltx.el', 'utf-8')
  const quailEntries = generateEntriesFromQuail(quailData.split('\n'))

  /** @type {Record<string, string[]>} */
  const obj = Object.create(null)
  for (const [seq, v] of unicodeEntries.concat(quailEntries)) {
    const k = convertPrefix(seq)
    if (k == null) continue
    if (obj[k] == null) {
      obj[k] = []
    }
    obj[k].push(v)
  }

  const agdaData = await fs.readFile('../data/agda-input.el', 'utf-8')
  const agdaEntries = generateEntriesFromAgdaMode(agdaData.split('\n'))

  for (const [seq, vs] of agdaEntries) {
    if (obj[seq] == null) {
      obj[seq] = vs
    } else {
      vs.forEach(v => obj[seq].push(v))
    }
  }

  let entries = Object.entries(obj)
  sortEntries(entries)
  entries = entries.map(([k, vs]) => [k, Array.from(new Set(vs)).sort()])

  const hdl = await fs.open('../out/final.json', 'w')
  await writeEntries(hdl, entries)
  await hdl.close()
}

await main()
