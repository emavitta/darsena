import { stat } from 'node:fs/promises'
import type { GitState, GitAction } from '../shared/types.js'
import { command } from './io.js'
import { listWorktrees } from './git.js'

const git = (cwd: string, args: string[], timeout = 12000) => command('git', ['-C', cwd, ...args], undefined, timeout)

export async function gitState(worktree: string): Promise<GitState> {
  const status = await git(worktree, ['status', '--porcelain=v2', '--branch', '-z'])
  const fields = status.split('\0').filter(Boolean)
  const header = (name: string) => fields.find(line => line.startsWith(`# ${name} `))?.slice(name.length + 3)
  const branch = header('branch.head')
  const upstream = header('branch.upstream')
  const counts = header('branch.ab')?.match(/^\+(\d+) -(\d+)$/)
  const refs = await git(worktree, ['for-each-ref', '--sort=refname', '--format=%(refname)%00%(upstream:short)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(symref)', 'refs/heads/', 'refs/remotes/'])
  const worktrees = await listWorktrees(worktree, false)
  const branches = refs.trimEnd().split('\n').filter(Boolean).map(line => {
    const [ref = '', tracking = '', remote = '', remoteRef = '', symbolic = ''] = line.split('\0')
    const local = ref.startsWith('refs/heads/')
    return { ref, name: ref.replace(/^refs\/(heads|remotes)\//, ''), local, upstream: tracking || undefined, remote, remoteRef, symbolic, worktrees: local ? worktrees.filter(tree => tree.branch === ref.slice(11)).map(tree => tree.path) : [] }
  }).filter(branch => !branch.symbolic)
  let operation: string | undefined
  for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_START', 'sequencer']) {
    const location = (await git(worktree, ['rev-parse', '--path-format=absolute', '--git-path', marker])).trimEnd()
    if (await stat(location).then(() => true).catch(() => false)) { operation = marker; break }
  }
  return {
    branch: branch && branch !== '(detached)' ? branch : null,
    head: header('branch.oid') === '(initial)' ? '' : header('branch.oid') || '',
    upstream,
    ahead: counts ? Number(counts[1]) : undefined,
    behind: counts ? Number(counts[2]) : undefined,
    dirty: fields.some(line => /^[12u?] /.test(line)),
    operation,
    branches,
    remotes: (await git(worktree, ['remote'])).trim().split('\n').filter(Boolean),
    checkedAt: Date.now(),
  }
}

export async function gitAction(worktree: string, action: GitAction, expectedHead: string, expectedBranch: string | null) {
  const before = await gitState(worktree)
  if (action === 'fetch') {
    if (!before.remotes.length) throw new Error('No remote is configured for this repository.')
    await git(worktree, ['fetch', '--all', '--no-prune', '--no-prune-tags', '--no-recurse-submodules'], 60000)
    return { state: await gitState(worktree), message: 'Fetched all remotes. Working files are unchanged.' }
  }
  const check = (state: GitState) => {
    if (state.head !== expectedHead || state.branch !== expectedBranch) throw new Error('The checked-out branch or commit changed. Refresh Git status and try again.')
    if (!state.branch || !state.head) throw new Error('Pull needs a branch with at least one commit; detached HEAD cannot be pulled.')
    if (state.dirty) throw new Error('This worktree has local changes. Commit or stash them in your Git tool before pulling.')
    if (state.operation) throw new Error('A Git operation is in progress. Finish it in your Git tool before pulling.')
    if (!state.upstream) throw new Error('This branch has no upstream. Set its tracking branch in your Git tool first.')
  }
  check(before)
  const branch = before.branches.find(item => item.local && item.name === before.branch)!
  // Fetch first, then revalidate the checkout before touching files. Never auto-stash or rebase.
  if (branch.remote && branch.remote !== '.') {
    await git(worktree, ['fetch', '--no-prune', '--no-prune-tags', '--no-recurse-submodules', '--', branch.remote], 60000)
  }
  const current = await gitState(worktree)
  check(current)
  const tracking = current.branches.find(item => item.local && item.name === current.branch)
  if (current.upstream !== before.upstream || tracking?.remote !== branch.remote || tracking?.remoteRef !== branch.remoteRef) throw new Error('The upstream changed while fetching. Refresh Git status and try again.')
  const target = (await git(worktree, ['rev-parse', '--verify', '@{upstream}^{commit}'])).trim()
  const output = await git(worktree, ['-c', 'merge.autoStash=false', 'merge', '--ff-only', '--no-autostash', '--no-edit', target], 60000)
  return { state: await gitState(worktree), message: output.trim() || 'Fast-forward pull completed.' }
}
