/**
 * This script assigns admin privileges to a user by setting a custom claim.
 * This is a one-time, manual operation that should only be run by a developer.
 */
const admin = require("firebase-admin");

// Load your secret service account key
const serviceAccount = require("./adminsdk.json");

// --- ACTION REQUIRED: PASTE THE USER'S UID BELOW ---
// You can get this from the Firebase Authentication console.
const uid = "icwiiCBWzmWW5YLT3XHsmCgJIfB2";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Success! User ${uid} has been made an admin.`);
    console.log("They will have admin rights on their next login or after their token refreshes (about 1 hour).");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error setting custom claim:", error);
    process.exit(1);
  });