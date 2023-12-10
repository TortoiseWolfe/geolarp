import React from 'react';
import logo from './logo.svg';
import { ChatBot_UI } from './components/chatbot_UI/chatbot_UI'; // Add this line to import your chatbot

import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          geoLARP.com
        </a>

<ChatBot_UI />  

      </header>
    </div>
  );
}

export default App;
