const fs = require('fs');

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

// Remove the legacy hard-coded AI Studio/Cloud Run domain troubleshooting modal.
app = app.replace(
  /\n\s*\/\* ── REFERER DOMAIN BLOCKED EXPLANATION MODAL ── \*\/.*?(?=\n\s*\/\* ── REAL-TIME DIRECT MESSAGING DRAWER OVERLAY ── \*\/)/s,
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

fs.writeFileSync(appPath, app);
console.log('Removed the sandbox-domain auth detour and applied deployment-neutral Firebase auth error handling.');
