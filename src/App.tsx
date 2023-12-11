import React from 'react';
import logo from './logo.svg';
import {Helmet} from "react-helmet";
import { ChatBot_UI } from './components/chatbot_UI/chatbot_UI'; // Add this line to import your chatbot

import './App.css';

function App() {
  return (
    <div className="App">
            {/* Include the Head component with your meta tags here */}
            <Helmet>
        <title>geoLARP</title>
        <meta property='og:title' content='geoLARP' />
<meta property='og:image' content='https://github.com/TortoiseWolfe/geolarp/blob/main/src/images/global_Map.png' />
<meta property='og:image:width' content='1200' />
<meta property='og:image:height' content='630' />

<meta property='og:description' content='Immerse yourself in a geo-located live action role-playing game where your physical location shapes the adventure. Explore and interact in a realm where fantasy and reality merge.' />
<meta property='og:url' content='https://geolarp.com' />
<meta property='og:type' content='website' />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@geoLARP" />
<meta name="twitter:title" content="geoLARP" />
<meta name="twitter:description" content="Immerse yourself in a geo-located live action role-playing game where your physical location shapes the adventure. Explore and interact in a realm where fantasy and reality merge." />
<meta name="twitter:image" content="https://github.com/TortoiseWolfe/geolarp/blob/main/src/images/global_Map.png" />
<meta name="viewport" content="initial-scale=1.0, width=device-width" />
<meta name="description" content="Immerse yourself in a geo-located live action role-playing game where your physical location shapes the adventure. Explore and interact in a realm where fantasy and reality merge." />


        
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta name="description" content="Immerse yourself in a geo-located live action role-playing game where your physical location shapes the adventure. Explore and interact in a realm where fantasy and reality merge, offering a unique gaming experience." />
        {/* Add other meta tags as needed */}
      </Helmet>
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
