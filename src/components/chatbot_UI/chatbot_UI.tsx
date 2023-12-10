import React, { useState, KeyboardEvent } from 'react';
import styles from './ChatBot_UI.module.css';
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

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { // Prevents Enter from creating a new line
      event.preventDefault(); // Stops the default behavior of Enter key in a textarea
      sendMessage(event.currentTarget.value);
      event.currentTarget.value = ''; // Clear the textarea after sending
    }
  };

  return (
    <div className="chatbot-ui">
<h3>GeoLARP</h3>
<p>
  an immersive geo-located live action role-playing game.<br />
  Explore, interact, and embark on adventures in a world<br />
   where your physical location shapes your gaming experience.<br />
  Get ready to step into a realm where fantasy and reality merge! <br />
  Edit <code>src/App.tsx</code> and save to reload.
  </p>

      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            {message.text}
          </div>
        ))}
      </div>
      <textarea
  className={styles.textInput}
  placeholder="Type a message..."
  onKeyPress={handleKeyPress}
/>
    </div>
  );
};

export { ChatBot_UI };
