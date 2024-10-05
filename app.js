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

const users = new Set();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('set username', (username) => {
    if (users.has(username)) {
      socket.emit('username taken');
    } else {
      socket.username = username;
      users.add(username);
      socket.emit('username set', username);
      io.emit('user joined', username);
    }
  });

  socket.on('chat message', (msg) => {
    if (socket.username) {
      console.log('Message received:', msg);
      io.emit('chat message', { user: socket.username, message: msg });
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.username);
      io.emit('user left', socket.username);
    }
    console.log('User disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Error handling for the server
http.on('error', (error) => {
  console.error('Server error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});