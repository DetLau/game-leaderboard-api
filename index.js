// index.js
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const express = require('express');

// Load environment variables from mongo.env (located in your project root)
dotenv.config({ path: path.resolve(__dirname, 'mongo.env') });

// Log the PORT value (for debugging)
console.log("PORT from env:", process.env.PORT);

// Ensure the FIREBASE_SERVICE_ACCOUNT variable is set
const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!encodedServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
}

// Decode the base64 string and parse the JSON credentials
let serviceAccountJson;
try {
  serviceAccountJson = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
} catch (err) {
  throw new Error('Error decoding FIREBASE_SERVICE_ACCOUNT: ' + err);
}

let serviceAccount;
try {
  // Optionally, if you suspect extra escape sequences, you can replace literal "\\n" with "\n"
  const fixedJson = serviceAccountJson.replace(/\\n/g, "\n");
  serviceAccount = JSON.parse(fixedJson);
} catch (err) {
  throw new Error('Error parsing decoded FIREBASE_SERVICE_ACCOUNT: ' + err);
}

// Initialize Firebase Admin SDK with the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Connect to Firestore through the Admin SDK
const db = admin.firestore();

// Optional: log the project ID for verification
console.log('Connected to Firestore with project ID:', serviceAccount.project_id);

// Set up the Express app
const app = express();

// Enable CORS to allow external requests (e.g., from your frontend)
app.use(require('cors')());

// Parse JSON request bodies for incoming requests
app.use(express.json());

// Global request logging (for debugging)
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Default route: Check that the API is running and connect to Firestore
app.get('/', async (req, res) => {
  try {
    // A simple read from a test collection to confirm Firestore connectivity
    await db.collection('test').limit(1).get();
    res.send('Firebase Admin initialized and Firestore is accessible!');
  } catch (err) {
    console.error('Error accessing Firestore:', err);
    res.status(500).send('Error connecting to Firestore');
  }
});

// Temporary test endpoint for POST requests
app.post('/test', (req, res) => {
  console.log("POST /test endpoint hit");
  res.send("Test endpoint reached");
});

// (Optional) Add your leaderboard endpoints here...

// Use the PORT from the environment variable (default to 3001 if not set)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
