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

/**
 * Compare two score entries.
 * Returns true if newScore is better than oldScore.
 */
function isBetterScore(newScore, oldScore) {
  // 1. Compare by score (higher is better)
  if (newScore.score > oldScore.score) {
    return true;
  } else if (newScore.score < oldScore.score) {
    return false;
  }
  // 2. If scores are equal and both have timeUsed, lower timeUsed wins.
  if (newScore.timeUsed != null && oldScore.timeUsed != null) {
    if (newScore.timeUsed < oldScore.timeUsed) {
      return true;
    } else if (newScore.timeUsed > oldScore.timeUsed) {
      return false;
    }
  }
  // 3. Otherwise, the entry with the more recent date is better.
  if (new Date(newScore.date) > new Date(oldScore.date)) {
    return true;
  }
  return false;
}

// POST /leaderboard: Submit a new score
app.post('/leaderboard', (req, res) => {
  const newScore = req.body;

  // Validate that "name" exists and "score" is a number.
  if (!newScore.name || typeof newScore.score !== 'number') {
    return res.status(400).json({ error: 'Invalid score data' });
  }

  // Check if there is already an entry with the same name.
  const index = leaderboard.findIndex(entry => entry.name === newScore.name);
  if (index !== -1) {
    // A duplicate exists; update only if the new score is better.
    if (isBetterScore(newScore, leaderboard[index])) {
      leaderboard[index] = newScore;
    } else {
      return res.status(400).json({ error: 'New score is not better than the existing one' });
    }
  } else {
    // No duplicate: add the new score.
    leaderboard.push(newScore);
  }

  // Sort the leaderboard:
  // 1. Highest score first.
  // 2. If scores are equal and timeUsed is provided, lower timeUsed wins.
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
