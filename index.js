// index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config({ path: './mongo.env' }); // Load environment variables from mongo.env

const app = express();
const port = process.env.PORT || 3001;

console.log("Index.js is running!");

// Ensure that the FIREBASE_SERVICE_ACCOUNT environment variable exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not defined in your environment");
  process.exit(1);
}

// Decode the base64-encoded service account JSON from the environment variable
const decodedServiceAccount = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');

let serviceAccount;
try {
  serviceAccount = JSON.parse(decodedServiceAccount);
} catch (err) {
  console.error("Error parsing decoded FIREBASE_SERVICE_ACCOUNT:", err);
  process.exit(1);
}

// Initialize Firebase Admin SDK with the decoded credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Global request logger for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Root endpoint to confirm the API is running
app.get('/', (req, res) => {
  res.send(`Leaderboard API is running on port ${port}`);
});

// Temporary Test Endpoint (for POST debugging)
app.post('/test', (req, res) => {
  console.log("POST /test endpoint hit");
  res.send("Test endpoint reached");
});

// POST /leaderboard: Add a new score to the leaderboard (Firestore)
app.post('/leaderboard', async (req, res) => {
  console.log("POST /leaderboard endpoint hit");
  try {
    // Destructure and validate required fields from the request body
    const { name, score, timeUsed, allFlipped, date } = req.body;
    if (!name || typeof score !== 'number' || timeUsed === undefined || allFlipped === undefined || !date) {
      console.error("Validation failed. Request body:", req.body);
      return res.status(400).send('Missing required fields');
    }
    // Add the new score as a document in the 'leaderboard' collection, including a server timestamp
    const docRef = await db.collection('leaderboard').add({
      name,
      score,
      timeUsed,
      allFlipped,
      date,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Added document with ID:', docRef.id);
    res.status(201).send(`Score added successfully with ID: ${docRef.id}`);
  } catch (error) {
    console.error('Error adding score:', error);
    res.status(500).send('Error adding score');
  }
});

// GET /leaderboard/top10: Retrieve the top 10 leaderboard entries from Firestore
app.get('/leaderboard/top10', async (req, res) => {
  try {
    const snapshot = await db.collection('leaderboard')
      .orderBy('score', 'desc')
      .orderBy('timestamp', 'asc')
      .limit(10)
      .get();
    const scores = [];
    snapshot.forEach(doc => {
      scores.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(scores);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).send('Error fetching leaderboard');
  }
});

// DELETE /leaderboard: Clear the leaderboard in Firestore
app.delete('/leaderboard', async (req, res) => {
  try {
    const collectionRef = db.collection('leaderboard');
    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
      return res.status(200).send("No leaderboard entries found");
    }
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    res.status(204).send("Leaderboard cleared successfully");
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    res.status(500).send('Error clearing leaderboard');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
