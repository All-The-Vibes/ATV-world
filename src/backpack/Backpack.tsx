import { useEffect, useRef, useSyncExternalStore } from 'react';
import { isTyping, onTokens, tokenCount } from '../game/commands';
import { itemIcon } from './art';
import { getInventory, ITEMS, onInventory } from './inventory';
import './backpack.css';

function TokenIcon() {
    return <svg viewBox="0 0 9 9" width="24" height="24" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="#14101e" d="M2 0h5v1h1v1h1v5H8v1H7v1H2V8H1V7H0V2h1V1h1z" />
        <path fill="#f7b538" d="M2 1h5v1h1v5H7v1H2V7H1V2h1z" />
        <path fill="#c9925a" d="M3 2h3v1H5v4H4V3H3z" />
    </svg>;
}

export function Backpack({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const inventory = useSyncExternalStore(onInventory, getInventory);
    const tokens = useSyncExternalStore(onTokens, tokenCount);
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const found = ITEMS.filter(item => inventory.counts[item.id] > 0).length;
    const last = ITEMS.find(item => item.id === inventory.lastItem);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'b' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
            if (document.querySelector('dialog[open]')) return;
            e.preventDefault();
            onOpenChange(true);
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [onOpenChange]);

    useEffect(() => {
        const node = dialog.current;
        if (!open || !node) return;
        node.showModal();
        return () => {
            node.close();
            trigger.current?.focus();
        };
    }, [open]);

    return <>
        <button ref={trigger} type="button" className="backpack-toggle" aria-haspopup="dialog"
            aria-expanded={open} aria-controls="backpack" title="Open backpack (B)"
            onClick={() => onOpenChange(true)}>
            <img src={itemIcon('backpack')} width="36" height="36" alt="" />
            <span className="backpack-toggle-label">BACKPACK <small>{found}/{ITEMS.length} found</small></span>
            <span className="backpack-balance" aria-label={`${tokens} tokens`}><TokenIcon />{tokens.toLocaleString()}</span>
        </button>
        <span className="sr-only" role="status">{last ? `${last.name} added to backpack. ${inventory.counts[last.id]} collected.` : ''}</span>
        {open && <dialog ref={dialog} id="backpack" className="backpack" aria-labelledby="backpack-title"
            onCancel={e => { e.preventDefault(); onOpenChange(false); }}
            onKeyDown={e => {
                e.stopPropagation();
                if (e.key.toLowerCase() === 'b' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) onOpenChange(false);
            }}>
            <header className="backpack-header">
                <img src={itemIcon('backpack')} width="72" height="72" alt="" />
                <div><p className="backpack-eyebrow">YOUR POCKET-SIZED STASH</p><h2 id="backpack-title">Backpack</h2></div>
                <button type="button" className="backpack-close" aria-label="Close backpack" onClick={() => onOpenChange(false)}>×</button>
            </header>
            <div className="backpack-wallet">
                <TokenIcon /><strong>{tokens.toLocaleString()}</strong><span>TOKENS<small>Finders keepers.</small></span>
            </div>
            <div className="backpack-collection"><h3>The builder’s kit</h3><span>{found} / {ITEMS.length} discovered</span></div>
            <ul className="backpack-grid">
                {ITEMS.map(item => <li key={item.id} data-found={inventory.counts[item.id] > 0}>
                    <div className="backpack-item-art">
                        <img src={itemIcon(item.id)} width="72" height="72" alt="" />
                        <span className="backpack-quantity" aria-label={`${inventory.counts[item.id]} collected`}>×{inventory.counts[item.id].toLocaleString()}</span>
                    </div>
                    <h4>{item.name}</h4><p>{item.description}</p>
                    <span className="backpack-item-status">{inventory.counts[item.id] ? 'PACKED!' : 'NOT FOUND YET'}</span>
                </li>)}
            </ul>
            <footer>
                <p>Walk over loot to pack it. Flying cars bring fresh drops!</p>
                <small>{inventory.saved ? 'Saved in this browser · In-game collectibles only.' : 'Storage unavailable: this stash lasts until you reload.'}</small>
            </footer>
        </dialog>}
    </>;
}
