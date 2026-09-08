import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(projectRoot, 'dist')
const expectedRootEntries = ['assets', 'index.html']
const sizeBudgets = {
  javascript: 512 * 1024,
  stylesheet: 128 * 1024,
  allAssets: 768 * 1024,
}
const forbiddenRuntimeMarkers = [
  '/api/public',
  '/api/nodes',
  '/api/clients',
  '/api/rpc',
  '/rpc2',
  '/manage/',
  'Komari RPC',
  'common:',
  'public:',
  'admin:',
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = resolve(directory, entry.name)
    return entry.isDirectory() ? collectFiles(absolute) : [absolute]
  }))
  return files.flat()
}

const rootEntries = (await readdir(distRoot)).sort()
if (JSON.stringify(rootEntries) !== JSON.stringify(expectedRootEntries)) {
  throw new Error(
    'dist root must contain only index.html and assets; found: ' + rootEntries.join(', '),
  )
}

const indexPath = resolve(distRoot, 'index.html')
if (!(await stat(indexPath)).isFile()) throw new Error('dist/index.html is not a file')

const assetFiles = await collectFiles(resolve(distRoot, 'assets'))
if (assetFiles.length === 0) throw new Error('dist/assets is empty')

const assetSizes = await Promise.all(assetFiles.map(async (file) => ({
  file,
  bytes: (await stat(file)).size,
})))
const javascriptBytes = assetSizes
  .filter(({ file }) => file.endsWith('.js'))
  .reduce((sum, { bytes }) => sum + bytes, 0)
const stylesheetBytes = assetSizes
  .filter(({ file }) => file.endsWith('.css'))
  .reduce((sum, { bytes }) => sum + bytes, 0)
const allAssetBytes = assetSizes.reduce((sum, { bytes }) => sum + bytes, 0)

for (const [label, actual, budget] of [
  ['JavaScript', javascriptBytes, sizeBudgets.javascript],
  ['CSS', stylesheetBytes, sizeBudgets.stylesheet],
  ['total assets', allAssetBytes, sizeBudgets.allAssets],
]) {
  if (actual > budget) {
    throw new Error(`${label} size ${actual} bytes exceeds the ${budget}-byte release budget`)
  }
}

const textFiles = [indexPath, ...assetFiles.filter((file) => /\.(css|js|html|map)$/.test(file))]
for (const file of textFiles) {
  const content = await readFile(file, 'utf8')
  const marker = forbiddenRuntimeMarkers.find((item) => content.includes(item))
  if (marker) throw new Error('Forbidden Komari runtime marker ' + marker + ' found in ' + file)
}

console.log(
  'dist validation passed: index.html and ' + assetFiles.length + ' asset file(s); '
  + `${(javascriptBytes / 1024).toFixed(1)} KiB JS, `
  + `${(stylesheetBytes / 1024).toFixed(1)} KiB CSS, `
  + `${(allAssetBytes / 1024).toFixed(1)} KiB total assets`,
)
