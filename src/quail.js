/** @param {string[]} lines */
export function generateEntriesFromQuail(lines) {
  /** @type {[string, string][]} */
  const entries = []
  for (let line of lines) {
    // very crude way to strip comments
    // we assume there is no ";;" in string literals
    const commentStart = line.indexOf(';;')
    if (commentStart >= 0) {
      line = line.slice(0, commentStart)
    }

    const regex = /\(("(?:[^"]|\\")+") +\?\\?([^\n])\)/g
    let mat
    while (mat = regex.exec(line)) {
      const [, k, v] = mat
      entries.push([JSON.parse(k), v])
    }
  }

  return entries
}
