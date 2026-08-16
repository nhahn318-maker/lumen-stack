const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'release', 'lumen-stack')
const files = [
  'index.html',
  'src/index.js',
  'assets/twilight-garden-bg.webp',
  'LICENSE',
  'ATTRIBUTION.md'
]

fs.rmSync(output, { recursive: true, force: true })

for (const relativePath of files) {
  const source = path.join(root, relativePath)
  const destination = path.join(output, relativePath)
  if (!fs.existsSync(source)) throw new Error(`Missing release file: ${relativePath}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
}

const totalBytes = files.reduce((sum, relativePath) => {
  return sum + fs.statSync(path.join(output, relativePath)).size
}, 0)

console.log(`Release created: ${output}`)
console.log(`Files: ${files.length}; raw size: ${(totalBytes / 1024).toFixed(1)} KiB`)
