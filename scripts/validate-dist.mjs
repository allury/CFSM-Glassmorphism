import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(projectRoot, 'dist')
const expectedRootEntries = ['assets', 'index.html']
const forbiddenRuntimeMarkers = [
  '/api/public',
  '/api/nodes',
  '/api/clients',
  '/rpc2',
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

const textFiles = [indexPath, ...assetFiles.filter((file) => /\.(css|js|html|map)$/.test(file))]
for (const file of textFiles) {
  const content = await readFile(file, 'utf8')
  const marker = forbiddenRuntimeMarkers.find((item) => content.includes(item))
  if (marker) throw new Error('Forbidden Komari runtime marker ' + marker + ' found in ' + file)
}

console.log(
  'dist validation passed: index.html and ' + assetFiles.length + ' asset file(s)',
)

