// Registration.js
import React, { useState } from 'react';

function Registration({ onRegister }) {
  const [username, setUsername] = useState('');

  const handleRegister = (event) => {
    event.preventDefault();
    onRegister(username);
    setUsername('');
  };

  return (
    <form onSubmit={handleRegister}>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter username"
      />
      <button type="submit">Register</button>
    </form>
  );
}

export default Registration;