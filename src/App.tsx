import React from 'react';
import logo from './logo.svg';
import { ChatBot_UI } from './components/chatbot_UI/chatbot_UI'; // Add this line to import your chatbot

import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
  <p>
  Welcome to GeoLARP, an immersive geo-located live action role-playing game.<br />
  Explore, interact, and embark on adventures in a world where your physical location shapes your gaming experience.<br />
  Get ready to step into a realm where fantasy and reality merge! <br />
  Edit <code>src/App.tsx</code> and save to reload.
  </p>
<ChatBot_UI />  

      </header>
    </div>
  );
}

export default App;
