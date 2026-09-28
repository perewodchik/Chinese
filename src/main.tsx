import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { startActiveTime } from './app/activeTime';
// catches the browser's one "this can be installed" event, which comes early
import './platform/install';
import { applyRememberedTheme } from './ui/colorScheme';
import './styles.css';

applyRememberedTheme();
startActiveTime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
