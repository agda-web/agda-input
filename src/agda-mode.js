/** @param {string[]} lines */
export function generateEntriesFromAgdaMode(lines) {
  /** @type {[string, string[]][]} */
  const entries = []

  for (let i = 0; i < lines.length; i++) {
    const commentStart = lines[i].indexOf(';;')
    if (commentStart >= 0) {
      lines[i] = lines[i].slice(0, commentStart)
    }
  }

  const doc = lines.join('\n')

  // e.g., ("~~~"  . ("≋"))
  //       ("/"          . ,(agda-input-to-string-list "／＼"))
  const regex = /\( *("[^"]+") *\. *(\((?:"([^"]|\\")+"\s*)+\)|,\(agda-input-to-string-list *"[^"]+?" *\)) *\)/g
  let mat
  while (mat = regex.exec(doc)) {
    let [, k, v] = mat
    /** @type {string[]} */
    let arr
    k = JSON.parse(k)
    if (v.startsWith('(')) {
      v = v.slice(1, -1).trim().replace(/ /g, ',')
      arr = JSON.parse(`[${v}]`)
    } else if (v.startsWith(',(agda-input-to-string-list')) {
      let vt = v.trim()
      const sint = vt.indexOf('"')
      vt = vt.slice(sint)
      const eint = vt.indexOf('"', 1)
      vt = vt.slice(0, eint + 1).replace(/\n/g, '')
      try {
        // split by UTF-8, and then remove spaces
        arr = [...JSON.parse(vt)].filter(x => x != ' ')
      } catch (e) {
        console.warn(`Error parsing agda-input-to-string-list [${v}]`)
        throw e
      }
    } else {
      throw new Error(k)
    }
    entries.push([k, arr])
  }

  return entries
}
