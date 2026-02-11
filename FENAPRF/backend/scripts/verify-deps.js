// scripts/verify-deps.js
const fs = require('fs');
const path = require('path');

console.log('--- Verifying Dependencies ---');
console.log('Current Working Directory:', process.cwd());

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('Loaded package.json name:', pkg.name);
  console.log('Loaded package.json version:', pkg.version);
} else {
  console.error('ERROR: package.json not found at', packageJsonPath);
  process.exit(1);
}

async function checkResend() {
  console.log('Checking for "resend" package...');
  try {
    // We use dynamic import to support ESM-only packages if necessary,
    // and because email.service.js uses it.
    await import('resend');
    console.log('SUCCESS: "resend" package is resolvable.');
  } catch (err) {
    console.error('ERROR: "resend" package NOT found or failed to load.');
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    if (err.stack) console.error('Stack:', err.stack);
    process.exit(1);
  }
}

checkResend().then(() => {
    console.log('--- Verification Complete ---');
    process.exit(0);
}).catch(err => {
    console.error('Unexpected error during verification:', err);
    process.exit(1);
});
