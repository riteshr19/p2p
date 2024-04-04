// UserList.js
import React, { useEffect, useState } from 'react';

function UserList({ onUserClick }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/users')  // Replace with your actual API endpoint
      .then((response) => response.json())
      .then((data) => setUsers(data.users))  // Replace 'data.users' with the actual path to the user list in the response
      .catch((error) => console.error('Error:', error));
  }, []);

  return (
    <div>
      <h1>Users</h1>
      {users.map((user) => (
        <p key={user.id} onClick={() => onUserClick(user.id)}>{user.username}</p>
      ))}
    </div>
  );
}

export default UserList;