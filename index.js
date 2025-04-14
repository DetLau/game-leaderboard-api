// index.js
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const express = require('express');

// Load environment variables from mongo.env (if present)
dotenv.config({ path: path.resolve(__dirname, 'mongo.env') });

// Ensure the FIREBASE_SERVICE_ACCOUNT variable is set
const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!encodedServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
}

// Decode the base64 string and parse the JSON credentials
const serviceAccountJson = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Initialize Firebase Admin SDK with the service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
// Now Admin SDK is initialized. Connect to Firestore:
const db = admin.firestore();

// (Optional) Verify Firestore connection by making a simple request or printing project ID
console.log('Connected to Firestore with project ID:', serviceAccount.project_id);

// Set up an Express app (or any HTTP framework) to use Firestore
const app = express();
// Example route (not required, but for demonstration)
app.get('/', async (req, res) => {
  try {
    // Just a simple test read (optional)
    await db.collection('test').limit(1).get();
    res.send('Firebase Admin initialized and Firestore is accessible!');
  } catch (err) {
    console.error('Error accessing Firestore:', err);
    res.status(500).send('Error connecting to Firestore');
  }
});

// Use PORT from env if available (Render provides it), otherwise default to 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
