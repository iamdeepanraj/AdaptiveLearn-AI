import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve('src');
const PALETTE_REGEX = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const TEXT_COLOR_REGEX = /\btext-(white|black)\b/g;

function isApprovedTextWhiteOrBlack(line) {
  return (
    line.includes('bg-primary') ||
    line.includes('bg-indigo-600') ||
    line.includes('bg-success') ||
    line.includes('bg-warning') ||
    line.includes('bg-danger') ||
    line.includes('var(--hero-from)') ||
    line.includes("role === 'user'") ||
    line.includes('border-white') ||
    line.includes('bg-white/10') ||
    line.includes('bg-white/15') ||
    line.includes('bg-white/20') ||
    line.includes('text-white/') ||
    line.includes('m.role ===')
  );
}

function scanDir(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = scanDir(SRC_DIR);
let errorsCount = 0;

console.log(`Checking ${files.length} TypeScript source files for colour policy compliance...`);

for (const file of files) {
  const relativePath = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check for Tailwind palette colors (slate-*, indigo-*, etc.)
    const paletteMatches = line.match(PALETTE_REGEX);
    if (paletteMatches) {
      paletteMatches.forEach((match) => {
        console.error(`❌ [${relativePath}:${lineNum}] Hard-coded Tailwind palette class: "${match}"`);
        errorsCount++;
      });
    }

    // Check for hex color literals
    const hexMatches = line.match(HEX_REGEX);
    if (hexMatches) {
      hexMatches.forEach((match) => {
        console.error(`❌ [${relativePath}:${lineNum}] Hard-coded hex color: "${match}"`);
        errorsCount++;
      });
    }

    // Check for text-white/text-black outside approved list
    const textMatches = line.match(TEXT_COLOR_REGEX);
    if (textMatches && !isApprovedTextWhiteOrBlack(line)) {
      textMatches.forEach((match) => {
        console.error(`❌ [${relativePath}:${lineNum}] Unapproved "${match}" outside approved elements`);
        errorsCount++;
      });
    }
  });
}

if (errorsCount > 0) {
  console.error(`\n❌ Colour lint failed with ${errorsCount} violation(s).`);
  process.exit(1);
} else {
  console.log('✅ All source files pass colour token policy! No hardcoded palette colors or unapproved literals.');
}
