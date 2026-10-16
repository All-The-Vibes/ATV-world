import Phaser from 'phaser';
import { PixelCanvas, addPixels, characterSheet, lookKey, miniText, miniTextWidth, randomLook, shadowTexture } from '../game/kit';
import { myId, myName, onIdentity } from './identity';

/**
 * Other people on the website, live. Each browser tells everyone else where its player is (a few times a second) over
 * an Azure Web PubSub WebSocket, and draws the others as labeled characters. There are no accounts: your name and a
 * random id live in this browser (see identity.ts), and `/api/negotiate` only hands out the WebSocket address.
 *
 * It never gets in the game's way: if multiplayer is off or the connection drops, the world plays solo and quietly
 * keeps trying to reconnect.
 */

const GROUP = 'world';
const SEND_MS = 120;
const HEARTBEAT_MS = 3000;
const STALE_MS = 9000;
const MAX_PEERS = 60;
const FRAME = /^(down|up|side)-[0-2]$/;

interface Local {
    sprite: Phaser.GameObjects.Sprite;
    /** Out of sight (inside HQ): don't show up for others either. */
    hidden: boolean;
}

interface Peer {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Image;
    name: string;
    x: number;
    y: number;
    seen: number;
}

export class Multiplayer {
    private ws?: WebSocket;
    private disposed = false;
    private retryMs = 2000;
    private retryAt = 0;
    private connecting = false;
    private off = false;
    private joined = false;
    private lastSend = 0;
    private lastState = '';
    private readonly peers = new Map<string, Peer>();
    private readonly unsubscribe: () => void;

    constructor(private readonly scene: Phaser.Scene, private readonly local: () => Local | undefined) {
        this.unsubscribe = onIdentity(() => {
            this.retryAt = 0;
            if (this.joined) this.send(this.state(true));
        });
        scene.events.on('update', this.tick, this);
        window.addEventListener('pagehide', this.bye);
        const stop = () => this.dispose();
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
    }

    /** How many other people are here right now. */
    count(): number {
        return this.peers.size;
    }

    private readonly bye = () => {
        this.send({ t: 'b', id: myId() });
        this.ws?.close();
    };

    private dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.scene.events.off('update', this.tick, this);
        window.removeEventListener('pagehide', this.bye);
        this.unsubscribe();
        this.bye();
        this.peers.forEach((p) => this.drop(p));
        this.peers.clear();
    }

    private state(force = false) {
        const l = this.local();
        const s = l?.sprite;
        return {
            t: 's',
            id: myId(),
            n: myName(),
            x: s ? Math.round(s.x * 10) / 10 : 0,
            y: s ? Math.round(s.y * 10) / 10 : 0,
            f: s ? String(s.frame.name) : 'down-0',
            fl: s?.flipX ? 1 : 0,
            h: !s || l?.hidden ? 1 : 0,
            r: force ? 1 : 0,
        };
    }

    private send(data: object) {
        if (this.ws?.readyState !== WebSocket.OPEN || !this.joined) return;
        try {
            this.ws.send(JSON.stringify({ type: 'sendToGroup', group: GROUP, noEcho: true, dataType: 'json', data }));
        } catch {
            /* The socket is closing; the reconnect picks it up. */
        }
    }

    private async connect() {
        if (this.connecting || this.off || this.disposed) return;
        this.connecting = true;
        try {
            const res = await fetch(`/api/negotiate?id=${encodeURIComponent(myId())}`, { cache: 'no-store' });
            const { url } = (await res.json()) as { url?: string | null };
            if (!url) {
                // Multiplayer isn't set up on this server: play solo, and look again in a few minutes.
                this.retryAt = performance.now() + 5 * 60_000;
                return;
            }
            const ws = new WebSocket(url, 'json.webpubsub.azure.v1');
            this.ws = ws;
            ws.onopen = () => {
                this.retryMs = 2000;
                ws.send(JSON.stringify({ type: 'joinGroup', group: GROUP }));
                this.joined = true;
                this.lastState = '';
                this.send({ ...this.state(true) });
            };
            ws.onmessage = (event) => this.receive(event.data);
            ws.onclose = () => {
                this.joined = false;
                if (this.ws === ws) this.ws = undefined;
                this.retryAt = performance.now() + this.retryMs;
                this.retryMs = Math.min(this.retryMs * 2, 30_000);
            };
            ws.onerror = () => ws.close();
        } catch {
            this.retryAt = performance.now() + this.retryMs;
            this.retryMs = Math.min(this.retryMs * 2, 30_000);
        } finally {
            this.connecting = false;
        }
    }

    private receive(raw: unknown) {
        let msg: { type?: string; data?: Record<string, unknown> };
        try {
            msg = JSON.parse(String(raw));
        } catch {
            return;
        }
        const d = msg.data;
        if (msg.type !== 'message' || !d || typeof d.id !== 'string' || d.id === myId()) return;
        const id = d.id.slice(0, 40);
        if (d.t === 'b') {
            const gone = this.peers.get(id);
            if (gone) {
                this.drop(gone);
                this.peers.delete(id);
            }
            return;
        }
        if (d.t !== 's') return;
        const x = Number(d.x), y = Number(d.y);
        const name = typeof d.n === 'string' ? d.n.slice(0, 16) : '';
        if (!Number.isFinite(x) || !Number.isFinite(y) || !name) return;
        // A newcomer asks everyone to answer right away, so they don't wait for the next heartbeat.
        if (d.r === 1) setTimeout(() => { if (!this.disposed) this.send(this.state()); }, Math.random() * 400);
        let peer = this.peers.get(id);
        if (!peer) {
            if (this.peers.size >= MAX_PEERS) return;
            peer = this.spawn(name, x, y);
            this.peers.set(id, peer);
        } else if (peer.name !== name) {
            this.drop(peer);
            peer = this.spawn(name, x, y);
            this.peers.set(id, peer);
        }
        peer.seen = performance.now();
        peer.x = Phaser.Math.Clamp(x, -3000, 3000);
        peer.y = Phaser.Math.Clamp(y, -3000, 3000);
        const visible = d.h !== 1;
        peer.sprite.setVisible(visible);
        peer.shadow.setVisible(visible);
        peer.label.setVisible(visible);
        if (typeof d.f === 'string' && FRAME.test(d.f)) peer.sprite.setFrame(d.f);
        peer.sprite.setFlipX(d.fl === 1);
    }

    private spawn(name: string, x: number, y: number): Peer {
        const look = randomLook(`mp-${name}`);
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(this.scene, key, sheet.canvas, sheet.frames);
        const labelKey = `mp-label-${name}`;
        const canvas = new PixelCanvas(miniTextWidth(name) + 6, 9);
        canvas.rect(0, 0, canvas.width, 9, 'ink');
        miniText(canvas, 3, 2, name, 'cream');
        addPixels(this.scene, labelKey, canvas);
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 12)).setAlpha(0.35).setDepth(y - 1);
        const sprite = this.scene.add.sprite(x, y, key, 'down-0').setOrigin(0.5, 1).setDepth(y);
        const label = this.scene.add.image(x, y - 28, labelKey).setOrigin(0.5, 1).setDepth(y + 1);
        return { sprite, shadow, label, name, x, y, seen: performance.now() };
    }

    private drop(peer: Peer) {
        peer.sprite.destroy();
        peer.shadow.destroy();
        peer.label.destroy();
    }

    private tick(_time: number, deltaMs: number) {
        const now = performance.now();

        if (!this.ws && !this.connecting && !this.off && myName() && now >= this.retryAt) void this.connect();

        if (this.joined && now - this.lastSend >= SEND_MS && !document.hidden) {
            const s = this.state();
            const sig = `${s.x}|${s.y}|${s.f}|${s.fl}|${s.h}`;
            if (sig !== this.lastState || now - this.lastSend >= HEARTBEAT_MS) {
                this.lastSend = now;
                this.lastState = sig;
                this.send(s);
            }
        }

        const k = 1 - Math.pow(0.0005, Math.min(0.1, deltaMs / 1000));
        for (const [id, peer] of this.peers) {
            if (now - peer.seen > STALE_MS) {
                this.drop(peer);
                this.peers.delete(id);
                continue;
            }
            const s = peer.sprite;
            const far = Math.hypot(peer.x - s.x, peer.y - s.y) > 160;
            s.x = far ? peer.x : s.x + (peer.x - s.x) * k;
            s.y = far ? peer.y : s.y + (peer.y - s.y) * k;
            s.setDepth(s.y);
            peer.shadow.setPosition(s.x, s.y).setDepth(s.y - 1);
            peer.label.setPosition(s.x, s.y - 28).setDepth(s.y + 1);
        }
    }
}
