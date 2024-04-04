// App.js
import React, { useState } from 'react';
import Chat from './Chat';
import UserList from './UserList';
import Registration from './Registration';

function App() {
  const [username, setUsername] = useState('');
  const [recipient, setRecipient] = useState('');

  const handleRegister = (username) => {
    setUsername(username);

    // Send the username to the server
    fetch('http://localhost:5000/api/register', {  // Replace with your actual API endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    })
    .then(response => response.json())
    .then(data => console.log(data))  // Log the response for now
    .catch((error) => console.error('Error:', error));
  };

  return (
    <div>
      {username ? (
        <>
          {recipient ? (
            <Chat username={username} recipient={recipient} />
          ) : (
            <UserList onUserClick={setRecipient} />
          )}
        </>
      ) : (
        <Registration onRegister={handleRegister} />
      )}
    </div>
  );
}

export default App;