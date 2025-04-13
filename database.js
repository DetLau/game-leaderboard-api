// database.js
require('dotenv').config({ path: './mongo.env' }); // Load environment variables from .env file
const { MongoClient, ServerApiVersion } = require('mongodb');

// Read the connection URI from environment variables
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not defined in your .env file");
  process.exit(1);
}

// Create a MongoClient with options for stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  } finally {
    // Ensure that the client will close even if there's an error
    await client.close();
  }
}

run().catch(console.dir);
