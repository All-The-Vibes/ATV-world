import '@fontsource/press-start-2p/index.css';
import '@fontsource/vt323/index.css';
import './styles.css';
import './live';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startCall } from './call';

// Who's in the call (Teams, ?call=..., or the demo). ATV HQ and the call panel draw it.
startCall();

// No StrictMode: it would mount the Phaser game twice in dev.
createRoot(document.getElementById('root')!).render(<App />);
