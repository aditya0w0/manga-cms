// scripts/patch-pglite.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', '@electric-sql', 'pglite', 'dist', 'node-postgres');

['index.js', 'index.cjs'].forEach((filename) => {
  const targetFile = path.join(dir, filename);
  if (fs.existsSync(targetFile)) {
    let code = fs.readFileSync(targetFile, 'utf-8');
    if (!code.includes('Array.isArray($1.types)') && !code.includes('Array.isArray(e.types)')) {
      code = code.replace(
        /parse\((\w+)\)\{/g,
        'parse($1){if($1&&$1.types&&!Array.isArray($1.types)){$1.types=Array.isArray($1.types)?$1.types:[];}'
      );
      fs.writeFileSync(targetFile, code);
      console.log(`[postinstall] Successfully patched ${filename}`);
    }
  }
});
