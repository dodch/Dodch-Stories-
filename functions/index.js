const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

/**
 * ONE-TIME USE: Run this function once to make yourself an admin.
 * Your UID has been added below.
 */
exports.makeAdmin = functions.https.onRequest(async (req, res) => {
  // Your UID is pasted here:
  const uid = "icwiiCBWzmWW5YLT3XHsmCgJIfB2"; 
  
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    res.send(`Success! User ${uid} is now an admin. You can now follow the final security step.`);
  } catch (error) {
    console.error("Error setting custom claim:", error);
    res.status(500).send("Error setting custom claim. Check the function logs in your Firebase console.");
  }
});
