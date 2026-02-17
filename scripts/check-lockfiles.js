const fs = require('fs');
const path = require('path');

function checkLockfiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git') continue;

        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            checkLockfiles(fullPath);
        } else {
            if (file === 'package-lock.json') {
                console.error(`Error: Found forbidden lockfile at ${fullPath}`);
                process.exit(1);
            }
            if (file === 'pnpm-lock.yaml' && dir !== process.cwd()) {
                console.error(`Error: Found nested pnpm-lock.yaml at ${fullPath}. Only root lockfile is allowed.`);
                process.exit(1);
            }
        }
    }
}

console.log('Checking for forbidden lockfiles...');
checkLockfiles(process.cwd());
console.log('Lockfile check passed.');
