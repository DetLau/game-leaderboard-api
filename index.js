// index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config({ path: './mongo.env' }); // Load environment variables from mongo.env

const app = express();
const port = process.env.PORT || 3001;

console.log("Index.js is running!");

// Verify that FIREBASE_SERVICE_ACCOUNT exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not defined in your environment");
  process.exit(1);
}

// Replace all escaped newline sequences (“\\n”) with actual newline characters
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
const fixedServiceAccount = rawServiceAccount.replace(/\\n/g, '\n');

// Parse the fixed JSON string to get the service account object
let serviceAccount;
try {
  serviceAccount = JSON.parse(fixedServiceAccount);
} catch (err) {
  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT:", err);
  process.exit(1);
}

// Initialize Firebase Admin SDK using the parsed credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

// Enable CORS for external requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Global request logger for debugging purposes
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Default route to verify that the API is running
app.get('/', (req, res) => {
  res.send(`Leaderboard API is running on port ${port}`);
});

// Temporary Test Endpoint (for debugging POST requests)
app.post('/test', (req, res) => {
  console.log("POST /test endpoint hit");
  res.send("Test endpoint reached");
});

// POST /leaderboard: Add a new score to the leaderboard
app.post('/leaderboard', async (req, res) => {
  console.log("POST /leaderboard endpoint hit");
  try {
    const { name, score, timeUsed, allFlipped, date } = req.body;
    if (!name || typeof score !== 'number' || timeUsed === undefined || allFlipped === undefined || !date) {
      console.error("Validation failed. Request body:", req.body);
      return res.status(400).send('Missing required fields');
    }
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

// GET /leaderboard/top10: Retrieve the top 10 leaderboard entries
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

// DELETE /leaderboard: Clear the leaderboard using batch deletion
app.delete('/leaderboard', async (req, res) => {
  try {
    const collectionRef = db.collection('leaderboard');
    const query = collectionRef.orderBy('timestamp').limit(500);
    async function deleteQueryBatch(query, resolve) {
      const snapshot = await query.get();
      if (snapshot.size === 0) {
        resolve();
        return;
      }
      const batch = db.batch();
      snapshot.docs.forEach(doc => { batch.delete(doc.ref); });
      await batch.commit();
      console.log(`Deleted ${snapshot.size} documents`);
      process.nextTick(() => { deleteQueryBatch(query, resolve); });
    }
    await new Promise((resolve, reject) => {
      deleteQueryBatch(query, resolve).catch(reject);
    });
    res.status(204).send('Leaderboard cleared successfully');
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    res.status(500).send('Error clearing leaderboard');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
