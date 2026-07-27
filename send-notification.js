// 1. Import the Firebase Admin library
const admin = require("firebase-admin");

// 2. Load your secret service account key
// !!! IMPORTANT: Replace "your-key-file-name.json" with the actual name of the key file you downloaded!
const serviceAccount = require("./adminsdk.json"); // <-- CHANGE THIS LINE

// 3. Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4. Define the topic you want to send to.
const topic = 'new_stories';

// 5. Define the message payload for the topic
const message = {
  notification: {
    title: 'A New Story is Available!',
    body: 'Check out the latest from Dodch Stories right now.'
  },
  webpush: {
    fcm_options: {
      // This is the URL that will open when the user clicks the notification
      link: 'https://dodchstories.com' // You can change this to your actual website URL
    }
  },
  topic: topic
};

// 6. Send the message
admin.messaging().send(message)
  .then((response) => {
    // Response is a message ID string.
    console.log('Successfully sent message:', response);
  })
  .catch((error) => {
    console.log('Error sending message:', error);
  });
