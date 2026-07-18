import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './ui/tokens.css';  // Redesign tokens (new namespace: --bg, --text-1, ...)
import './ui/base.css';    // Redesign base — must load LAST (fixes body font + Arial buttons)
import MainRouter from './MainRouter';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MainRouter />
  </React.StrictMode>
);
