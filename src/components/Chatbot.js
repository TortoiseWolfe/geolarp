import React, { useState } from 'react';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);

  const sendMessage = (message) => {
    // Function to send message to the chatbot service or backend
    // For now, we'll just add it to the messages array
    setMessages(prevMessages => [...prevMessages, message]);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      sendMessage(event.target.value);
      event.target.value = ''; // Clear the input field
    }
  };

  return (
    <div className="chatbot">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className="message">
            {message}
          </div>
        ))}
      </div>
      <input type="text" onKeyPress={handleKeyPress} />
    </div>
  );
};

export default Chatbot;
