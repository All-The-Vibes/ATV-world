import { PhaserGame } from './PhaserGame';
import { send, type Command } from './game/commands';

const buttons: [label: string, command: Command, title: string][] = [
    ['-', 'zoomOut', 'Zoom out (-)'],
    ['FIT', 'fit', 'Show the whole world (F)'],
    ['+', 'zoomIn', 'Zoom in (+)'],
];

export default function App() {
    return (
        <>
            <PhaserGame />
            <div className="banner">
                <h1>ATV WORLD</h1>
                <p>Arrows walk · Wheel or +/- zooms · Drag to look around · F fits</p>
            </div>
            <div className="zoom">
                {buttons.map(([label, command, title]) => (
                    // preventDefault on mousedown keeps keyboard focus on the game.
                    <button key={command} type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={() => send(command)}>
                        {label}
                    </button>
                ))}
            </div>
        </>
    );
}
