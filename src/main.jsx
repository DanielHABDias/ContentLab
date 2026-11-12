import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
// Fontes locais: nenhuma requisição a serviços externos ao abrir o app.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/700-italic.css';
import '@fontsource/barlow-condensed/800.css';
import './ui/styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
