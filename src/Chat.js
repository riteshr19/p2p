// Chat.js
import React, { useState } from 'react';

function Chat({ username, recipient }) {
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    console.log(`Sending message: "${message}" from user: "${username}" to recipient: "${recipient}"`);

    // Send the message to the server
    fetch('http://localhost:5000/api/messages', {  // Replace with your actual API endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sender: username, recipient, message }),
    })
    .then(response => response.json())
    .then(data => console.log(data))  // Log the response for now
    .catch((error) => console.error('Error:', error));

    setMessage('');
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write message..."
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}

export default Chat;