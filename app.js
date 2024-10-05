require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const OpenAI = require('openai');

const PORT = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple in-memory knowledge base (in a real app, this would be in a database)
const knowledgeBase = [
  "Our company hours are 9 AM to 5 PM, Monday to Friday.",
  "We offer free parking for all visitors.",
  "Appointments can be booked by calling 555-0123 or using our online booking system.",
  "Our address is 123 Business Street, Cityville, State 12345.",
  "We offer a wide range of services including consultations, product demonstrations, and technical support."
];

async function generateAIResponse(question) {
  const prompt = `
  Knowledge Base:
  ${knowledgeBase.join('\n')}

  User Question: ${question}

  Please answer the user's question based on the information in the knowledge base. If the answer isn't in the knowledge base, politely say you don't have that information and offer to connect them with a human representative.

  AI Assistant:`;

  try {
    const response = await openai.completions.create({
      model: "text-davinci-002",
      prompt: prompt,
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0].text.trim();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return "I'm sorry, I'm having trouble processing your request right now. Let me connect you with a human representative who can assist you better.";
  }
}

let adminSocket = null;
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('set role', (role) => {
    if (role === 'admin') {
      adminSocket = socket;
      console.log('Admin connected');
      // Send list of current users to admin
      adminSocket.emit('user list', Array.from(userSockets.keys()));
    } else {
      const userId = 'user_' + Math.random().toString(36).substr(2, 9);
      userSockets.set(userId, socket);
      socket.userId = userId;
      console.log('User connected:', userId);
      socket.emit('user id', userId);
      // Notify admin of new user
      if (adminSocket) {
        adminSocket.emit('new user', userId);
      }
    }
  });

  socket.on('user message', async (data) => {
    console.log('User message:', data);
    const aiResponse = await generateAIResponse(data.message);
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