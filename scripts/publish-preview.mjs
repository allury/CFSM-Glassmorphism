import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [archivePath, sourceSha] = process.argv.slice(2)
if (!archivePath || !/^[a-f0-9]{40}$/.test(sourceSha ?? '')) {
  throw new Error('Usage: node scripts/publish-preview.mjs <verified.zip> <source-sha>')
}
const git = (args, options = {}) => execFileSync('git', args, {
  encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options,
}).trim()
const sourceTip = () => git(['ls-remote', '--exit-code', 'origin', 'refs/heads/main']).split(/\s/)[0]

if (sourceTip() !== sourceSha) {
  console.log('Source main has advanced; skipping the superseded preview.')
} else {
  // 独立工作目录和 index，不切源码分支，不清理源码文件，也不强推。
  const staging = mkdtempSync(join(tmpdir(), 'cfsm-preview-'))
  try {
    const themeDir = join(staging, 'theme')
    mkdirSync(themeDir)
    const archive = resolve(archivePath)
    if (process.platform === 'win32') execFileSync('tar.exe', ['-xf', archive, '-C', themeDir])
    else execFileSync('unzip', ['-q', archive, '-d', themeDir])
    if (readdirSync(themeDir).sort().join(',') !== 'assets,index.html'
      || !statSync(join(themeDir, 'index.html')).isFile()
      || !statSync(join(themeDir, 'assets')).isDirectory()) {
      throw new Error('Preview archive must contain only index.html and assets/')
    }

    const previewRef = 'refs/heads/preview-main'
    const parent = []
    // 不用 --exit-code：分支不存在可初始化，网络失败必须中止。
    if (git(['ls-remote', 'origin', previewRef])) {
      git(['fetch', '--no-tags', 'origin', previewRef])
      parent.push('-p', git(['rev-parse', 'FETCH_HEAD']))
    }
    const env = {
      ...process.env,
      GIT_INDEX_FILE: join(staging, 'index'),
      GIT_AUTHOR_NAME: 'github-actions[bot]',
      GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'github-actions[bot]',
      GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    }
    const gitDir = git(['rev-parse', '--absolute-git-dir'])
    git([`--git-dir=${gitDir}`, `--work-tree=${themeDir}`, 'add', '-f', '--', 'index.html', 'assets'], { env })
    const tree = git(['write-tree'], { env })
    const commit = git(['commit-tree', tree, ...parent], {
      env, input: `main 预览 · ${sourceSha.slice(0, 7)}\n\nSource: ${sourceSha}\n`,
    })
    if (sourceTip() !== sourceSha) {
      console.log('Source main advanced during packaging; skipping the superseded preview.')
    } else {
      // 并发修改远端时由普通 fast-forward push 拒绝覆盖。
      git(['push', 'origin', `${commit}:${previewRef}`])
      console.log(`Published preview-main from ${sourceSha}`)
    }
  } finally {
    // 唯一删除目标是本次 mkdtemp 创建的目录。
    rmSync(staging, { recursive: true, force: true })
  }
}
