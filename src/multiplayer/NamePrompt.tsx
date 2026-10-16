import { useEffect, useRef, useState } from 'react';
import { characterPortrait } from '../game/kit';
import { PRESETS, presetLook } from './characters';
import { myCharacter, myName, setMyCharacter, setMyName } from './identity';
import './multiplayer.css';

/** One character's standing pose, drawn big and crisp. */
export function Portrait({ index, scale = 4 }: { index: number; scale?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const out = ref.current;
        const ctx = out?.getContext('2d');
        if (!out || !ctx) return;
        const src = characterPortrait(presetLook(index)).flush();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0, out.width, out.height);
    }, [index]);
    return <canvas ref={ref} width={16 * scale} height={22 * scale} className="portrait" aria-hidden="true" />;
}

/** Asks for a name and a character. They're kept in this browser, and that's all the "login" there is. */
export function NamePrompt({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
    const [name, setName] = useState(myName());
    const [character, setCharacter] = useState<number | null>(myCharacter());
    const ready = !!name.trim() && character !== null;
    const submit = () => {
        if (!ready || character === null) return;
        if (!setMyName(name)) return;
        setMyCharacter(character);
        onDone();
    };
    return (
        <div className="name-prompt" role="dialog" aria-modal="true" aria-label="Pick your name and character">
            <form
                className="name-card"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <h2>WHO ARE YOU?</h2>
                <p>Pick a name and a character. Real players get a blue name tag and a cyan marker; NPCs have dark tags.</p>
                <input
                    autoFocus
                    value={name}
                    maxLength={16}
                    placeholder="Your name"
                    aria-label="Your name"
                    onChange={(e) => setName(e.target.value)}
                />
                <div className="char-grid" role="radiogroup" aria-label="Character">
                    {PRESETS.map((preset, i) => (
                        <button
                            key={preset.label}
                            type="button"
                            role="radio"
                            aria-checked={character === i}
                            aria-label={preset.label}
                            title={preset.label}
                            className="char-pick"
                            data-selected={character === i || undefined}
                            onClick={() => setCharacter(i)}
                        >
                            <Portrait index={i} />
                        </button>
                    ))}
                </div>
                <div className="name-actions">
                    {onCancel && <button type="button" className="name-cancel" onClick={onCancel}>CANCEL</button>}
                    <button type="submit" disabled={!ready}>{onCancel ? 'SAVE' : 'ENTER THE WORLD'}</button>
                </div>
            </form>
        </div>
    );
}
