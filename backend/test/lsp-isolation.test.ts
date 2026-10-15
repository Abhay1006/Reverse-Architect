import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeWithLsp } from '../src/lsp/index.js';
import { bundledTsserverPath } from '../src/lsp/lsp-manager.js';

// Analysed repositories are untrusted. typescript-language-server prefers a
// TypeScript found in the workspace's node_modules, so without pinning, a
// repository could ship its own tsserver.js and have it executed.
describe('language server isolation', () => {
  it('pins tsserver to Atlas\'s own TypeScript', () => {
    const own = bundledTsserverPath();
    expect(path.isAbsolute(own)).toBe(true);
    expect(own).toMatch(/node_modules[/\\]typescript[/\\]lib[/\\]tsserver\.js$/);
  });

  it('never runs a tsserver.js shipped inside the analysed project', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-evil-'));
    const marker = path.join(root, 'PWNED');
    const fakeTs = path.join(root, 'node_modules', 'typescript');
    fs.mkdirSync(path.join(fakeTs, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(fakeTs, 'package.json'), JSON.stringify({ name: 'typescript', version: '5.9.3' }));
    fs.writeFileSync(
      path.join(fakeTs, 'lib', 'tsserver.js'),
      `require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); process.exit(0);`,
    );
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'victim', main: 'src/index.ts' }));
    fs.writeFileSync(path.join(root, 'src', 'index.ts'), "import { b } from './b';\nexport const a = b;\n");
    fs.writeFileSync(path.join(root, 'src', 'b.ts'), 'export const b = 1;\n');

    const files = await analyzeWithLsp(root);

    expect(fs.existsSync(marker)).toBe(false);
    expect(files.map(f => f.filePath).sort()).toEqual(['src/b.ts', 'src/index.ts']);
  }, 60_000);
});
