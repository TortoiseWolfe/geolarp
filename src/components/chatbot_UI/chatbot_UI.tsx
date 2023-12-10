import React, { useState, KeyboardEvent } from 'react';

interface Message {
  id: number;
  text: string;
}

const ChatBot_UI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = (newMessage: string) => {
    const messageObj = {
      id: messages.length + 1, // simple unique identifier for each message
      text: newMessage,
    };
    setMessages(prevMessages => [...prevMessages, messageObj]);
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.currentTarget.value.trim()) {
      sendMessage(event.currentTarget.value);
      event.currentTarget.value = ''; // clear the input after sending
    }
  };

  return (
    <div className="chatbot-ui">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            {message.text}
          </div>
        ))}
      </div>
      <input type="text" onKeyPress={handleKeyPress} placeholder="Type a message..." />
    </div>
  );
};

export { ChatBot_UI };
