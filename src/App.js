import Chatbot from './components/Chatbot';
import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

        <p>
  Welcome to GeoLARP, an immersive geo-located live action role-playing game.<br />
  Explore, interact, and embark on adventures in a world where your physical location shapes your gaming experience.<br />
  Get ready to step into a realm where fantasy and reality merge!
      </p>
      <Chatbot />
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>

    </div>
  );
}

export default App;
