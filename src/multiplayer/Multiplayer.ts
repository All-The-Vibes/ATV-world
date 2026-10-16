import Phaser from 'phaser';
import { PixelCanvas, addPixels, characterSheet, lookKey, miniText, miniTextWidth, shadowTexture, speechArt } from '../game/kit';
import { MAX_CHAT, NEARBY_RADIUS, cleanChat, pushChat, setChatOnline, setChatSender, type ChatChannel } from './chat';
import { myCharacter, myId, myName, onIdentity } from './identity';
import { presetLook } from './characters';
import { setPresence } from './presence';

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
const BUBBLE_MS = 6000;
const BUBBLE_LIFT = 30;

interface Local {
    sprite: Phaser.GameObjects.Sprite;
    /** Out of sight (inside HQ): don't show up for others either. */
    hidden: boolean;
}

interface Peer {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Image;
    marker: Phaser.GameObjects.Image;
    name: string;
    character: number;
    x: number;
    y: number;
    seen: number;
    hidden: boolean;
}

interface Bubble {
    owner: Phaser.GameObjects.Sprite;
    image: Phaser.GameObjects.Image;
    key: string;
    until: number;
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
    private readonly bubbles: Bubble[] = [];
    private bubbleSerial = 0;
    private warnedOffline = false;
    private readonly unsubscribe: () => void;

    constructor(private readonly scene: Phaser.Scene, private readonly local: () => Local | undefined) {
        this.unsubscribe = onIdentity(() => {
            this.retryAt = 0;
            if (this.joined) this.send(this.state(true));
        });
        scene.events.on('update', this.tick, this);
        setChatSender(this.say);
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
        setChatSender(undefined);
        setChatOnline(false);
        this.bye();
        while (this.bubbles.length) this.pop(0);
        this.peers.forEach((p) => this.drop(p));
        this.peers.clear();
        setPresence([], false);
    }

    private state(force = false) {
        const l = this.local();
        const s = l?.sprite;
        return {
            t: 's',
            id: myId(),
            n: myName(),
            c: myCharacter() ?? 0,
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
                this.warnedOffline = false;
                setChatOnline(true);
                this.lastState = '';
                this.send({ ...this.state(true) });
                this.publish();
            };
            ws.onmessage = (event) => this.receive(event.data);
            ws.onclose = () => {
                this.joined = false;
                if (this.ws === ws) this.ws = undefined;
                setChatOnline(false);
                this.retryAt = performance.now() + this.retryMs;
                this.retryMs = Math.min(this.retryMs * 2, 30_000);
                this.publish();
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
                this.publish();
            }
            return;
        }
        if (d.t === 'c') {
            this.hear(id, d);
            return;
        }
        if (d.t !== 's') return;
        const x = Number(d.x), y = Number(d.y);
        const name = typeof d.n === 'string' ? d.n.slice(0, 16) : '';
        const character = Number.isInteger(d.c) ? Number(d.c) : 0;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !name) return;
        // A newcomer asks everyone to answer right away, so they don't wait for the next heartbeat.
        if (d.r === 1) setTimeout(() => { if (!this.disposed) this.send(this.state()); }, Math.random() * 400);
        let peer = this.peers.get(id);
        if (!peer) {
            if (this.peers.size >= MAX_PEERS) return;
            peer = this.spawn(name, character, x, y);
            this.peers.set(id, peer);
        } else if (peer.name !== name || peer.character !== character) {
            this.drop(peer);
            peer = this.spawn(name, character, x, y);
            this.peers.set(id, peer);
        }
        peer.seen = performance.now();
        peer.x = Phaser.Math.Clamp(x, -3000, 3000);
        peer.y = Phaser.Math.Clamp(y, -3000, 3000);
        peer.hidden = d.h === 1;
        peer.sprite.setVisible(!peer.hidden);
        peer.shadow.setVisible(!peer.hidden);
        peer.label.setVisible(!peer.hidden);
        peer.marker.setVisible(!peer.hidden);
        if (typeof d.f === 'string' && FRAME.test(d.f)) peer.sprite.setFrame(d.f);
        peer.sprite.setFlipX(d.fl === 1);
        this.publish();
    }

    /** Tells the players panel who's here. */
    private publish() {
        const list = [...this.peers].map(([id, p]) => ({ id, name: p.name, character: p.character }));
        list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        setPresence(list, this.joined);
    }

    private spawn(name: string, character: number, x: number, y: number): Peer {
        const look = presetLook(character);
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(this.scene, key, sheet.canvas, sheet.frames);
        // Real players get a blue name tag with a cyan marker over their head; NPC tags are dark.
        const labelKey = `mp-label-${name}`;
        const canvas = new PixelCanvas(miniTextWidth(name) + 6, 9);
        canvas.rect(0, 0, canvas.width, 9, 'blue').rect(0, 0, canvas.width, 1, 'cyan');
        miniText(canvas, 3, 2, name, 'white');
        addPixels(this.scene, labelKey, canvas);
        if (!this.scene.textures.exists('mp-marker')) {
            const m = new PixelCanvas(11, 8);
            m.rect(0, 0, 11, 2, 'cyan').rect(1, 2, 9, 2, 'sky').rect(3, 4, 5, 2, 'cyan').rect(5, 6, 1, 1, 'white').outline('ink', true);
            addPixels(this.scene, 'mp-marker', m);
        }
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 12)).setAlpha(0.35).setDepth(y - 1);
        const sprite = this.scene.add.sprite(x, y, key, 'down-0').setOrigin(0.5, 1).setDepth(y);
        const label = this.scene.add.image(x, y - 28, labelKey).setOrigin(0.5, 1).setDepth(y + 1);
        const marker = this.scene.add.image(x, y - 40, 'mp-marker').setOrigin(0.5, 1).setDepth(y + 1);
        return { sprite, shadow, label, marker, name, character, x, y, seen: performance.now(), hidden: false };
    }

    /** Say a chat line: over the wire (if connected), over your own head, and into the log. */
    private readonly say = (text: string, channel: ChatChannel) => {
        const l = this.local();
        const s = l?.sprite;
        this.send({ t: 'c', id: myId(), n: myName(), m: text, ch: channel === 'nearby' ? 'n' : 'w', x: s ? Math.round(s.x) : 0, y: s ? Math.round(s.y) : 0 });
        pushChat({ from: myName() || 'You', text, channel, mine: true });
        if (s && !l?.hidden) this.bubble(s, text);
        if (!this.joined && !this.warnedOffline) {
            this.warnedOffline = true;
            pushChat({ from: '', text: "You're offline right now, so nobody else can hear you.", channel, mine: false, system: true });
        }
    };

    /** Someone else said something. Nearby lines only count if you're standing close enough to hear them. */
    private hear(id: string, d: Record<string, unknown>) {
        const text = typeof d.m === 'string' ? cleanChat(d.m.slice(0, MAX_CHAT * 2)) : '';
        const name = typeof d.n === 'string' ? d.n.slice(0, 16) : '';
        if (!text || !name) return;
        const channel: ChatChannel = d.ch === 'n' ? 'nearby' : 'world';
        const peer = this.peers.get(id);
        if (channel === 'nearby') {
            const me = this.local()?.sprite;
            const x = Number(d.x), y = Number(d.y);
            if (!me || !Number.isFinite(x) || !Number.isFinite(y)) return;
            if (Math.hypot(me.x - x, me.y - y) > NEARBY_RADIUS) return;
        }
        pushChat({ from: name, text, channel, mine: false });
        if (peer?.sprite.visible) this.bubble(peer.sprite, text);
    }

    private bubble(owner: Phaser.GameObjects.Sprite, text: string) {
        const old = this.bubbles.findIndex((b) => b.owner === owner);
        if (old >= 0) this.pop(old);
        const key = `mp-chat-${++this.bubbleSerial}`;
        addPixels(this.scene, key, speechArt(text, 24));
        const image = this.scene.add.image(owner.x, owner.y - BUBBLE_LIFT, key).setOrigin(0.5, 1).setDepth(1e5);
        this.bubbles.push({ owner, image, key, until: performance.now() + BUBBLE_MS + text.length * 40 });
    }

    private pop(index: number) {
        const [b] = this.bubbles.splice(index, 1);
        b.image.destroy();
        if (this.scene.textures.exists(b.key)) this.scene.textures.remove(b.key);
    }

    private drop(peer: Peer) {
        const i = this.bubbles.findIndex((b) => b.owner === peer.sprite);
        if (i >= 0) this.pop(i);
        peer.sprite.destroy();
        peer.shadow.destroy();
        peer.label.destroy();
        peer.marker.destroy();
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
                this.publish();
                continue;
            }
            const s = peer.sprite;
            const far = Math.hypot(peer.x - s.x, peer.y - s.y) > 160;
            s.x = far ? peer.x : s.x + (peer.x - s.x) * k;
            s.y = far ? peer.y : s.y + (peer.y - s.y) * k;
            s.setDepth(s.y);
            peer.shadow.setPosition(s.x, s.y).setDepth(s.y - 1);
            peer.label.setPosition(s.x, s.y - 28).setDepth(s.y + 1);
            peer.marker.setPosition(s.x, s.y - 40 + Math.round(Math.sin(now / 150) * 2)).setDepth(s.y + 1);
        }

        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            if (now > b.until || !b.owner.active) {
                this.pop(i);
                continue;
            }
            b.image.setPosition(b.owner.x, b.owner.y - BUBBLE_LIFT).setVisible(b.owner.visible);
        }
    }
}
