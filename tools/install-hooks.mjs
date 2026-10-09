import { spawnSync } from 'node:child_process';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = dirname(dirname(fileURLToPath(import.meta.url)));
const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const repository = git(['rev-parse', '--show-toplevel']);
if (repository.error) throw repository.error;
if (repository.status !== 0 || relative(cwd, repository.stdout.trim()) !== '') {
  console.log('Git hooks were not installed: this directory is not a Git checkout.');
} else {
  const existing = git(['config', '--get', 'core.hooksPath']);
  if (existing.status !== 0 && existing.status !== 1) throw new Error(existing.stderr || 'Cannot read Git hook configuration.');
  if (existing.stdout.trim() && existing.stdout.trim() !== '.githooks') throw new Error(`Existing core.hooksPath (${existing.stdout.trim()}) needs to be reconciled before installing .githooks.`);
  const result = git(['config', '--local', 'core.hooksPath', '.githooks']);
  if (result.status !== 0) throw new Error(result.stderr || 'Cannot install Git hooks.');
  console.log('Installed the pre-commit lint hook.');
}
