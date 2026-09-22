import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const staging = mkdtempSync(join(tmpdir(), 'cfsm-preview-test-'))
afterAll(() => rmSync(staging, { recursive: true, force: true }))
const script = fileURLToPath(new URL('../scripts/publish-preview.mjs', import.meta.url))

function fixture() {
  const root = mkdtempSync(join(staging, 'case-'))
  const remote = join(root, 'remote.git')
  const source = join(root, 'source')
  const theme = join(root, 'theme')
  const archive = join(root, 'theme.zip')
  mkdirSync(source)
  mkdirSync(join(theme, 'assets'), { recursive: true })
  writeFileSync(join(theme, 'index.html'), '<script src="./assets/app.js"></script>')
  writeFileSync(join(theme, 'assets/app.js'), 'console.log("fixture")')
  if (process.platform === 'win32') execFileSync('tar.exe', ['-a', '-cf', archive, 'index.html', 'assets'], { cwd: theme })
  else execFileSync('zip', ['-qr', archive, 'index.html', 'assets'], { cwd: theme })
  const git = (...args: string[]) => execFileSync('git', args, { cwd: source, encoding: 'utf8', stdio: 'pipe' }).trim()
  git('init', '--bare', remote)
  git('init', '-b', 'main')
  git('config', 'user.name', 'Preview Test')
  git('config', 'user.email', 'preview@example.invalid')
  writeFileSync(join(source, 'source.txt'), 'keep source files and index')
  git('add', '.')
  git('commit', '-m', 'source baseline')
  git('remote', 'add', 'origin', remote)
  git('push', 'origin', 'main')
  const sha = git('rev-parse', 'HEAD')
  const publish = (sourceSha = sha, zip = archive) => spawnSync(process.execPath, [script, zip, sourceSha], {
    cwd: source, encoding: 'utf8', timeout: 15_000,
  })
  return { root, source, remote, archive, git, sha, publish }
}

describe('installable main preview publishing', { timeout: 30_000 }, () => {
  it('creates and fast-forwards only preview-main, preserving the source tree and index', () => {
    const f = fixture()
    expect(f.publish().status).toBe(0)
    f.git('fetch', 'origin', 'preview-main')
    const first = f.git('rev-parse', 'FETCH_HEAD')
    expect(f.git('ls-tree', '--name-only', 'FETCH_HEAD').split('\n')).toEqual(['assets', 'index.html'])
    expect(f.git('show', '-s', '--format=%B', 'FETCH_HEAD')).toContain(`Source: ${f.sha}`)
    expect(f.publish().status).toBe(0)
    f.git('fetch', 'origin', 'preview-main')
    expect(f.git('rev-parse', 'FETCH_HEAD^')).toBe(first)
    expect(f.git('branch', '--show-current')).toBe('main')
    expect(f.git('rev-parse', 'HEAD')).toBe(f.sha)
    expect(f.git('status', '--porcelain')).toBe('')
    expect(readFileSync(join(f.source, 'source.txt'), 'utf8')).toBe('keep source files and index')
    expect(f.git('ls-remote', '--heads', 'origin').split('\n')).toHaveLength(2)
    expect(f.git('ls-remote', '--tags', 'origin')).toBe('')
  })

  it('skips a superseded source without creating a preview branch', () => {
    const f = fixture()
    f.git('commit', '--allow-empty', '-m', 'new main')
    f.git('push', 'origin', 'main')
    const result = f.publish()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('skipping')
    expect(f.git('ls-remote', 'origin', 'refs/heads/preview-main')).toBe('')
  })

  it('fails closed on a broken archive without publishing', () => {
    const f = fixture()
    const broken = join(f.root, 'broken.zip')
    writeFileSync(broken, 'not an archive')
    expect(f.publish(f.sha, broken).status).not.toBe(0)
    expect(f.git('ls-remote', 'origin', 'refs/heads/preview-main')).toBe('')
  })
})
