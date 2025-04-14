// index.js
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const express = require('express');

// Load environment variables from mongo.env (located in the project root)
dotenv.config({ path: path.resolve(__dirname, 'mongo.env') });

// Log the port from the environment (for debugging)
console.log("PORT from env:", process.env.PORT);

// Retrieve the base64‑encoded service account JSON from your environment variables
const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!encodedServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
}

// Decode the base64 string to get the raw JSON string
let serviceAccountJson;
try {
  serviceAccountJson = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
} catch (err) {
  throw new Error('Error decoding FIREBASE_SERVICE_ACCOUNT: ' + err);
}

// Replace literal escaped newline sequences ("\\n") with actual newline characters ("\n")
const fixedServiceAccountJson = serviceAccountJson.replace(/\\n/g, "\n");

// Parse the JSON credentials
let serviceAccount;
try {
  serviceAccount = JSON.parse(fixedServiceAccountJson);
} catch (err) {
  throw new Error('Error parsing decoded FIREBASE_SERVICE_ACCOUNT: ' + err);
}

// Initialize the Firebase Admin SDK using the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Connect to Firestore using the Admin SDK
const db = admin.firestore();
console.log('Connected to Firestore with project ID:', serviceAccount.project_id);

// Set up an Express application
const app = express();

// Enable CORS (allowing requests from any origin)
app.use(require('cors')());

// Parse JSON request bodies
app.use(express.json());

// Global request logging (for debugging purposes)
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Default route: Confirm that the API is running and Firestore is accessible
app.get('/', async (req, res) => {
  try {
    // Optional: perform a simple read from a 'test' collection
    await db.collection('test').limit(1).get();
    res.send('Firebase Admin initialized and Firestore is accessible!');
  } catch (err) {
    console.error('Error accessing Firestore:', err);
    res.status(500).send('Error connecting to Firestore');
  }
});

// Temporary test endpoint (for debugging POST requests)
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

    // Add the new score as a document in the 'leaderboard' collection with a server timestamp
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

    // Recursive function to delete documents in batches
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

// Start the server on PORT (from env or default to 3001)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
