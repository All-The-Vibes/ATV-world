import type Phaser from 'phaser';
import type { CharacterLook, Color, ColorName, FrameRect, PixelCanvas } from '../kit';
import type { Gremlins } from '../gremlins/Gremlins';
import type { Tokens } from '../tokens/Tokens';

/** A small thing a roamer carries (a lantern, a guitar, a clipboard...), drawn in code and following them around. */
export interface RoamerProp {
    /** Unique texture key. */
    key: string;
    make: () => PixelCanvas | { canvas: PixelCanvas; frames: FrameRect[] };
    /** Frame count (1 for a still prop) and size of one frame. */
    frames: number;
    w: number;
    h: number;
    frameRate?: number;
    /** Offset from the roamer's feet to the prop's centre; x flips with the way they face. */
    offset: [number, number];
}

/** What a roamer's hooks can see of the town. */
export interface RoamerWorld {
    scene: Phaser.Scene;
    bounds: () => Phaser.Geom.Rectangle;
    open: (x: number, y: number) => boolean;
    /** The player's sprite, or nothing while they're out of sight (inside HQ). */
    player: () => Phaser.GameObjects.Sprite | undefined;
    gremlins: () => Gremlins | undefined;
    tokens: () => Tokens | undefined;
    /** The people strolling the street. */
    walkers: () => Phaser.GameObjects.Sprite[];
    /** Where the dragon is, if it's flying. */
    dragon: () => { x: number; y: number } | undefined;
}

/** A roamer as its hooks see it. */
export interface RoamerHandle {
    spec: RoamerSpec;
    sprite: Phaser.GameObjects.Sprite;
    world: RoamerWorld;
    /** Seconds since this visit began. */
    age: number;
    /** Show a speech bubble. */
    say(text: string): void;
    /** A burst of tiny squares around a spot (default: over the roamer). */
    sparkle(color?: Color, x?: number, y?: number): void;
    /** The roamer's own ward effect (rays, ring, or moths). */
    ward(): void;
    /** Stand still for a while (also stops them walking). */
    pause(seconds: number): void;
    /** Walk to a spot next, instead of a random one. */
    goTo(x: number, y: number): void;
    /** Anything a hook wants to remember between calls. */
    data: Record<string, unknown>;
}

/** Extra behaviour on top of the shared loop (wandering, greeting the player, scaring gremlins). All optional. */
export interface RoamerHooks {
    update?(r: RoamerHandle, dt: number): void;
    /** The player came up to say hello. */
    onGreet?(r: RoamerHandle): void;
    /** They just scared a gremlin off. */
    onFoil?(r: RoamerHandle): void;
    /** They reached a token. */
    onToken?(r: RoamerHandle): void;
    /** The dragon burned them. */
    onBurn?(r: RoamerHandle): void;
    /** They left town. */
    onLeave?(r: RoamerHandle): void;
}

/** How a roaming character looks, moves, and what it says. Add one file to ./characters and it joins the town. */
export interface RoamerSpec {
    id: string;
    name: string;
    look: CharacterLook;
    prop?: RoamerProp;
    /** Colour of its sparkles and its ward. */
    glow: ColorName;
    /** What it does when it scares a gremlin: rays of light, a rune ring, or a flutter of moths. */
    ward: 'rays' | 'ring' | 'moths';
    /** Seconds between visits, and how long a visit lasts. */
    every: [number, number];
    stay: [number, number];
    speed: number;
    greet: string[];
    foil: string[];
    token: string[];
    hooks?: RoamerHooks;
}
