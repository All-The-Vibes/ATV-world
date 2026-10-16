import { useState } from 'react';
import { setMyName } from './identity';
import './multiplayer.css';

/** Asks for a name once, the first time you visit. It's kept in this browser, and it's all the "login" there is. */
export function NamePrompt({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState('');
    const submit = () => {
        if (setMyName(name)) onDone();
    };
    return (
        <div className="name-prompt" role="dialog" aria-modal="true" aria-label="Pick your name">
            <form
                className="name-card"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <h2>WHO ARE YOU?</h2>
                <p>Pick a name. Anyone else in the world right now will see you walking around.</p>
                <input
                    autoFocus
                    value={name}
                    maxLength={16}
                    placeholder="Your name"
                    aria-label="Your name"
                    onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" disabled={!name.trim()}>ENTER THE WORLD</button>
            </form>
        </div>
    );
}
