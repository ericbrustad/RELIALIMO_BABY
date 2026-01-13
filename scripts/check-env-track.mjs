#!/usr/bin/env node
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

try {
  execSync('git ls-files --error-unmatch env.js', { cwd: ROOT, stdio: 'pipe' });
  console.error('❌ env.js is tracked in git. Remove it (git rm --cached env.js) and add to .gitignore');
  process.exit(1);
} catch (err) {
  console.log('✅ env.js is not tracked in git');
  process.exit(0);
}