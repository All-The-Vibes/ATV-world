import { useEffect, useSyncExternalStore } from 'react';
import { characterPortrait, randomLook, toCss } from '../game/kit';
import { getFactory, requestDismiss, requestSpawn, setFactoryOpen, subscribeFactory } from './bridge';
import { MAX_AGENTS, ROLES, roleById, type Role } from './roles';
import './factory.css';

const portraits = new Map<string, string>();

/** A role's face, painted once from the same look its agents wear. */
function portrait(role: Role): string {
    let url = portraits.get(role.id);
    if (!url) {
        url = characterPortrait(randomLook(`${role.id}-1`, role.look)).flush().toDataURL();
        portraits.set(role.id, url);
    }
    return url;
}

/** The Agent Factory's role picker. It shows while the player is at the factory's door. */
export function FactoryPanel({ hidden }: { hidden: boolean }) {
    const { open, agents } = useSyncExternalStore(subscribeFactory, getFactory);
    const show = open && !hidden;

    useEffect(() => {
        if (!show) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            const index = Number(e.key) - 1;
            if (e.key === 'Escape') setFactoryOpen(false);
            else if (index >= 0 && index < ROLES.length) requestSpawn(ROLES[index].id);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [show]);

    if (!show) return null;
    // preventDefault on mousedown keeps keyboard focus on the game.
    const keep = (e: React.MouseEvent) => e.preventDefault();
    return (
        <section className="factory" aria-label="Agent Factory">
            <header className="factory-head">
                <h2>AGENT FACTORY</h2>
                <button type="button" className="factory-close" title="Close (Esc)" onMouseDown={keep} onClick={() => setFactoryOpen(false)}>X</button>
            </header>
            <ul className="factory-roles">
                {ROLES.map((role, i) => (
                    <li key={role.id}>
                        <button type="button" className="factory-role" style={{ '--role': toCss(role.badge) } as React.CSSProperties}
                            title={`Build a ${role.title} (${i + 1})`} onMouseDown={keep} onClick={() => requestSpawn(role.id)}>
                            <img src={portrait(role)} alt="" width={32} height={44} />
                            <span className="factory-role-title">{role.title}</span>
                            <span className="factory-role-blurb">{role.blurb}</span>
                            <span className="factory-role-key">{i + 1}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <div className="factory-roster">
                <span className="factory-count">{agents.length}/{MAX_AGENTS} AGENTS</span>
                {agents.map((a) => (
                    <button key={a.id} type="button" className="factory-chip" style={{ '--role': toCss(roleById(a.role).badge) } as React.CSSProperties}
                        title={`Send ${a.name} home`} onMouseDown={keep} onClick={() => requestDismiss(a.id)}>
                        {a.name}
                    </button>
                ))}
                {agents.length > 0 && <button type="button" className="factory-clear" onMouseDown={keep} onClick={() => requestDismiss()}>SEND ALL HOME</button>}
            </div>
        </section>
    );
}
