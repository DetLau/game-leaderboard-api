// index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your frontend can make requests
app.use(cors());
// Enable JSON parsing for incoming requests
app.use(express.json());

// In-memory leaderboard storage (for production, use a database)
let leaderboard = [];

// POST endpoint: Submit a new score
app.post('/leaderboard', (req, res) => {
  const newScore = req.body;

  // Validate: name must exist and score must be a number
  if (!newScore.name || typeof newScore.score !== 'number') {
    return res.status(400).json({ error: 'Invalid score data' });
  }

  // Add score to leaderboard
  leaderboard.push(newScore);

  // Sort the leaderboard:
  // 1. Higher score comes first
  // 2. If scores are equal, lower timeUsed wins (if provided)
  // 3. Otherwise, newer submissions come first
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeUsed && b.timeUsed) return a.timeUsed - b.timeUsed;
    return new Date(b.date) - new Date(a.date);
  });

  // Keep only the top 10 scores
  leaderboard = leaderboard.slice(0, 10);

  res.status(201).json({ message: 'Score submitted successfully' });
});

// GET endpoint: Retrieve the top 10 leaderboard entries
app.get('/leaderboard/top10', (req, res) => {
  res.json(leaderboard);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
