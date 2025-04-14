// index.js
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const express = require('express');

// Load environment variables from mongo.env (located in your project root)
dotenv.config({ path: path.resolve(__dirname, 'mongo.env') });

// Log the PORT from env for debugging
console.log("PORT from env:", process.env.PORT);

// Get the FIREBASE_SERVICE_ACCOUNT environment variable (base64-encoded)
const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!encodedServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
}

let serviceAccountJson;
try {
  // Decode the base64-encoded string
  serviceAccountJson = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
} catch (err) {
  throw new Error('Error decoding FIREBASE_SERVICE_ACCOUNT: ' + err);
}

// Sometimes the decoding results in literal "\n" that needs to be converted to actual newline characters.
const fixedServiceAccountJson = serviceAccountJson.replace(/\\n/g, "\n");

let serviceAccount;
try {
  serviceAccount = JSON.parse(fixedServiceAccountJson);
} catch (err) {
  throw new Error('Error parsing decoded FIREBASE_SERVICE_ACCOUNT: ' + err);
}

// Initialize Firebase Admin SDK with the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Connect to Firestore
const db = admin.firestore();
console.log('Connected to Firestore with project ID:', serviceAccount.project_id);

// Set up an Express application
const app = express();
app.use(require('cors')());
app.use(express.json());

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Default endpoint: Check Firestore connectivity
app.get('/', async (req, res) => {
  try {
    await db.collection('test').limit(1).get();
    res.send('Firebase Admin initialized and Firestore is accessible!');
  } catch (err) {
    console.error('Error accessing Firestore:', err);
    res.status(500).send('Error connecting to Firestore');
  }
});

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
