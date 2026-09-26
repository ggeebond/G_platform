import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

document.title = 'Soul Lab · 科研想法养成系统';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
