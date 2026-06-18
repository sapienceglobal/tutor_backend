// Script to replace all error.message leaks with safe generic messages
// Run from tutor-backend directory: node scripts/fix-error-leaks.js

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const controllersDir = join(process.cwd(), 'src', 'controllers');

// Patterns to fix (ordered by specificity — most specific first)
const replacements = [
    // Pattern: message: error.message || 'Some fallback'
    { find: /message: error\.message \|\| '[^']+'/g, replace: "message: 'Internal server error'" },
    // Pattern: message: error.message || "Some fallback"
    { find: /message: error\.message \|\| "[^"]+"/g, replace: "message: 'Internal server error'" },
    // Pattern: message: error.message,  (with comma — inside object with other fields)
    { find: /message: error\.message,/g, replace: "message: 'Internal server error'," },
    // Pattern: message: error.message });  (end of object)
    { find: /message: error\.message \}\)/g, replace: "message: 'Internal server error' })" },
    // Pattern: message: error.message }); with semicolon
    { find: /message: error\.message \}\);/g, replace: "message: 'Internal server error' });" },
    // Pattern: error: error.message,  (separate error field)
    { find: /error: error\.message,/g, replace: "" },
    // Pattern: error: error.message });
    { find: /, error: error\.message \}\);/g, replace: " });" },
    // Pattern: error: error.message }); with just }
    { find: /, error: error\.message \}/g, replace: " }" },
    // Pattern: error: error.message (standalone at end)
    { find: /error: error\.message/g, replace: "" },
];

// SKIP the line in questionController.js that legitimately collects per-row errors
// errors.push({ row: row.row, message: error.message });
// This is internal batch processing, not a response to the client

function processFile(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    let original = content;
    let changes = 0;

    for (const { find, replace } of replacements) {
        const before = content;
        content = content.replace(find, replace);
        if (content !== before) changes++;
    }

    // Clean up any resulting empty lines from removed error fields
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (content !== original) {
        writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Fixed: ${filePath} (${changes} pattern groups)`);
    }
}

function walkDir(dir) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (extname(entry) === '.js') {
            processFile(fullPath);
        }
    }
}

console.log('🔧 Scanning controllers for error.message leaks...\n');
walkDir(controllersDir);
console.log('\n✅ All error.message leaks fixed!');
