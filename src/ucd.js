/** @param {string} s */
function capitalize(s) {
  return s.split(' ')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
          .join(' ')
}

/** @type {(s: string) => Record<string, string>} */
const parseLinesOfPair = s => Object.fromEntries(/** @type {[string, string][]} */(s.split('\n')
  .map(s => s.trim())
  .filter(s => !s.startsWith(';;'))
  .map(s => {
    const mat = s.match(/\(([-A-Z" ]+)\s+.\s+(\S+)\)/)
    return /** @type {string[] | null} */(mat ? [mat[1], mat[2]].map(x => JSON.parse(x)) : null)
  })
  .filter(x => x != null)))

// copied from latin-ltx.el with minimal modification to put in a template string
const markMapping = parseLinesOfPair(`
    ("DOT BELOW" . "d")
    ("DOT ABOVE" . ".")
    ("OGONEK" . "k")
    ("CEDILLA" . "c")
    ("CARON" . "v")
    ;; ("HOOK ABOVE" . ??)
    ("MACRON" . "=")
    ("BREVE" . "u")
    ("TILDE" . "~")
    ("GRAVE" . "${'`'}")
    ("CIRCUMFLEX" . "^")
    ("DIAERESIS" . "\\"")
    ("DOUBLE ACUTE" . "H")
    ("ACUTE" . "'")`)

const mathVariantMapping = parseLinesOfPair(`
      ("BOLD" . "bf")
      ("ITALIC" . "it")
      ("BOLD ITALIC" . "bfit")
      ("DOUBLE-STRUCK" . "bb")
      ("SCRIPT" . "scr")
      ("BOLD SCRIPT" . "bfscr")
      ("FRAKTUR" . "frak")
      ("BOLD FRAKTUR" . "bffrak")
      ("SANS-SERIF" . "sf")
      ("SANS-SERIF BOLD" . "bfsf")
      ("SANS-SERIF ITALIC" . "sfit")
      ("SANS-SERIF BOLD ITALIC" . "bfsfit")
      ("MONOSPACE" . "tt")`)

/** @type {Record<string, number>} */
const numberNameToDigit = {
  ZERO: 0, ONE: 1, TWO:   2, THREE: 3, FOUR: 4,
  FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9,
}

/** @typedef UCDMatchContext
 * @property {number} code
 * @property {(s: string) => boolean} isMark
 * @property {(s: string) => boolean} isMathVariant
 * @property {(name: string) => string | null} getCharByName */

/** @typedef UCDNamePattern
 * @property {RegExp} matcher
 * @property {(ctx: UCDMatchContext, ...args: (string | undefined)[]) => string | string[] | null} keys */

/**
 * @type {UCDNamePattern[]}
 * this is the most labor-intensive part.
 * please read `latin-ltx.el`, find the giant `latin-ltx--define-rules` section,
 * and translate each and every unicode matching blocks, in appearing order,
 * to a { matcher, keys } block below.
 */
const patterns = [
  {
    // e.g. U+01D6: LATIN SMALL LETTER U WITH DIAERESIS AND MACRON
    // -> \"={u}
    matcher: /^LATIN (?:CAPITAL|SMAL(L)) LETTER (.) WITH (.+)(?: AND (.+))?$/,
    keys(ctx, l, c, mark1, mark2) {
      if (!c || !mark1) throw 0
      if (!ctx.isMark(mark1) || (mark2 && !ctx.isMark(mark2))) return null
      if (l != null) c = c.toLowerCase()
      const marks = mark2 ? `${markMapping[mark1]}\\${markMapping[mark2]}` : markMapping[mark1]
      const keys = [`\\${marks}{${c}}`]  // note the extra braces!
      // Exclude "\\d" as per the spec, but why reversing the order?
      if ((mark2 ?? mark1) != 'DOT BELOW') {
        keys.push(`\\${marks}${c}`)
      }
      return keys
    },
  },
  {
    // e.g. U+0300: COMBINING GRAVE ACCENT -> \`
    matcher: /^COMBINING (.+?)(?: ACCENT)?$/,
    keys(ctx, mark) {
      if (!mark) throw 0
      if (!ctx.isMark(mark)) return null
      return `\\${markMapping[mark]}`
    },
  },
  {
    // e.g. U+00AF: SPACING MACRON -> \={}
    matcher: /^(?:SPACING )?(.+?)(?: ACCENT)?$/,
    keys(ctx, mark) {
      if (!mark) throw 0
      if (!ctx.isMark(mark)) return null
      if (ctx.code < 128) return null
      return `\\${markMapping[mark]}{}`
    },
  },
  {
    // e.g. U+2096: LATIN SUBSCRIPT SMALL LETTER K -> _k
    matcher: /(.*)SU(?:B|(PER))SCRIPT (.*)/,
    keys(ctx, part0, per, part1) {
      const base = (part0 || '') + (part1 || '')
      const basechar = ctx.getCharByName(base)
      if (basechar != null &&
          (basechar.codePointAt(0) ?? 0) < 128)
        return (per ? '^' : '_') + basechar
      return null
    },
  },
  {
    // e.g. U+1D66: GREEK SUBSCRIPT SMALL LETTER BETA
    // -> \_beta
    matcher: /^GREEK SUBSCRIPT SMALL LETTER (.+)$/,
    keys(_ctx, c) {
      if (!c) throw 0
      const name = c.toLowerCase()
      return `_\\${name}`
    }
  },
  {
    // e.g. U+02B7: MODIFIER LETTER SMALL W -> ^w
    //      U+02B1: MODIFIER LETTER SMALL H WITH HOOK -> ^\h with hook
    //      U+1D2F: MODIFIER LETTER CAPITAL BARRED B -> ^\Barred B
    matcher: /^MODIFIER LETTER (?:SMALL|CAPITA(L)) ([\x20-\x7f]+)$/,
    keys(_ctx, l, basename) {
      if (!basename) throw 0
      const name = l ? capitalize(basename) : basename.toLowerCase()
      return '^' + (name.length > 1 ? `\\${name}` : name)
    }
  },
  {
    // e.g. U+00AE: REGISTERED SIGN -> \registered
    matcher: /^([^- ]+) SIGN$/,
    keys(ctx, name) {
      if (!name) throw 0
      // exclude NOT SIGN
      if (ctx.code < 128 || name == 'NOT') {
        return null
      }
      return '\\' + name.toLowerCase()
    }
  },
  {
    // e.g. U+0391: GREEK CAPITAL LETTER ALPHA -> \Alpha
    matcher: /^GREEK (?:SMALL|CAPITA(L)) LETTER ([^- ]+)$/,
    keys(_ctx, l, c) {
      if (!c) throw 0
      // exclude eps & phi as per spec
      if (l == null && c.match(/EPSILON|PHI/)) return null
      const name = l ? capitalize(c) : c.toLowerCase()
      return '\\' + name
    },
  },
  {
    // e.g. U+03D0: GREEK BETA SYMBOL -> \varbeta
    matcher: /^GREEK ([^- ]+) SYMBOL$/,
    keys(_ctx, name) {
      if (!name) throw 0
      // exclude phi as per spec
      if (name == 'PHI') return null
      return '\\var' + name.toLowerCase()
    }
  },

  // "Mathematical alphabet"
  {
    // e.g. U+1D400: MATHEMATICAL BOLD CAPITAL A -> \bfA
    matcher: /^MATHEMATICAL (.+?) (?:SMALL|CAPITA(L)) (.+)$/,
    keys(ctx, va, l, c) {
      if (!c) throw 0
      if (va == null || !ctx.isMathVariant(va)) throw 0
      const name = l ? capitalize(c) : c.toLowerCase()
      return `\\${mathVariantMapping[va]}${name}`
    }
  },
  {
    // e.g. U+1D7D1: MATHEMATICAL BOLD DIGIT THREE -> \bf3
    matcher: /^MATHEMATICAL (.+?) DIGIT (.+)$/,
    keys(ctx, va, num) {
      if (!num) throw 0
      if (va == null || !ctx.isMathVariant(va)) throw 0
      return `\\${mathVariantMapping[va]}${numberNameToDigit[num]}`
    }
  },
  {
    matcher: /^MATHEMATICAL (.+?) ([A-Z]+) SYMBOL$/,
    keys(ctx, va, name) {
      if (!name) throw 0
      // original comment: This avoids e.g. MATHEMATICAL BOLD CAPITAL <greek> SYMBOL
      if (va == null || !ctx.isMathVariant(va)) return null
      return `\\${mathVariantMapping[va]}var${name}`
    }
  },
  {
    matcher: /^MATHEMATICAL (.+?) (?:NABLA|PARTIAL DIFFERENTIA(L))$/,
    keys(ctx, va, l) {
      const basename = l ? 'partial' : 'nabla'
      if (va == null || !ctx.isMathVariant(va)) throw 0
      return `\\${mathVariantMapping[va]}${basename}`
    }
  },
]

/** @param {string[]} lines */
export function generateEntriesFromUCD(lines, debug = false) {
  /** @type {[number, string][]} */
  const unicodeList = []
  const nameToCode = Object.create(null)
  for (let line of lines) {
    let cols = line.split(';')
    const [_code, name] = cols
    const code = parseInt(_code, 16)
    nameToCode[name] = code
    unicodeList.push([code, name])

    // uni-name seems to also recognize old names
    const oldName = cols[10]
    if (oldName) unicodeList.push([code, oldName])
  }

  /** @type {[string, string][]} */
  const entries = []
  for (let [code, name] of unicodeList) {
    for (let i = 0; i < patterns.length; i++) {
      const { matcher, keys } = patterns[i]

      let mat
      if (mat = name.match(matcher)) {
        /** @type {UCDMatchContext} */
        const ctx = {
          code,
          isMark: s => s in markMapping,
          isMathVariant: s => s in mathVariantMapping,
          getCharByName: name => {
            let n = nameToCode[name]
            return n == null ? null : String.fromCodePoint(n)
          },
        }
        let ks
        try {
          ks = keys(ctx, ...Array.from(mat).slice(1))
        } catch (e) {
          console.warn(`Error when processing [${name}] with pattern idx=${i}`)
          throw e
        }

        if (ks != null) {
          if (typeof ks === 'string') ks = [ks]
          if (debug) {
            console.log(`Matched U+${code.toString(16).toUpperCase().padStart(4, '0')} [${name}] with pattern idx=${i} keys=${ks}`)
          }
          ks.forEach(k => entries.push([k, String.fromCodePoint(code)]))
        }
      }
    }
  }

  return entries
}
