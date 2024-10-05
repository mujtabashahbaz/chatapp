const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple in-memory knowledge base
const knowledgeBase = [
  { question: "What are your opening hours?", answer: "We are open from 9 AM to 5 PM, Monday to Friday." },
  { question: "Do you offer parking?", answer: "Yes, we have free parking available for all visitors." },
  { question: "How do I book an appointment?", answer: "You can book an appointment by calling our reception at 555-0123 or using our online booking system." }
];

// Simple AI function to find the best matching answer
function findAnswer(question) {
  const bestMatch = knowledgeBase.reduce((best, current) => {
    const similarity = stringSimilarity(question.toLowerCase(), current.question.toLowerCase());
    return similarity > best.similarity ? { similarity, answer: current.answer } : best;
  }, { similarity: 0, answer: null });

  return bestMatch.similarity > 0.6 ? bestMatch.answer : "I'm sorry, I don't have enough information to answer that question. Let me connect you with an admin who can help you better.";
}

// Simple string similarity function (you might want to use a more sophisticated one)
function stringSimilarity(str1, str2) {
  const len = Math.max(str1.length, str2.length);
  return (len - levenshteinDistance(str1, str2)) / len;
}

function levenshteinDistance(str1, str2) {
  const m = str1.length, n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i-1][j-1] + (str1[i-1] !== str2[j-1]),
        dp[i-1][j] + 1,
        dp[i][j-1] + 1
      );
    }
  }
  return dp[m][n];
}

const adminSocket = null;
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('set role', (role) => {
    if (role === 'admin') {
      adminSocket = socket;
      console.log('Admin connected');
    } else {
      const userId = 'user_' + Math.random().toString(36).substr(2, 9);
      userSockets.set(userId, socket);
      socket.userId = userId;
      console.log('User connected:', userId);
      socket.emit('user id', userId);
    }
  });

  socket.on('user message', (data) => {
    console.log('User message:', data);
    const aiResponse = findAnswer(data.message);
    socket.emit('ai response', { message: aiResponse });
    if (adminSocket) {
      adminSocket.emit('user message', { userId: data.userId, message: data.message });
    }
  });

  socket.on('admin message', (data) => {
    console.log('Admin message:', data);
    const userSocket = userSockets.get(data.userId);
    if (userSocket) {
      userSocket.emit('admin response', { message: data.message });
    }
  });

  socket.on('disconnect', () => {
    if (socket === adminSocket) {
      adminSocket = null;
      console.log('Admin disconnected');
    } else if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log('User disconnected:', socket.userId);
      if (adminSocket) {
        adminSocket.emit('user disconnected', { userId: socket.userId });
      }
    }
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});