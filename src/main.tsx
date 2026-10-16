import '@fontsource/press-start-2p/index.css';
import '@fontsource/vt323/index.css';
import './styles.css';
import './live';
import { createRoot } from 'react-dom/client';
import App from './App';

// No StrictMode: it would mount the Phaser game twice in dev.
createRoot(document.getElementById('root')!).render(<App />);
