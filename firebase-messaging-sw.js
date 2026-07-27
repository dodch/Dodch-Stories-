// Import and configure the Firebase SDK
// This is the BARE MINIMUM required for the service worker to work.
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIlDy8iaEpCHVc6kPij_zh2zHJYQqiShk",
  authDomain: "dodchstories-435bb.firebaseapp.com",
  databaseURL: "https://dodchstories-435bb-default-rtdb.firebaseio.com",
  projectId: "dodchstories-435bb",
  storageBucket: "dodchstories-435bb.firebasestorage.app",
  messagingSenderId: "52323489131",
  appId: "1:52323489131:web:1ac8292a3953032715682e",
  measurementId: "G-7MCXBETRYQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// --- NEW: Add this handler for background notifications ---
// This code will run when a notification is received and the app is in the background.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize the notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon-96x96.png' // Optional: path to an icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});