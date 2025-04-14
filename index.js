// index.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Load the Firebase service account key from the local file.
// Ensure that 'serviceAccountKey.json' is in the project root.
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin SDK using the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Connect to Firestore
const db = admin.firestore();
console.log('Connected to Firestore with project ID:', serviceAccount.project_id);

// Create an Express app
const app = express();

// Enable CORS so your frontend can make requests
app.use(cors());

// Enable JSON parsing for incoming requests
app.use(express.json());

// Global logging for incoming requests (optional, for debugging)
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Default route to verify the API is running
app.get('/', (req, res) => {
  res.send('Leaderboard API is running');
});

// Temporary test endpoint to verify POST requests
app.post('/test', (req, res) => {
  console.log("POST /test endpoint hit");
  res.send("Test endpoint reached");
});

// POST /leaderboard: Add a new score to the leaderboard
app.post('/leaderboard', async (req, res) => {
  console.log("POST /leaderboard endpoint hit");
  try {
    // Destructure and validate required fields
    const { name, score, timeUsed, allFlipped, date } = req.body;
    if (!name || typeof score !== 'number' || timeUsed === undefined || allFlipped === undefined || !date) {
      console.error("Validation failed. Request body:", req.body);
      return res.status(400).send('Missing required fields');
    }

    // Add the new score to the 'leaderboard' collection with a server timestamp
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
    // Query Firestore to get the top 10 scores, ordered by score (desc) and timestamp (asc)
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
    const query = collectionRef.orderBy('timestamp').limit(500); // Adjust batch size as needed

    // Recursive batch deletion function
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

// Use PORT from environment if set, otherwise default to 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
