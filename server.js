// server.js
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

let users = [];
let messages = [];

app.post('/api/register', (req, res) => {
  const { username } = req.body;
  users.push(username);
  res.json({ message: 'User registered successfully' });
});

app.post('/api/messages', (req, res) => {
  const { sender, recipient, message } = req.body;
  messages.push({ sender, recipient, message });
  res.json({ message: 'Message sent successfully' });
});

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.listen(5000, () => console.log('Server is running on port 5000'));