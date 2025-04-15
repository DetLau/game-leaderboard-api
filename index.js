// index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

app.use(cors());
app.use(express.json());

// Load the leaderboard data from the file, or return an empty array if the file doesn't exist
function loadLeaderboard() {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    try {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading leaderboard file:', err);
      return [];
    }
  }
  return [];
}

// Save the leaderboard data to the file
function saveLeaderboard(data) {
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
}

// Initialize leaderboard from file (or start with an empty array)
let leaderboard = loadLeaderboard();

// POST /leaderboard: Submit a new score
app.post('/leaderboard', (req, res) => {
  const newScore = req.body;

  // Validate that "name" exists and "score" is a number.
  if (!newScore.name || typeof newScore.score !== 'number') {
    return res.status(400).json({ error: 'Invalid score data' });
  }

  // Add the new score to the leaderboard array
  leaderboard.push(newScore);

  // Sort the leaderboard:
  // 1. Highest score first.
  // 2. If scores are equal and timeUsed is provided, the lower timeUsed wins.
  // 3. Otherwise, more recent dates win.
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeUsed && b.timeUsed) return a.timeUsed - b.timeUsed;
    return new Date(b.date) - new Date(a.date);
  });

  // Keep only the top 10 scores
  leaderboard = leaderboard.slice(0, 10);

  // Save the updated leaderboard to file
  saveLeaderboard(leaderboard);

  res.status(201).json({ message: 'Score submitted successfully' });
});

// GET /leaderboard/top10: Retrieve the top 10 leaderboard entries
app.get('/leaderboard/top10', (req, res) => {
  res.json(leaderboard);
});

// DELETE /leaderboard: Clear the leaderboard
app.delete('/leaderboard', (req, res) => {
  leaderboard = [];
  saveLeaderboard(leaderboard);
  res.json({ message: 'Leaderboard cleared' });
});

// Root endpoint to verify that the API is running
app.get('/', (req, res) => {
  res.send('Leaderboard API is running on port ' + PORT);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
