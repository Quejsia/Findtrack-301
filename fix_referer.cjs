const fs = require('fs');

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

// Remove the legacy hard-coded AI Studio/Cloud Run domain troubleshooting modal.
app = app.replace(
  /\n\s*\/\* ── REFERER DOMAIN BLOCKED EXPLANATION MODAL ── \*\/.*?(?=\n\s*\/\* ── REAL-TIME DIRECT MESSAGING DRAWER OVERLAY ── \*\/)/s,
  '\n'
);

// Replace the old domain-specific help action with a deployment-neutral message.
app = app.replace(
  /onClick=\{\(\) => \{\s*setRefererBlockedDomain\(window\.location\.hostname\);\s*setShowRefererModal\(true\);\s*\}\}/g,
  'onClick={() => triggerToast("If the verification link is expired, request a new verification email.", "error")}'
);

// Make the login error path deployment-neutral. Do not redirect users to a sandbox domain.
app = app.replace(
  /if \(\s*err\.message\?\.includes\("requests-from-referer"\) \|\|\s*err\.code\?\.includes\("requests-from-referer"\)\s*\) \{\s*setRefererBlockedDomain\(window\.location\.hostname\);\s*setShowRefererModal\(true\);\s*triggerToast\("⚠️ Domain not authorized in Firebase Console\."\s*, "error"\);\s*\} else if \(/s,
  'if (err.message?.includes("requests-from-referer") || err.code?.includes("requests-from-referer")) {\n        triggerToast("❌ Authentication is unavailable for this deployment. Please verify the Firebase domain/API-key configuration.", "error");\n      } else if ('
);

// Apply the same neutral handling to signup.
app = app.replace(
  /\} else if \(\s*err\.message\?\.includes\("requests-from-referer"\) \|\|\s*err\.code\?\.includes\("requests-from-referer"\)\s*\) \{\s*setRefererBlockedDomain\(window\.location\.hostname\);\s*setShowRefererModal\(true\);\s*triggerToast\("⚠️ Domain not authorized in Firebase Console\."\s*, "error"\);\s*\} else \{/s,
  '} else if (err.message?.includes("requests-from-referer") || err.code?.includes("requests-from-referer")) {\n        triggerToast("❌ Authentication is unavailable for this deployment. Please verify the Firebase domain/API-key configuration.", "error");\n      } else {'
);

fs.writeFileSync(appPath, app);
console.log('Applied deployment-neutral Firebase auth error handling to src/App.tsx');
