import fs from 'node:fs/promises'
import path from 'node:path'

import { generateEntriesFromUCD } from './ucd.js'
import { generateEntriesFromQuail } from './quail.js'
import { generateEntriesFromAgdaMode } from './agda-mode.js'

const __dirname = import.meta.dirname

/**
 * @template T
 * @param {T[]} xs */
function uniq(xs) {
  const ret = []
  const seen = new Set()
  for (const x of xs) {
    if (!seen.has(x)) {
      ret.push(x)
    }
    seen.add(x)
  }
  return ret
}

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
  let first = true
  for (let [k, v] of entries) {
    if (typeof v === 'string') v = [v]
    // do escaping for certain characters that may not display properly
    v = Array.from(JSON.stringify(v))
      .map(s => s.replace(/\p{M}|\p{C}|\p{Z}/v, m => {
          // split to UTF-16 since JS only supports \uXXXX
          return m.split('')
            .map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
            .join('')
        }))
      .join('')

    await hdl.appendFile((first ? '' : ',\n') + `${JSON.stringify(k)}: ${v}`)
    first = false
  }
  await hdl.appendFile('\n}\n')
}

async function main() {
  // [(ucd + quail) filter by agda] + agda inp

  const unicodeData = await fs.readFile(path.join(__dirname, '../data/UnicodeData.txt'), 'utf-8')
  const unicodeEntries = generateEntriesFromUCD(unicodeData.split('\n').filter(x => x.trim()))

  const quailData = await fs.readFile(path.join(__dirname, '../data/latin-ltx.el'), 'utf-8')
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

  const agdaData = await fs.readFile(path.join(__dirname, '../data/agda-input.el'), 'utf-8')
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
  entries = entries.map(([k, vs]) => [k, uniq(vs)])

  const hdl = await fs.open(path.join(__dirname, '../out/dict.json'), 'w')
  await writeEntries(hdl, entries)
  await hdl.close()
}

await main()
