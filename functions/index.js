/**
 * Import function triggers from their respective submodules:
 *
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Use the v1 SDK for callable functions as intended in the frontend code
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * A callable cloud function that subscribes a given FCM token to a specific topic.
 * This is the secure, server-side way to manage topic subscriptions.
 */
exports.subscribeToTopic = functions.https.onCall(async (data, context) => {
  const { token, topic } = data;

  if (!token || !topic) {
    throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'token' and 'topic' arguments.");
  }

  try {
    await admin.messaging().subscribeToTopic(token, topic);
    console.log(`Successfully subscribed token to topic: ${topic}`);
    return { result: `Successfully subscribed to ${topic}` };
  } catch (error) {
    console.error(`Error subscribing to topic:`, error);
    throw new functions.https.HttpsError("internal", "An error occurred while subscribing to the topic.");
  }
});
