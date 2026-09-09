const fs = require('fs');

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

// Remove the legacy hard-coded AI Studio/Cloud Run domain troubleshooting modal.
app = app.replace(
  /\n\s*\/\* ── REFERER DOMAIN BLOCKED EXPLANATION MODAL ── \*\/.*?(?=\n\s*\/\* ── REAL-TIME DIRECT MESSAGING DRAWER OVERLAY ── \*\/)/s,
  '\n'
);

// Remove the now-unused modal state.
app = app.replace(
  /\s*const \[showRefererModal, setShowRefererModal\] = useState\(false\);\n\s*const \[refererBlockedDomain, setRefererBlockedDomain\] = useState\(""\);\n/,
  '\n'
);

const genericAuthError = 'triggerToast("❌ Authentication is unavailable for this deployment. Please verify the Firebase domain/API-key configuration.", "error");';

// Remove the old domain-specific modal trigger from login/signup error handling.
app = app.replace(
  /setRefererBlockedDomain\(window\.location\.hostname\);\s*setShowRefererModal\(true\);\s*triggerToast\("⚠️ Domain not authorized in Firebase Console\.", "error"\);/g,
  genericAuthError
);

// Replace the expired-link help action with a deployment-neutral recovery message.
app = app.replace(
  /onClick=\{\(\) => \{\s*setRefererBlockedDomain\(window\.location\.hostname\);\s*setShowRefererModal\(true\);\s*\}\}/g,
  'onClick={() => triggerToast("If the verification link is expired, request a new verification email.", "error")}'
);

const forbiddenLegacyText = [
  'Domain Security Authorization Required',
  'Quick Fix for Users / Testers',
  'official sandbox domain',
  'ais-pre-ugza3g3lajlvapecr5xph7-125820164386.asia-east1.run.app',
  'setShowRefererModal',
  'setRefererBlockedDomain',
];

const leftovers = forbiddenLegacyText.filter((text) => app.includes(text));
if (leftovers.length > 0) {
  throw new Error(`Legacy domain gate cleanup failed. Remaining markers: ${leftovers.join(', ')}`);
}

fs.writeFileSync(appPath, app);
console.log('Removed the sandbox-domain auth detour and applied deployment-neutral Firebase auth error handling.');
