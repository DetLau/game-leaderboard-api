// index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config(); // Load environment variables from .env

const app = express();
const port = process.env.PORT || 3000;

// Log that the file is running
console.log("Index.js is running!");

// Initialize Firebase Admin SDK
// Ensure your 'serviceAccountKey.json' is in the project root and is added to .gitignore.
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

// Enable CORS so your frontend can make requests
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Default route to confirm that the API is running
app.get('/', (req, res) => {
  res.send('Leaderboard API is running');
});

// Temporary Test Endpoint (for debugging POST requests)
app.post('/test', (req, res) => {
  console.log("POST /test endpoint hit");
  res.send("Test endpoint reached");
});

// POST /leaderboard: Add a new score to the leaderboard
app.post('/leaderboard', async (req, res) => {
  console.log("POST /leaderboard endpoint hit"); // Debug log
  try {
    const { name, score, timeUsed, allFlipped, date } = req.body;
    if (!name || typeof score !== 'number' || timeUsed === undefined || allFlipped === undefined || !date) {
      console.error("Validation failed. Request body:", req.body);
      return res.status(400).send('Missing required fields');
    }

    // Add the new score as a document in the 'leaderboard' collection with a server timestamp
    const docRef = await db.collection('leaderboard').add({
      name,
      score,
      timeUsed,
      allFlipped,
      date,
      timestamp: admin.firestore.FieldValue.serverTimestamp() // For secondary sorting
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
      scores.push({
        id: doc.id,
        ...doc.data()
      });
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
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`Deleted ${snapshot.size} documents`);
      process.nextTick(() => {
        deleteQueryBatch(query, resolve);
      });
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
