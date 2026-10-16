import Phaser from 'phaser';
import stephWalkUrl from '../../../assets/steph-walk.png';
import { LibraryBridge } from '../../library/bridge';
import { collectItem, ITEMS } from '../../backpack/inventory';
import { addArea, addFeature, onMapRequest, resetMap, worldMap, type AreaInfo, type FeatureKind } from '../../map/world';
import {
    HEX, PALETTE, PLAYER_LOOK, PixelCanvas, PROPS, addCreatorNametag, addPixels, bayer, buildingArt, characterSheet, dancerSheet, fbm, libraryArt, lookKey, paintProp, randomLook,
    miniText, miniTextWidth, shadowTexture, speechArt, stripFrames, treeArt, type BuildingSpec, type Facing, type PropOptions,
} from '../kit';
import { addToken, isTyping, on, onFocusCharacter, removeToken, setInsideHQ, setViewModes, tokenCount, walkInput } from '../commands';
import { Directory, spotOf, spriteOf } from '../directory';
import { BikeGang } from '../bikes/BikeGang';
import { MovieParade } from '../bikes/MovieParade';
import { LockAndKey } from '../keyhouse/LockAndKey';
import { Disco } from '../disco/Disco';
import { Catchers } from '../catchers/Catchers';
import { setFactoryOpen } from '../../factory/bridge';
import { Factory } from '../factory/Factory';
import { Billboard } from '../billboard/Billboard';
import { UsaBillboard } from '../billboard/UsaBillboard';
import { Gremlins } from '../gremlins/Gremlins';
import { Roamers } from '../roamers/Roamers';
import { Workout } from '../workout/Workout';
import { Dragon, type Burnable } from '../dragon/Dragon';
import { Campus } from '../campus/Campus';
import { Multiplayer } from '../../multiplayer/Multiplayer';
import { Skateboard } from '../skateboard/Skateboard';
import { myLook } from '../../multiplayer/characters';
import { myName } from '../../multiplayer/identity';
import { SortingHat } from '../hat/SortingHat';
import { Atmosphere } from '../fx/Atmosphere';
import { HQ } from '../hq/HQ';
import { Incidents } from '../incidents/Incidents';
import { sp } from '../spread';
import { Kittens } from '../kittens';
import { Lake } from '../lake/Lake';
import { daenerysSheet } from '../kit/daenerys';
import { TrafficLight } from '../health/TrafficLight';
import { Giant } from '../giant/Giant';
import { Ambience } from '../life/Ambience';
import { Ollama } from '../llama/Ollama';
import { RubberDuck } from '../rubberDuck/RubberDuck';
import { LaunchPad } from '../mars/Rocket';
import { RabbitTree } from '../wonderland/RabbitTree';
import { Moles } from '../moles/Moles';
import { Planetarium } from '../planetarium/Planetarium';
import { TalkingMoles } from '../talkingMoles/TalkingMoles';
import { Pool } from '../pool/Pool';
import { Terrain } from '../terrain/Terrain';
import { Ocean } from '../ocean/Ocean';
import { Tokens } from '../tokens/Tokens';
import { TugOfWar } from '../tugOfWar/TugOfWar';
import { Tarot } from '../tarot/Tarot';
import { Town } from '../town/Town';
import { SpiderMan } from '../town/SpiderMan';
import { UFO } from '../ufo/UFO';
import { MarkB } from '../markb/MarkB';
import { publishVibes } from '../vibes';
import { WorldView } from '../view';
import { Witch } from '../witch/Witch';

type Placed = { getBounds: () => Phaser.Geom.Rectangle };
type Vibe = { sprite: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; homeY: number; found: boolean };

/** The world on the live screen: a little street built with the pixel-art kit. */
export class Preview extends Phaser.Scene {
    /** People strolling the street. `rest` is how long they're stopped (to complain about the dragon). */
    private walkers: {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Image;
        label?: Phaser.GameObjects.Image;
        nametag?: Phaser.GameObjects.Text;
        anim: string;
        dir: number;
        speed: number;
        rest: number;
    }[] = [];
    /** The dragon that circles town toasting people (see ../dragon). */
    private dragon?: Dragon;
    /** The sorting hat on its stool: walk up to it to be sorted into a house (see ../hat). */
    private sortingHat?: SortingHat;
    /** Gremlins that run around stealing tokens (see ../gremlins). */
    private gremlins?: Gremlins;
    /** Scouts with bug nets who catch gremlins and walk them out of town (see ../catchers). */
    private catchers?: Catchers;
    /** Friendly visitors who scare gremlins off and chat with the player (see ../roamers). */
    private roamers?: Roamers;
    /** Christian, who gathers a crowd for a workout class (see ../workout). */
    private workout?: Workout;
    /** Everyone the character search can list and zoom in on (see ../directory). */
    private directory?: Directory;
    /** Shahab and 3 friends riding BMX bicycles in single-file Stranger Things style (see ../bikes). */
    private bikeGang?: BikeGang;
    /** ET, Scream, IronMan, Hulk, and Kung fu Panda walking in a group on the same track as the bicycle team. */
    private movieParade?: MovieParade;
    /** Spider Man swinging from tree to tree inside The Town (see ../town/SpiderMan). */
    private spiderMan?: SpiderMan;
    /** The "Lock & Key" room (Keyhouse Manor) with lots of magical doors/windows and the 3 Locke siblings. */
    private lockAndKey?: LockAndKey;
    /** The Agent Factory: walk in to build agents with roles, who then wander town (see ../factory). */
    private factory?: Factory;
    /** Day/night lighting, clouds, fireflies (see ../fx/Atmosphere.ts). */
    atmosphere?: Atmosphere;
    private ollama?: Ollama;
    private rubberDuck?: RubberDuck;
    private talkingMoles?: TalkingMoles;
    /** A giant who stomps round the plaza shouting "The floor is lava" (see ../giant). */
    private giant?: Giant;
    /** The swimming pool, where people queue for the high dive (see ../pool). */
    private pool?: Pool;
    /** A tug of war that never ends, with people shouting about it (see ../tugOfWar). */
    private tugOfWar?: TugOfWar;
    private ufo?: UFO;
    /** Mark B, jetpacking round the whole map and saying nerdy AI things (see ../markb). */
    private markB?: MarkB;
    private incidents?: Incidents;
    private ambience?: Ambience;
    private ocean?: Ocean;
    private ground?: Phaser.GameObjects.TileSprite;
    /** The painted town ground: meadow, plaza, lanes, pond (see ../terrain). */
    private terrain?: Terrain;
    private player?: {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Image;
        marker: Phaser.GameObjects.Image;
        nametag?: Phaser.GameObjects.Text;
    };
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerFacing: Facing = 'down';
    private contentBounds?: Phaser.Geom.Rectangle;
    private readonly worldBounds = new Phaser.Geom.Rectangle(sp(-390), sp(-220), sp(780), sp(540));
    /** The camera: F fits the world, +/-/wheel zoom, drag looks around (see ../view.ts). */
    private view?: WorldView;
    /** ATV HQ: everyone on the call, coding (see ../hq). It grows a floor at a time. */
    private hq?: HQ;
    /** The town east of the plaza: roads, traffic, police and fire stations, house fires (see ../town). */
    private town?: Town;
    /** Microsoft's Redmond campus, west of the plaza (see ../campus). */
    private campus?: Campus;
    /** Other people on the website right now, live (see ../../multiplayer). */
    private multiplayer?: Multiplayer;
    private skateboard?: Skateboard;
    /** The disco north of the house: light-up floor, glitter ball, dancers (see ../disco). */
    private disco?: Disco;
    /** The digital AI advertising board: rotates humorous AI ads (see ../billboard). */
    private billboard?: Billboard;
    /** USA Super Intelligence welcome billboard towards the right corner (see ../billboard/UsaBillboard). */
    private usaBillboard?: UsaBillboard;
    /** Whack-a-Mole, south of the plaza: walk into the patch to play (see ../moles). */
    private moles?: Moles;
    /** The huge lake out west, past the campus, with a castle sunk at the bottom (see ../lake). */
    private lake?: Lake;
    /** The rocket to Mars, just south of the town: walk into it to fly there (see ../mars). */
    private launchPad?: LaunchPad;
    /** The player is aboard the rocket (taking off for Mars, or landing back home). */
    private rocketing = false;
    /** The big tree east of the town, with a portal to Wonderland and the White Rabbit racing to it (see ../wonderland). */
    private rabbitTree?: RabbitTree;
    /** The player is going down the rabbit hole (or popping back out of it). */
    private tumbling = false;
    /** The planetarium between the library and the town: walk in for the star show (see ../planetarium). */
    private planetarium?: Planetarium;
    /** The player is inside HQ (hidden indoors, with the call panel open). */
    private insideHQ = false;
    private opened = false;
    /** The library's front door, and the base of the building that takes you inside when you walk into it. */
    private entrance?: Phaser.Math.Vector2;
    private libraryFoot?: Phaser.Geom.Rectangle;
    /** Buildings' footprints on screen, where dropped tokens would be out of reach. */
    private readonly solids: Phaser.Geom.Rectangle[] = [];
    /** Flying cars that drop free tokens for anyone to pick up (see ../tokens). */
    private tokens?: Tokens;
    private kittens?: Kittens;
    private tarot?: Tarot;
    private vibes: Vibe[] = [];
    private vibeScore = 0;
    private vibeStreak = 0;
    private vibeCollected = 0;
    private vibeRound = 1;
    private lastVibeAt = -Infinity;
    private rushUntil = 0;
    private lastRushTrail = -Infinity;
    private rushTrailColor = 0;
    private lastVibePulse = -Infinity;
    private inHell = false;
    private portalReadyAt = 0;
    private surfacePortal?: Phaser.GameObjects.Sprite;
    private hellPortal?: Phaser.GameObjects.Sprite;
    private hellDecor: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[] = [];
    private ideaMachine?: Phaser.GameObjects.Image;
    private ideaBubble?: Phaser.GameObjects.Image;
    private ideaIndex = -1;
    private readonly buildChallenges = [
        'Build an arcade game',
        'Create an AI character',
        'Add something that changes the whole world',
    ];
    /** A seated witch by the portal who gives nearby people temporary Halloween costumes. */
    private witch?: Witch;

    constructor(private bridge: LibraryBridge) {
        super('Preview');
    }

    preload() {
        this.load.spritesheet('steph-walk', stephWalkUrl, { frameWidth: 64, frameHeight: 88 });
    }

    private resetWorld() {
        // Phaser reuses the Scene instance on restart, but destroys its old display list.
        const found = this.vibes.map(v => v.found);
        if (found.length && found.every(Boolean)) {
            // A pending next-round timer was removed by shutdown. Keep the score and start that round.
            this.vibeRound++;
            this.vibeCollected = this.vibeStreak = 0;
            found.fill(false);
        }
        this.walkers = [];
        this.vibes = [];
        this.solids.length = 0;
        this.contentBounds = undefined;
        this.player = undefined;
        this.hq = undefined;
        this.view = undefined;
        this.ocean = undefined;
        return found;
    }

    create() {
        resetMap();
        const wasInsideHQ = this.insideHQ;
        const first = !this.opened;
        this.opened = true;
        this.insideHQ = false;
        const found = this.resetWorld();
        this.grass();
        this.terrain = new Terrain(this, { bounds: () => this.worldBounds });
        const buildings = [
            { x: sp(-305), y: sp(-76), spec: { w: 6, h: 5, style: 'house', roof: 'red', wall: 'cream', seed: 2 } },
        ] satisfies { x: number; y: number; spec: BuildingSpec }[];
        const [cottage] = buildings.map(({ x, y, spec }) => this.building(x, y, spec));
        const library = this.library(sp(285), sp(225));
        // Set well back from the plaza, seven tiles behind where the old ATV shop stood.
        this.hq = new HQ(this, 0, sp(-114));
        this.hq.onResize = () => {
            this.fitWorld();
            if (this.view?.showing) this.visitHQ();
        };
        this.hq.onClick = () => this.enterHQ();
        this.fitWorld();
        [
            { x: sp(-375), y: sp(24), kind: 'oak' },
            { x: sp(-190), y: sp(-106), kind: 'cherry' },
            { x: sp(190), y: sp(-70), kind: 'autumn' },
            { x: sp(370), y: sp(112), kind: 'pine' },
            { x: sp(-65), y: sp(195), kind: 'atv' },
        ].forEach(({ x, y, kind }, i) => this.tree(x, y, kind, i + 1));
        this.prop('fountain', sp(-150), sp(205));
        this.prop('fountain', sp(55), sp(195), { colors: ['cyan', 'pink', 'gold', 'lime', 'violet', 'orange'] });
        this.prop('lamp', sp(-210), sp(133));
        this.prop('lamp', sp(116), sp(148));
        this.prop('flowers', sp(-12), sp(245), { colors: ['pink', 'yellow', 'white'] });
        this.prop('bench', sp(74), sp(230));
        this.prop('popcornVolcano', sp(-290), sp(219));
        this.prop('banner', sp(-290), sp(246), { text: 'FREE POPCORN', color: 'red' });
        this.prop('bench', sp(-228), sp(245));
        this.sortingHat = new SortingHat(this, sp(-110), sp(30), () => this.player, () => !this.insideHQ);
        this.includeInWorld(this.sortingHat.stool);
        this.includeInWorld(this.sortingHat.hat);
        [[-330, 150], [-60, 190], [180, 110], [-250, 40]].forEach(([x, y]) => this.prop('grassSign', sp(x), sp(y)));
        this.pool = new Pool(this, sp(160), sp(-215));
        this.solids.push(this.pool.deckBounds());
        this.includeInWorld(this.pool);
        this.tugOfWar = new TugOfWar(this, sp(0), sp(400));
        this.solids.push(this.tugOfWar.getBounds());
        this.includeInWorld(this.tugOfWar);
        this.disco = new Disco(this, sp(-290), sp(-250));
        this.disco.parts.forEach((part) => this.includeInWorld(part));
        this.moles = new Moles(this, sp(150), sp(335));
        this.moles.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.moles.area);
        // West of the kitten corral, below the campus road, so the two don't share ground.
        this.lockAndKey = new LockAndKey(this, -570, sp(345));
        this.lockAndKey.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.lockAndKey.footprint);
        this.launchPad = new LaunchPad(this, sp(644), sp(380));
        this.launchPad.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.launchPad.area);
        this.factory = new Factory(this, sp(290), sp(20), {
            area: () => new Phaser.Geom.Rectangle(
                this.worldBounds.left + 24, this.worldBounds.top + 24,
                Math.min(this.worldBounds.right, this.town?.bounds().left ?? Infinity) - 24 - (this.worldBounds.left + 24),
                this.worldBounds.height - 48,
            ),
            open: (x, y) => !this.solids.some((r) => r.contains(x, y)) && !this.hq?.contains(x, y),
        });
        this.solids.push(...this.factory.solids());
        this.factory.parts.forEach((part) => this.includeInWorld(part));
        try {
            this.town = new Town(this, Math.max(451, (this.contentBounds?.right ?? 387) + 64));
        } catch (e) {
            console.error('[town]', e);
        }
        try {
            this.campus = new Campus(this, Math.min(-457, (this.contentBounds?.left ?? -411) - 64));
        } catch (e) {
            console.error('[campus]', e);
        }
        try {
            const westEdge = Math.min(this.campus?.bounds().left ?? Infinity, this.contentBounds?.left ?? -411);
            this.lake = new Lake(this, westEdge - 260, 70);
            this.lake.parts.forEach((part) => this.includeInWorld(part));
            this.solids.push(this.lake.bounds);
        } catch (e) {
            console.error('[lake]', e);
        }
        // Between the library and the town, once the town has picked its spot.
        this.planetarium = new Planetarium(this, sp(580), sp(60));
        this.planetarium.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.planetarium.area);
        this.planetarium.onClick = () => this.enterPlanetarium();
        try {
            // Off to the side, east of the town.
            const east = Math.max(this.town?.bounds().right ?? 420, this.contentBounds?.right ?? 420);
            const town = this.town?.bounds();
            this.rabbitTree = new RabbitTree(this, east + 110, town ? Math.round(town.centerY) + 60 : 120, () => this.worldBounds);
            this.rabbitTree.parts.forEach((part) => this.includeInWorld(part, 'tree'));
            this.solids.push(this.rabbitTree.area);
        } catch (e) {
            console.error('[rabbit tree]', e);
        }
        this.fitWorld();
        this.billboard = new Billboard(this, sp(368), sp(415));
        this.billboard.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.billboard.bounds());
        const townLeft = this.town?.left ?? 756;
        this.usaBillboard = new UsaBillboard(this, townLeft - 95, -90);
        this.usaBillboard.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.usaBillboard.footprint);
        const trafficLight = new TrafficLight(this, sp(60), sp(170));
        this.solids.push(trafficLight.sprite.getBounds());
        this.includeInWorld(trafficLight.sprite);
        this.includeInWorld(trafficLight.label);
        this.createIdeaMachine(sp(-85), sp(170));
        // Introduction commits: 9c37211 (six originals), 3c1fb9c (Abdallah).
        for (let i = 0; i < 6; i++) this.walker(i, undefined, undefined, undefined, 'Bakar404');
        this.walker(6, 'Abdallah', undefined, undefined, 'aifateen');
        this.walker(7, 'Daenerys', sp(-240), daenerysSheet(), 'stephschofield');
        this.walker(8, 'Ahmed', sp(-180), undefined, 'Bakar404');
        this.bikeGang = new BikeGang(this, {
            townLeft: this.town?.left ?? 451,
            campusRight: this.campus?.bounds().right ?? -475,
        });
        this.movieParade = new MovieParade(this, {
            townLeft: this.town?.left ?? 451,
            campusRight: this.campus?.bounds().right ?? -475,
        });
        this.spiderMan = new SpiderMan(this, this.town?.left ?? 451);
        this.createHell();
        this.createSteph();
        this.createPlayer();
        try {
            this.multiplayer = new Multiplayer(this, () => (this.player ? { sprite: this.player.sprite, hidden: this.insideHQ } : undefined));
        } catch (e) {
        }
        try {
            this.skateboard = new Skateboard(this, () => this.player?.sprite, () => this.playerFacing);
        } catch (e) {
            console.error('[skateboard]', e);
        }
        this.incidents = new Incidents(this, () => this.sys.isActive() && !this.insideHQ);
        this.incidents.parts.forEach(part => this.includeInWorld(part));
        this.solids.push(this.incidents.station.getBounds(), this.incidents.button.getBounds());
        this.fitWorld();
        this.witch = new Witch(
            this,
            // Just beside the hell portal (258, 79).
            sp(258) - 53,
            sp(79) + 13,
            () => this.burnables().map(({ sprite }) => ({ sprite })),
            () => !this.inHell && !this.insideHQ,
        );
        this.includeInWorld(this.witch.witch);
        this.ollama = new Ollama(this);
        this.rubberDuck = new RubberDuck(this, {
            // The plaza between the campus and the town, from the pool and disco rows down to the south lawn.
            area: () => {
                const left = Math.max(this.worldBounds.left, this.campus?.bounds().right ?? -Infinity);
                const right = Math.min(this.worldBounds.right, this.town?.bounds().left ?? Infinity);
                const top = Math.max(this.worldBounds.top, sp(-250));
                const bottom = Math.min(this.worldBounds.bottom, sp(420));
                return new Phaser.Geom.Rectangle(left, top, right - left, bottom - top);
            },
            open: (x, y) => !this.solids.some((r) => r.contains(x, y)) && !this.hq?.contains(x, y),
        });
        this.talkingMoles = new TalkingMoles(this);
        this.giant = new Giant(this);
        this.ufo = new UFO(this, () => this.worldBounds);
        this.markB = new MarkB(this);
        this.tokens = new Tokens(this, {
            bounds: () => this.worldBounds,
            open: (x, y) => {
                const hq = this.hq?.bounds();
                return !(hq && Phaser.Geom.Rectangle.Contains(hq, x, y - 10)) && !this.solids.some((r) => r.contains(x, y));
            },
            onCollect: (by, kind) => {
                if (by.player) {
                    if (kind === 'token') addToken();
                    else collectItem(kind);
                }
            },
        });
        ITEMS.forEach((item, i) => {
            const x = sp([-70, 65, 80, -65][i]), y = sp([125, 100, 200, 240][i]);
            // A new landmark may occupy a starter spot; try farther along the plaza.
            for (let shift = 0; shift <= 192; shift += 64) {
                if (this.tokens!.drop(x - shift, y - 40, y, item.id)) break;
            }
        });
        this.createVibes(found);
        this.view = new WorldView(this, {
            bounds: () => this.worldBounds, player: this.player?.sprite,
            playerPosition: () => this.player && (this.ocean?.position(this.player.sprite) ?? this.player.sprite),
        });
        this.dragon = new Dragon(this, { bounds: () => this.worldBounds, targets: () => this.burnables() });
        this.atmosphere = new Atmosphere(this, { bounds: () => this.worldBounds, player: this.player?.sprite, vibes: () => this.vibes.map((v) => v.sprite), hq: this.hq });
        this.kittens = new Kittens(this, {
            bounds: () => this.worldBounds,
            include: (object) => this.includeInWorld(object),
            open: (x, y) => !this.solids.some((r) => r.contains(x, y)) && !this.hq?.contains(x, y),
            coins: () => this.tokens?.playthings() ?? [],
            dragon: () => this.dragon?.plaything(),
            disco: (x, y) => this.disco?.contains(x, y) ?? false,
            people: this.walkers.map((w) => ({
                sprite: w.sprite, shadow: w.shadow, label: w.label, nametag: w.nametag, anim: w.anim,
                hold: (seconds) => { w.rest = Math.max(w.rest, seconds); },
            })),
        });
        this.tarot = new Tarot(this, sp(-240), sp(660));
        this.tarot.parts.forEach((part) => this.includeInWorld(part));
        this.solids.push(this.tarot.area);
        this.gremlins = new Gremlins(this, {
            bounds: () => this.worldBounds,
            victims: () => [
                ...(this.player && !this.insideHQ && tokenCount() > 0 ? [{ sprite: this.player.sprite, player: true }] : []),
                ...this.walkers.map((w) => ({ sprite: w.sprite, player: false })),
            ],
            stealFromPlayer: () => removeToken(),
            spill: (x, y) => this.tokens?.spill(x, y),
        });
        this.catchers = new Catchers(this, { bounds: () => this.worldBounds, gremlins: () => this.gremlins });
        this.roamers = new Roamers(this, {
            atmosphere: this.atmosphere,
            bounds: () => this.worldBounds,
            open: (x, y) => !this.solids.some((r) => r.contains(x, y)) && !this.hq?.contains(x, y),
            player: () => (this.player && !this.insideHQ ? this.player.sprite : undefined),
            gremlins: () => this.gremlins,
            tokens: () => this.tokens,
            walkers: () => this.walkers.map((w) => w.sprite),
            dragon: () => this.dragon?.plaything(),
        });
        this.ambience = new Ambience(this, { player: () => this.player?.sprite, walkers: () => this.walkers.map((w) => w.sprite), indoors: () => this.insideHQ });
        this.workout = new Workout(this, {
            bounds: () => this.worldBounds,
            open: (x, y) => !this.solids.some((r) => r.contains(x, y)) && !this.hq?.contains(x, y),
            player: () => (this.player && !this.insideHQ ? this.player.sprite : undefined),
            people: () => [
                ...this.walkers.map((w) => ({
                    sprite: w.sprite,
                    shadow: w.shadow,
                    label: w.label,
                    hold: (seconds: number) => { w.rest = Math.max(w.rest, seconds); },
                })),
                ...(this.roamers?.people() ?? []),
            ],
        });
        this.mapAreas(cottage, library, trafficLight);
        let surfAt = 0;
        this.ocean = new Ocean(this, {
            bounds: () => this.worldBounds,
            scenery: () => this.hq?.surfScenery() ?? [],
            riders: () => [
                ...(this.player ? [{ sprite: this.player.sprite, hide: [this.player.shadow, this.player.marker] }] : []),
                ...this.walkers.map(w => ({ sprite: w.sprite, hide: [w.shadow], carry: w.label ? [w.label] : [] })),
                ...(this.hq?.surfRiders() ?? []),
                ...(this.campus?.surfRiders() ?? []),
            ],
            setSurfing: value => {
                if (this.hq) this.hq.surfing = value;
                if (this.campus) this.campus.surfing = value;
                if (this.town) this.town.surfing = value;
                if (value) surfAt = this.time.now;
                else {
                    const held = this.time.now - surfAt;
                    this.rushUntil += held;
                    this.lastVibeAt += held;
                }
            },
        });
        const wake = (_sys: unknown, data?: { from?: string }) => {
            if (data?.from === 'mars') this.landFromMars();
            else if (data?.from === 'wonderland') this.backFromWonderland();
            this.input.keyboard?.resetKeys();
            this.syncVibes(true);
        };
        const sleep = () => this.syncVibes(false);
        this.events.on('wake', wake);
        this.events.on('sleep', sleep);

        // Go into HQ by walking into it or clicking the building. Inside, the call panel shows who's there;
        // a fresh press of down or sideways (or the panel's Step out) walks you back out. A window listener, so
        // quick taps count and the key you walked in on (now auto-repeating) doesn't. It sits out while this
        // scene sleeps under the library.
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || !this.sys.isActive() || this.ocean?.active) return;
            if (this.insideHQ && !e.repeat && ['ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) this.leaveHQ();
            else if (!e.repeat && e.key.toLowerCase() === 'e') this.rollIdea();
            else if (!e.repeat && e.key.toLowerCase() === 'c' && this.player
                && this.incidents?.near(this.player.sprite.x, this.player.sprite.y)) this.incidents.trigger();
            else if (!this.insideHQ && !e.repeat && e.key === ' ') {
                e.preventDefault();
                this.vibePulse();
            }
        };
        this.registerCharacters();
        const offFocus = onFocusCharacter((id) => {
            const directory = this.directory;
            if (!this.sys.isActive() || !directory) return;
            if (!directory.locate(id) && id.startsWith('visitor-')) {
                if (!this.roamers?.invite(id.slice('visitor-'.length))) return;
                directory.update(0.4);
            }
            if (!directory.locate(id)) return;
            if (this.view?.focus(() => directory.locate(id))) directory.ping(id);
        });
        const off = on('leaveHQ', () => this.leaveHQ());
        // The touch Pulse button: the same as Space.
        const offPulse = on('pulse', () => {
            if (this.sys.isActive() && !this.insideHQ && !this.ocean?.active) this.vibePulse();
        });
        const offNight = on('toggleNight', () => {
            if (!this.atmosphere) return;
            const next = !this.atmosphere.nightMode;
            this.atmosphere.setNightMode(next);
            setViewModes({ night: next });
        });
        const offStranger = on('toggleStranger', () => {
            this.setHellTheme(!this.inHell);
            this.cameras.main.flash(220, this.inHell ? 200 : 255, this.inHell ? 30 : 220, this.inHell ? 50 : 150);
            this.cameras.main.shake(180, 0.004);
        });
        // The world map: "Go look" frames an area (with some of the street around it), clicking elsewhere looks there.
        const offMap = onMapRequest((req) => {
            if (!this.view || this.insideHQ) return;
            if ('area' in req) {
                const b = worldMap.areas.get(req.area)?.bounds();
                if (!b) return;
                const width = Math.max(b.width + 48, 280), height = Math.max(b.height + 48, 180);
                this.view.show({ x: b.x + b.width / 2 - width / 2, y: b.y + b.height / 2 - height / 2, width, height });
            } else {
                this.view.lookAt(req.x, req.y);
            }
        });
        window.addEventListener('keydown', onKey);
        const stop = () => {
            off();
            offPulse();
            this.events.off('wake', wake);
            this.events.off('sleep', sleep);
            this.events.off('shutdown', stop);
            this.events.off('destroy', stop);
            offFocus();
            offNight();
            offStranger();
            offMap();
            resetMap();
            window.removeEventListener('keydown', onKey);
            setInsideHQ(false);
            setViewModes({ night: false, stranger: false });
            this.syncVibes(false);
            this.tokens?.destroy();
        };
        this.events.once('shutdown', stop);
        this.events.once('destroy', stop);
        // Teams (and ?hq) open inside, and so does a reload while you were inside.
        const q = new URLSearchParams(location.search);
        const p = this.player?.sprite;
        if (q.has('hell')) {
            this.setHellTheme(true);
            const to = this.hellPortal;
            if (to && p) {
                p.setPosition(to.x, to.y + 28);
                this.player?.shadow.setPosition(p.x, p.y);
                this.view.trackPlayer();
            }
        }
        if (wasInsideHQ || (first && (q.has('teams') || q.has('hq'))) || (p && this.hq.contains(p.x, p.y))) this.enterHQ();
        else if (q.has('mars')) this.time.delayedCall(0, () => this.blastOff(true));
        else if (q.has('planetarium')) this.time.delayedCall(0, () => this.enterPlanetarium());
        else if (q.has('wonderland')) this.time.delayedCall(0, () => this.enterWonderland(true));
    }

    /** Follow the White Rabbit: the player shrinks into the swirl in the big tree and falls into Wonderland. */
    private enterWonderland(instantly = false) {
        const tree = this.rabbitTree;
        if (!this.player || !tree || this.tumbling || this.rocketing || this.insideHQ || this.ocean?.active || !this.sys.isActive()) return;
        this.tumbling = true;
        setFactoryOpen(false);
        const { sprite, shadow, marker } = this.player;
        sprite.stop();
        shadow.setVisible(false);
        marker.setVisible(false);
        const go = () => {
            // Wait by the tree for the trip home.
            const { x, y } = tree.exit;
            sprite.setPosition(x, y).setScale(1).setAlpha(1).setAngle(0).setVisible(false);
            shadow.setPosition(x, y);
            marker.setPosition(x, y - 34);
            this.view?.trackPlayer();
            this.scene.launch('Wonderland');
            this.scene.sleep();
        };
        if (instantly) {
            go();
            return;
        }
        sprite.setDepth(tree.y + 0.2);
        this.tweens.add({
            targets: sprite,
            x: tree.x,
            y: sprite.y - 14,
            scale: 0.1,
            alpha: 0,
            angle: 360,
            duration: 550,
            ease: 'Quad.easeIn',
            onComplete: () => {
                const cam = this.cameras.main;
                cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
                cam.fadeOut(300, 125, 75, 181);
            },
        });
    }

    /** Back from Wonderland: the player tumbles out of the hollow in the big tree. */
    private backFromWonderland() {
        const tree = this.rabbitTree;
        if (!this.player || !tree) return;
        const { sprite, shadow, marker } = this.player;
        const { x, y } = tree.exit;
        sprite.setPosition(x, y).setFlipX(false).setFrame('down-0').setDepth(y).setScale(0.1).setAlpha(0).setVisible(true);
        shadow.setPosition(x, y).setDepth(y - 1);
        marker.setPosition(x, y - 34).setDepth(y + 1);
        this.playerFacing = 'down';
        this.view?.trackPlayer();
        this.cameras.main.fadeIn(300, 125, 75, 181);
        this.tweens.add({
            targets: sprite,
            scale: 1,
            alpha: 1,
            duration: 450,
            ease: 'Back.easeOut',
            onComplete: () => {
                shadow.setVisible(true);
                marker.setVisible(true);
                this.tumbling = false;
            },
        });
    }

    /** Step into the planetarium for the star show, and come back out at the foot of its steps. */
    private enterPlanetarium() {
        const p = this.player?.sprite;
        if (!p || !this.planetarium || this.insideHQ || this.rocketing || this.ocean?.active || !this.sys.isActive()) return;
        const { exit } = this.planetarium;
        p.setPosition(exit.x, exit.y).setDepth(exit.y).stop();
        this.player?.shadow.setPosition(exit.x, exit.y);
        this.view?.trackPlayer();
        setFactoryOpen(false);
        this.scene.launch('StarShow');
        this.scene.sleep();
    }

    /** List everyone worth finding in the character search. */
    private registerCharacters() {
        const dir = new Directory(this);
        this.directory = dir;
        const at = (get: () => Phaser.GameObjects.Sprite | undefined) => () => spotOf(get());
        dir.add({ id: 'you', name: 'You', kind: 'player', locate: () => (this.insideHQ ? undefined : spotOf(this.player?.sprite)) });
        this.walkers.forEach((w, i) => dir.add({ id: `walker-${i}`, name: w.sprite.name || `Townsperson ${i + 1}`, kind: 'local', locate: () => spotOf(w.sprite) }));
        dir.add({ id: 'christian', name: 'Christian', kind: 'coach', locate: at(() => this.workout?.body) });
        dir.add({ id: 'catcher', name: 'Gremlin Catcher', kind: 'scout', locate: at(() => this.catchers?.first()) });
        dir.add({ id: 'gremlin', name: 'Gremlin', kind: 'thief', locate: at(() => this.gremlins?.first()) });
        dir.add({ id: 'dragon', name: 'Dragon', kind: 'beast', locate: at(() => spriteOf(this.dragon)) });
        dir.add({ id: 'ollama', name: 'Ollama', kind: 'llama', locate: at(() => spriteOf(this.ollama)) });
        dir.add({ id: 'giant', name: 'The Giant', kind: 'giant', locate: at(() => spriteOf(this.giant)) });
        dir.add({ id: 'ufo', name: 'Flying Saucer', kind: 'alien', locate: at(() => spriteOf(this.ufo)) });
        dir.add({ id: 'spiderman', name: 'Spider Man', kind: 'hero', locate: at(() => this.spiderMan?.sprite) });
        this.movieParade?.sprites().forEach((s) => dir.add({ id: `parade-${s.name}`, name: s.name, kind: 'movie', locate: () => spotOf(s) }));
        dir.add({
            id: 'white-rabbit', name: 'White Rabbit', kind: 'late',
            locate: () => {
                const r = this.rabbitTree?.rabbit;
                return r?.sprite.visible ? { x: r.x, y: r.y } : undefined;
            },
        });
        this.roamers?.catalog().forEach(({ id, name }) => dir.add({ id: `visitor-${id}`, name, kind: 'visitor', locate: at(() => this.roamers?.spriteOf(id)) }));
    }

    /** Climb into the rocket and fly to Mars (`instantly` skips the countdown and liftoff). */
    private blastOff(instantly = false) {
        if (!this.player || !this.launchPad || this.rocketing || this.insideHQ || this.ocean?.active) return;
        this.rocketing = true;
        const { sprite, shadow, marker } = this.player;
        sprite.stop();
        [sprite, shadow, marker].forEach((o) => o.setVisible(false));
        const go = () => {
            this.scene.launch('Mars');
            this.scene.sleep();
        };
        if (instantly) {
            this.launchPad.rocket.body.setVisible(false);
            go();
            return;
        }
        this.launchPad.rocket.launch(() => {
            const cam = this.cameras.main;
            cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
            cam.fadeOut(300, 20, 16, 30);
        });
    }

    /** Back from Mars: the rocket comes down onto its pad and the player steps out in front of it. */
    private landFromMars() {
        if (!this.player || !this.launchPad) return;
        const { rocket } = this.launchPad;
        const { sprite, shadow, marker } = this.player;
        const x = rocket.x + 26, y = rocket.y + 18;
        sprite.setPosition(x, y).setFlipX(false).setFrame('down-0').setDepth(y);
        shadow.setPosition(x, y).setDepth(y - 1);
        marker.setPosition(x, y - 34).setDepth(y + 1);
        this.playerFacing = 'down';
        this.view?.trackPlayer();
        this.cameras.main.fadeIn(300, 20, 16, 30);
        rocket.body.setVisible(true);
        rocket.land(() => {
            [sprite, shadow, marker].forEach((o) => o.setVisible(true));
            this.rocketing = false;
        });
    }

    /** Frame ATV HQ and the sidewalk out front, where people walk in. */
    private visitHQ() {
        if (!this.hq || !this.view) return;
        const b = this.hq.bounds();
        this.view.show({ x: b.x, y: b.y, width: b.width, height: b.height + 22 });
    }

    /** Go inside HQ: the player steps through the door, the camera frames the building, the call panel opens. */
    private enterHQ() {
        if (!this.hq || !this.player || this.rocketing || this.ocean?.active) return;
        if (!this.insideHQ) {
            this.insideHQ = true;
            setFactoryOpen(false);
            const { sprite, shadow, marker } = this.player;
            const at = this.hq.doorway.inside;
            sprite.stop().setPosition(at.x, at.y).setFlipX(false).setFrame('up-0');
            this.playerFacing = 'up';
            [sprite, shadow, marker].forEach((o) => o.setVisible(false));
            setInsideHQ(true);
        }
        this.visitHQ();
    }

    /** Walk back out the front door onto the sidewalk. */
    private leaveHQ() {
        if (!this.hq || !this.player || !this.insideHQ || this.ocean?.active) return;
        this.insideHQ = false;
        const { sprite, shadow, marker } = this.player;
        const at = this.hq.doorway.outside;
        sprite.setPosition(at.x, at.y).setFlipX(false).setFrame('down-0').setDepth(at.y);
        shadow.setPosition(at.x, at.y).setDepth(at.y - 1);
        marker.setPosition(at.x, at.y - 34).setDepth(at.y + 1);
        this.playerFacing = 'down';
        [sprite, shadow, marker].forEach((o) => o.setVisible(true));
        this.view?.trackPlayer();
        setInsideHQ(false);
    }

    update(_t: number, dtMs: number) {
        const riding = this.ocean?.active;
        this.ocean?.update(dtMs);
        if (riding || this.ocean?.active) return;
        const dt = dtMs / 1000;

        const walkerLeft = Math.max(this.worldBounds.left, this.campus?.bounds().right ?? -Infinity) + 24;
        const walkerRight = Math.min(this.worldBounds.right, this.town?.bounds().left ?? Infinity) - 24;
        for (const w of this.walkers) {
            if (w.rest > 0) {
                w.rest -= dt;
                if (w.rest > 0) {
                    if (w.sprite.anims.isPlaying) w.sprite.stop().setFrame('side-0');
                    continue;
                }
                w.sprite.play(w.anim);
            }
            w.sprite.x += w.dir * w.speed * dt;
            if (w.sprite.x <= walkerLeft || w.sprite.x >= walkerRight) {
                w.sprite.x = Phaser.Math.Clamp(w.sprite.x, walkerLeft, walkerRight);
                w.dir *= -1;
            }
            w.sprite.setFlipX(w.dir < 0);
            w.shadow.setPosition(w.sprite.x, w.sprite.y);
            w.label?.setPosition(w.sprite.x, w.sprite.y - w.sprite.displayHeight - 4);
        }
        this.movePlayer(dt);
        this.incidents?.update(dt);
        this.ideaBubble?.setVisible(this.nearIdeaMachine());
        this.sortingHat?.update(dt);
        this.ideaBubble?.setVisible(this.nearIdeaMachine());
        this.dragon?.update(dt);
        this.gremlins?.update(dt);
        this.catchers?.update(dt);
        this.roamers?.update(dt);
        this.workout?.update(dt);
        this.directory?.update(dt);
        this.bikeGang?.update(dt);
        this.movieParade?.update(dt);
        this.spiderMan?.update(dt);
        this.lockAndKey?.update(dt);
        this.ollama?.update(dt);
        this.rubberDuck?.update(dt);
        this.talkingMoles?.update(dt);
        this.giant?.update(dt);
        this.pool?.update(dt);
        this.tugOfWar?.update(dt);
        this.ufo?.update(dt);
        this.markB?.update(dt);
        this.disco?.update(dt);
        this.lake?.update(dt, this.player && !this.insideHQ && !this.inHell ? this.player : undefined);
        this.billboard?.update(dt);
        this.moles?.update(dt, this.player && !this.insideHQ ? this.player.sprite : undefined);
        this.factory?.update(dt, this.insideHQ ? undefined : this.player?.sprite);
        this.ambience?.update(dt);
        this.tokens?.update(dt, [
            ...(this.player && !this.insideHQ ? [{ sprite: this.player.sprite, player: true }] : []),
            ...this.walkers.map((w) => ({ sprite: w.sprite, player: false })),
            ...(this.bikeGang?.sprites().map((sprite) => ({ sprite, player: false })) ?? []),
            ...(this.movieParade?.sprites().map((sprite) => ({ sprite, player: false })) ?? []),
            ...(this.lockAndKey?.sprites().map((sprite) => ({ sprite, player: false })) ?? []),
        ]);
        this.kittens?.update(dt);
        this.tarot?.update(dt);
        this.witch?.update();
        this.rabbitTree?.update(dt);
        this.updateVibes();
        // Walked into the library (through its door or any wall): go in, and come back out just below the steps.
        const p = this.player?.sprite;
        if (p && this.libraryFoot && !this.insideHQ && this.libraryFoot.contains(p.x, p.y)) {
            p.setPosition(this.entrance!.x, this.libraryFoot.bottom + 18).stop();
            setFactoryOpen(false);
            this.scene.launch('Library');
            this.scene.sleep();
        } else if (p && !this.insideHQ && !this.rocketing && this.launchPad?.boards(p.x, p.y)) {
            this.blastOff();
        } else if (p && !this.insideHQ && this.planetarium?.foot.contains(p.x, p.y)) {
            this.enterPlanetarium();
        } else if (p && !this.insideHQ && !this.tumbling && this.rabbitTree?.enters(p.x, p.y)) {
            this.enterWonderland();
        }
    }

    private createIdeaMachine(x: number, y: number) {
        const art = new PixelCanvas(34, 48);
        art.rect(3, 18, 28, 28, 'night').rect(5, 20, 24, 23, 'violet')
            .rect(7, 22, 20, 10, 'ink').rect(9, 24, 16, 6, 'cyan')
            .rect(7, 35, 12, 5, 'plum').rect(22, 34, 5, 5, 'gold')
            .set(23, 35, 'yellow').rect(5, 45, 7, 2, 'ink').rect(22, 45, 7, 2, 'ink')
            .rect(14, 13, 6, 6, 'steel').rect(14, 15, 6, 1, 'cloud')
            .ellipse(17, 7, 7, 7, 'gold').ellipse(16, 6, 5, 5, 'yellow')
            .rect(14, 3, 2, 5, 'white').line(5, 5, 2, 4, 'yellow')
            .line(28, 5, 31, 4, 'yellow').line(17, 0, 17, 1, 'white')
            .outline('ink');
        addPixels(this, 'preview-idea-machine', art);
        this.add.image(x, y, shadowTexture(this, 32)).setAlpha(0.3).setDepth(-1e8);
        this.ideaMachine = this.add.image(x, y, 'preview-idea-machine')
            .setOrigin(0.5, 1).setDepth(y).setInteractive({ useHandCursor: true });
        this.ideaMachine.on('pointerdown', () => {
            if (!isTyping()) this.rollIdea();
        });
        this.solids.push(this.ideaMachine.getBounds());
        this.includeInWorld(this.ideaMachine);

        const label = new PixelCanvas(miniTextWidth('IDEA MACHINE') + 6, 11);
        label.rect(0, 0, label.width, label.height, 'ink');
        miniText(label, 3, 3, 'IDEA MACHINE', 'yellow');
        addPixels(this, 'preview-idea-label', label);
        this.includeInWorld(this.add.image(x, y + 12, 'preview-idea-label').setDepth(y + 1));
        addPixels(this, 'preview-idea-prompt', speechArt('Press E or click for a build challenge'));
        this.buildChallenges.forEach((text, index) => {
            addPixels(this, `preview-idea-${index}`, speechArt(`${text}! E or click for another.`));
        });
        this.ideaBubble = this.add.image(x, y - 49, 'preview-idea-prompt')
            .setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
        this.includeInWorld(this.ideaBubble);
    }

    private nearIdeaMachine() {
        const p = this.player?.sprite;
        const m = this.ideaMachine;
        return !!p && !!m && !this.insideHQ && this.sys.isActive()
            && Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y) <= 58;
    }

    private rollIdea() {
        if (!this.nearIdeaMachine()) return;
        // Pick a different challenge each time, without favoring either alternative.
        this.ideaIndex = this.ideaIndex < 0
            ? Phaser.Math.Between(0, this.buildChallenges.length - 1)
            : (this.ideaIndex + Phaser.Math.Between(1, this.buildChallenges.length - 1)) % this.buildChallenges.length;
        this.ideaBubble?.setTexture(`preview-idea-${this.ideaIndex}`).setVisible(true);
    }

    private grass() {
        const pc = new PixelCanvas(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) pc.mix(x, y, 'grass', 'leaf', fbm(x, y, 16, 3) * 0.9 - 0.15);
        }
        for (let i = 0; i < 40; i++) pc.set((i * 37) % 64, (i * 23) % 64, 'lime');
        addPixels(this, 'preview-grass', pc);
        this.ground = this.add.tileSprite(0, 0, 2048, 2048, 'preview-grass').setDepth(-1e9);
    }

    /** The Upside Down: a cold, dead mirror of the world, laced with vines and spores, behind a fleshy gate. */
    private createHell() {
        const ground = new PixelCanvas(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const n = fbm(x, y, 14, 4);
                if (n > 0.82) ground.set(x, y, 'slate');
                else ground.mix(x, y, 'ink', 'night', n * 0.7 - 0.1);
            }
        }
        // A few short, crooked veins, wrapped so the tile stays seamless.
        [[3, 10, 0.4], [40, 28, 2.2], [20, 50, -0.8], [52, 6, 1.6], [12, 34, -2.4]].forEach(([sx, sy, heading], v) => {
            let x = sx;
            let y = sy;
            let angle = heading;
            for (let step = 0; step < 18 + v * 3; step++) {
                const wx = ((Math.round(x) % 64) + 64) % 64;
                const wy = ((Math.round(y) % 64) + 64) % 64;
                ground.set(wx, wy, step % 7 === 3 ? 'red' : 'wine');
                angle += Math.sin(step * 1.7 + v * 5.3) * 0.7;
                x += Math.cos(angle);
                y += Math.sin(angle);
            }
        });
        for (let i = 0; i < 14; i++) ground.set((i * 29 + 7) % 64, (i * 43 + 11) % 64, i % 3 ? 'steel' : 'mist');
        addPixels(this, 'preview-hell-ground', ground);

        // The gate: a wet, pulsing tear with tendrils reaching out of it.
        const portal = new PixelCanvas(96, 24);
        for (let frame = 0; frame < 4; frame++) {
            const ox = frame * 24;
            const pulse = [0, 1, 2, 1][frame];
            portal.line(ox + 2, 20, ox + 7, 15, 'wine').line(ox + 22, 6 + pulse, ox + 17, 9, 'wine')
                .line(ox + 1, 8 - pulse, ox + 7, 10, 'wine').line(ox + 21, 21, ox + 16, 16, 'wine');
            portal.ellipse(ox + 12, 12, 7 + (pulse > 1 ? 1 : 0), 11, 'wine');
            portal.ellipse(ox + 12, 12, 6, 10, (_x, _y, nx, ny) => {
                const edge = nx * nx + ny * ny;
                if (edge > 0.7) return (frame + Math.round(ny * 5)) % 3 ? 'red' : 'pink';
                if (edge > 0.35) return 'wine';
                return edge > 0.12 ? 'plum' : 'ink';
            });
            portal.line(ox + 12, 4, ox + 12, 20, frame % 2 ? 'red' : 'pink');
            portal.set(ox + 4 + frame, 3, 'mist').set(ox + 19 - frame, 5, 'cloud');
        }
        addPixels(this, 'preview-hell-portal', portal, stripFrames(4, 24, 24));
        if (!this.anims.exists('preview-hell-portal')) {
            this.anims.create({
                key: 'preview-hell-portal',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'preview-hell-portal', frame })),
                frameRate: 5,
                repeat: -1,
            });
        }

        this.surfacePortal = this.add.sprite(sp(258), sp(79), 'preview-hell-portal', 0)
            .setDepth(-1e7)
            .play('preview-hell-portal');
        this.hellPortal = this.add.sprite(sp(-258), sp(210), 'preview-hell-portal', 0)
            .setDepth(-1e7)
            .setFlipX(true)
            .setVisible(false)
            .play('preview-hell-portal');

        // Creeping vines across the ground, slowly breathing.
        const vines = new PixelCanvas(48, 22);
        const tendril = (pts: number[][]) => {
            for (let i = 1; i < pts.length; i++) {
                const [x0, y0] = pts[i - 1];
                const [x1, y1] = pts[i];
                vines.line(x0, y0 + 1, x1, y1 + 1, 'bark').line(x0, y0, x1, y1, 'wine');
            }
        };
        tendril([[1, 12], [8, 9], [15, 13], [22, 10], [30, 14], [38, 9], [46, 11]]);
        tendril([[15, 13], [13, 18], [17, 21]]);
        tendril([[30, 14], [33, 19]]);
        tendril([[22, 10], [24, 4], [29, 1]]);
        tendril([[38, 9], [41, 4]]);
        [[8, 9], [22, 10], [38, 9], [30, 14]].forEach(([x, y]) => vines.set(x, y, 'red'));
        addPixels(this, 'preview-hell-fissure', vines);
        [
            [-326, -22, 0.8], [-170, 166, 1.1], [18, 54, 0.75],
            [170, 214, 1], [324, 20, 0.9], [90, -94, 0.7],
            [-90, 30, 1], [250, 120, 0.85], [-240, -100, 0.9],
        ].map(([x, y, scale]) => [sp(x), sp(y), scale]).forEach(([x, y, scale], i) => {
            const image = this.add.image(x, y, 'preview-hell-fissure')
                .setDepth(-1e7)
                .setScale(scale)
                .setFlipX(i % 2 === 0)
                .setVisible(false);
            this.hellDecor.push(image);
            this.tweens.add({
                targets: image,
                alpha: { from: 0.6, to: 1 },
                scaleY: { from: scale, to: scale * 1.08 },
                duration: 1400 + i * 120,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        });

        // Fleshy pods that throb with a red glow.
        const pod = new PixelCanvas(64, 24);
        for (let f = 0; f < 4; f++) {
            const ox = f * 16;
            const swell = [0, 1, 1, 0][f];
            pod.line(ox + 1, 23, ox + 5, 18, 'wine').line(ox + 15, 23, ox + 11, 18, 'wine');
            pod.ellipse(ox + 8, 15, 5 + swell, 7 + swell, 'wine');
            pod.ellipse(ox + 8, 15, 3 + swell, 5 + swell, (_x, _y, nx, ny) => (nx * nx + ny * ny < 0.3 ? (f === 2 ? 'pink' : 'red') : 'plum'));
            pod.line(ox + 8, 9 - swell, ox + 8, 21, 'wine').outline('ink', false, { x: ox, y: 0, w: 16, h: 24 });
        }
        addPixels(this, 'preview-hell-fire', pod, stripFrames(4, 16, 24));
        if (!this.anims.exists('preview-hell-fire')) {
            this.anims.create({
                key: 'preview-hell-fire',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'preview-hell-fire', frame })),
                frameRate: 3,
                repeat: -1,
                yoyo: true,
            });
        }
        const glowArt = new PixelCanvas(40, 16);
        glowArt.ellipse(20, 8, 19, 7, 'wine').ellipse(20, 8, 12, 4, 'red');
        addPixels(this, 'preview-hell-glow', glowArt);
        [[-230, 60], [-60, -40], [130, 40], [240, 170], [-330, 150], [60, 270], [330, -60]].map(([x, y]) => [sp(x), sp(y)]).forEach(([x, y], i) => {
            const glow = this.add.image(x, y - 1, 'preview-hell-glow').setAlpha(0.3).setDepth(-1e7).setVisible(false);
            this.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.4 }, scale: { from: 0.9, to: 1.1 }, duration: 1200 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const flesh = this.add.sprite(x, y, 'preview-hell-fire', i % 4).setOrigin(0.5, 1).setDepth(y).setVisible(false);
            flesh.play({ key: 'preview-hell-fire', startFrame: i % 4 });
            this.hellDecor.push(glow, flesh);
        });

        // Small tangles of root and old dead leaves.
        const clump = new PixelCanvas(11, 7);
        clump.line(0, 6, 4, 2, 'wine').line(4, 2, 7, 5, 'wine').line(7, 5, 10, 1, 'wine').line(3, 6, 6, 3, 'bark').set(4, 2, 'red').outline('ink');
        addPixels(this, 'preview-hell-bone', clump);
        const leaves = new PixelCanvas(9, 5);
        leaves.rect(0, 2, 3, 2, 'slate').rect(4, 1, 3, 2, 'steel').rect(6, 3, 3, 2, 'slate').set(2, 0, 'mist');
        addPixels(this, 'preview-hell-skull', leaves);
        [[-280, 10], [-100, 90], [200, 110], [-20, 200], [300, 260], [-200, 260], [120, -20], [-360, -80]].map(([x, y]) => [sp(x), sp(y)]).forEach(([x, y], i) => {
            const img = this.add.image(x, y, i % 2 ? 'preview-hell-bone' : 'preview-hell-skull')
                .setOrigin(0.5, 1).setDepth(y).setFlipX(i % 3 === 0).setVisible(false);
            this.hellDecor.push(img);
        });

        // Dead, leafless trees strangled by vines.
        const tree = new PixelCanvas(22, 30);
        tree.rect(9, 12, 3, 18, 'night').line(10, 12, 10, 29, 'slate')
            .line(10, 14, 3, 6, 'night').line(3, 6, 1, 1, 'night').line(5, 8, 6, 3, 'night')
            .line(11, 12, 18, 4, 'night').line(18, 4, 20, 0, 'night').line(15, 7, 17, 9, 'night')
            .line(10, 12, 9, 2, 'night').line(9, 2, 11, 0, 'night')
            .line(8, 28, 12, 22, 'wine').line(12, 22, 8, 17, 'wine').line(8, 17, 12, 13, 'wine')
            .line(4, 29, 8, 28, 'wine').line(12, 28, 17, 29, 'wine')
            .outline('ink');
        addPixels(this, 'preview-hell-spike', tree);
        [[-150, -20], [40, 120], [260, -10], [-300, 220], [180, 280], [-40, -90], [340, 200], [-380, 40]].map(([x, y]) => [sp(x), sp(y)]).forEach(([x, y], i) => {
            this.hellDecor.push(this.add.image(x, y, 'preview-hell-spike').setOrigin(0.5, 1).setDepth(y).setFlipX(i % 2 === 1).setScale(1 + (i % 3) * 0.3).setVisible(false));
        });

        // A string of Christmas lights near the gate, flickering like someone's trying to talk.
        const wire = new PixelCanvas(150, 12);
        for (let x = 0; x < 150; x++) wire.set(x, Math.round(2 + Math.sin((x / 149) * Math.PI) * 8), 'ink');
        addPixels(this, 'preview-hell-wire', wire);
        const wireX = sp(-258) - 75;
        const wireY = sp(210) - 60;
        this.hellDecor.push(this.add.image(wireX, wireY, 'preview-hell-wire').setOrigin(0, 0).setDepth(wireY + 20).setVisible(false));
        (['red', 'gold', 'cyan', 'lime', 'pink'] as const).forEach((color) => {
            const bulb = new PixelCanvas(3, 4);
            bulb.rect(0, 1, 3, 3, color).set(1, 0, 'slate').set(0, 1, 'white');
            addPixels(this, `preview-hell-bulb-${color}`, bulb);
        });
        const bulbColors = ['red', 'gold', 'cyan', 'lime', 'pink'] as const;
        for (let i = 0; i < 13; i++) {
            const x = 5 + i * 11.5;
            const y = Math.round(2 + Math.sin((x / 149) * Math.PI) * 8);
            const bulb = this.add.image(wireX + x, wireY + y + 1, `preview-hell-bulb-${bulbColors[i % 5]}`)
                .setOrigin(0.5, 0).setDepth(wireY + 21).setVisible(false);
            this.hellDecor.push(bulb);
            const flicker = () => {
                bulb.setAlpha(Math.random() < 0.35 ? 0.15 : 1);
                this.time.delayedCall(Phaser.Math.Between(80, 900), flicker);
            };
            flicker();
        }

        // Spores drifting lazily through the air.
        const ember = new PixelCanvas(2, 2);
        ember.rect(0, 0, 2, 2, 'mist').set(0, 0, 'cloud');
        addPixels(this, 'preview-hell-ember', ember);
        for (let i = 0; i < 90; i++) {
            const e = this.add.image(0, 0, 'preview-hell-ember').setDepth(1e6).setVisible(false);
            this.hellDecor.push(e);
            const launch = () => {
                const b = this.worldBounds;
                e.setPosition(Phaser.Math.Between(b.left, b.right), Phaser.Math.Between(b.top, b.bottom))
                    .setAlpha(0).setScale(Phaser.Math.FloatBetween(0.5, 1.3));
                this.tweens.add({
                    targets: e,
                    y: e.y - Phaser.Math.Between(20, 70),
                    x: e.x + Phaser.Math.Between(-40, 40),
                    alpha: { from: 0, to: Phaser.Math.FloatBetween(0.5, 0.9) },
                    yoyo: true,
                    duration: Phaser.Math.Between(2500, 5000),
                    delay: Phaser.Math.Between(0, 3000),
                    ease: 'Sine.easeInOut',
                    onComplete: launch,
                });
            };
            launch();
        }

        // Red lightning crackling across the sky.
        const storm = () => {
            if (this.inHell && !this.insideHQ) {
                const cam = this.cameras.main;
                cam.flash(140, 200, 30, 50);
                this.time.delayedCall(220, () => this.inHell && cam.flash(90, 160, 20, 40));
                cam.shake(160, 0.002);
            }
            this.time.delayedCall(Phaser.Math.Between(4000, 10000), storm);
        };
        this.time.delayedCall(3000, storm);
    }

    private setHellTheme(active: boolean) {
        if (this.ocean?.active) this.events.emit('surf:rebase');
        this.inHell = active;
        setViewModes({ stranger: active });
        this.ground?.setTexture(active ? 'preview-hell-ground' : 'preview-grass');
        this.cameras.main.setBackgroundColor(active ? '#0a0d18' : '#14101e');
        this.surfacePortal?.setVisible(!active);
        this.hellPortal?.setVisible(active);
        this.hellDecor.forEach((object) => object.setVisible(active));
        this.ambience?.setVisible(!active);
        this.terrain?.setVisible(!active);

        const exempt = new Set<Phaser.GameObjects.GameObject>([
            ...this.hellDecor,
            ...(this.surfacePortal ? [this.surfacePortal] : []),
            ...(this.hellPortal ? [this.hellPortal] : []),
            ...(this.player ? [this.player.sprite, this.player.shadow, this.player.marker] : []),
        ]);
        this.children.list.forEach((object) => {
            if (exempt.has(object) || object === this.ground) return;
            if ('setTint' in object && typeof object.setTint === 'function') {
                if (active) object.setTint(0x6878a0);
                else if ('clearTint' in object && typeof object.clearTint === 'function') object.clearTint();
            }
        });
        this.atmosphere?.setHell(active);
        this.witch?.setVisible(!active);
    }

    private usePortal() {
        if (!this.player || this.time.now < this.portalReadyAt) return;
        const from = this.inHell ? this.hellPortal : this.surfacePortal;
        if (!from || !from.visible) return;
        const { sprite, shadow, marker } = this.player;
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, from.x, from.y) > 17) return;

        this.setHellTheme(!this.inHell);
        const to = this.inHell ? this.hellPortal : this.surfacePortal;
        if (!to) return;
        const y = to.y + 28;
        sprite.setPosition(to.x, y).setDepth(y);
        shadow.setPosition(to.x, y).setDepth(y - 1);
        marker.setPosition(to.x, y - 34).setDepth(y + 1);
        this.portalReadyAt = this.time.now + 700;
        this.view?.trackPlayer();
        this.cameras.main.flash(220, this.inHell ? 200 : 255, this.inHell ? 30 : 220, this.inHell ? 50 : 150);
        this.cameras.main.shake(180, 0.004);
    }

    private building(x: number, y: number, spec: BuildingSpec) {
        const { canvas } = buildingArt(spec);
        const key = `preview-building-${x}`;
        addPixels(this, key, canvas);
        const image = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
        this.solids.push(image.getBounds());
        this.includeInWorld(image, 'building');
        return image;
    }

    /** The enterable library, with its door as the entrance and softly breathing porch lanterns. */
    private library(x: number, y: number) {
        const { canvas, info } = libraryArt();
        addPixels(this, 'preview-library', canvas);
        const image = this.add.image(x, y, 'preview-library').setOrigin(0.5, 1).setDepth(y);
        // A little past the steps too, so a token never lands where grabbing it would walk you inside.
        this.solids.push(new Phaser.Geom.Rectangle(image.x - canvas.width / 2, y - canvas.height, canvas.width, canvas.height + 12));
        this.includeInWorld(image, 'building');
        const left = x - canvas.width / 2;
        const top = y - canvas.height;
        if (info.door) this.entrance = new Phaser.Math.Vector2(left + info.door.x + info.door.w / 2, y + 3);
        // The building's base: the player is drawn standing at its feet, so this is "walking into" it.
        this.libraryFoot = new Phaser.Geom.Rectangle(left + 6, y - 24, canvas.width - 12, 27);

        const glow = new PixelCanvas(15, 15);
        for (let j = 0; j < 15; j++) {
            for (let i = 0; i < 15; i++) {
                const d = Math.hypot(i - 7, j - 7) / 7.5;
                if (d < 1 && (1 - d) ** 1.5 > bayer(i, j)) glow.set(i, j, d < 0.35 ? 'yellow' : 'gold');
            }
        }
        addPixels(this, 'preview-library-glow', glow);
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        for (const lx of [54, 74]) {
            const light = this.add.image(left + lx + 0.5, top + 125.5, 'preview-library-glow')
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.35)
                .setDepth(y + 0.5);
            if (!still) {
                this.tweens.add({
                    targets: light,
                    alpha: { from: 0.22, to: 0.42 },
                    duration: 900 + lx * 4,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                });
            }
        }
        return image;
    }

    private tree(x: number, y: number, kind: string, seed: number) {
        const { canvas } = treeArt(kind, seed);
        const key = `preview-tree-${kind}-${seed}`;
        addPixels(this, key, canvas);
        this.add.image(x, y, shadowTexture(this, 18)).setAlpha(0.25).setDepth(-1e8);
        const image = this.add.image(x, y + 2, key).setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(image, 'tree');
    }

    private prop(name: string, x: number, y: number, opts: PropOptions = {}) {
        const p = paintProp(PROPS[name], opts);
        const optSuffix = Object.keys(opts).length ? `-${JSON.stringify(opts)}` : '';
        const key = `preview-prop-${name}${optSuffix}`;
        addPixels(this, key, p.canvas, stripFrames(p.frames, p.frameW, p.frameH));
        if (p.shadow) this.add.image(x, y, shadowTexture(this, p.shadow)).setAlpha(0.25).setDepth(-1e8);
        const s = this.add.sprite(x, y + 1, key, 0).setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(s);
        if (p.frames > 1) {
            if (!this.anims.exists(key)) {
                this.anims.create({ key, frames: Array.from({ length: p.frames }, (_, frame) => ({ key, frame })), frameRate: p.fps, repeat: -1 });
            }
            s.play(key);
        }
    }

    private walker(i: number, name?: string, startAt?: number, art?: ReturnType<typeof characterSheet>, githubUsername?: string) {
        const look = randomLook(name ?? `preview-${i}`, { githubUsername });
        const key = art ? `preview-walker-${name ?? i}` : lookKey(look);
        const sheet = art ?? characterSheet(look);
        addPixels(this, key, sheet.canvas, sheet.frames);
        const anim = `${key}-walk`;
        if (!this.anims.exists(anim)) {
            this.anims.create({ key: anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
        }
        const lanes = [62, 124, 184, 96, 154, 42, 214, 140].map(sp);
        const y = lanes[i % lanes.length];
        const shadow = this.add.image(0, y, shadowTexture(this, 10)).setAlpha(0.25).setDepth(-1e8);
        const startX = startAt ?? Phaser.Math.Clamp(sp(-310 + i * 95), this.worldBounds.left + 28, this.worldBounds.right - 28);
        const sprite = this.add.sprite(startX, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y).play(anim);
        let label: Phaser.GameObjects.Image | undefined;
        if (name) {
            const labelKey = `preview-walker-label-${name}`;
            const canvas = new PixelCanvas(miniTextWidth(name) + 6, 9);
            canvas.rect(0, 0, canvas.width, 9, 'ink');
            miniText(canvas, 3, 2, name, 'cream');
            addPixels(this, labelKey, canvas);
            label = this.add.image(sprite.x, y - sprite.displayHeight - 4, labelKey).setOrigin(0.5, 1).setDepth(y + 1);
            sprite.setName(name);
        }
        const nametag = addCreatorNametag(sprite, look, { gap: label ? 16 : 2 });
        this.walkers.push({ sprite, shadow, label, nametag, anim, dir: i % 2 ? -1 : 1, speed: 18 + (i % 3) * 8, rest: 0 });
    }

    private createSteph() {
        const key = 'steph-walk';
        this.textures.get(key).add('side-0', 0, 0, 0, 64, 88);
        if (!this.anims.exists(key)) {
            this.anims.create({
                key, frames: [1, 0, 3, 2].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1,
            });
        }
        const x = sp(-20), y = sp(124);
        const sprite = this.add.sprite(x, y, key, 'side-0')
            .setName('Steph').setOrigin(0.5, 1).setScale(0.5).setDepth(y).play(key);
        const shadow = this.add.image(x, y, shadowTexture(this, 16)).setAlpha(0.25).setDepth(-1e8);
        const nameplate = new PixelCanvas(miniTextWidth('STEPH') + 6, 9);
        nameplate.rect(0, 0, nameplate.width, 9, 'ink');
        miniText(nameplate, 3, 2, 'STEPH', 'cream');
        addPixels(this, 'steph-label', nameplate);
        const label = this.add.image(x, y - 48, 'steph-label')
            .setName('Steph-label').setOrigin(0.5, 1).setDepth(y + 1);
        const nametag = addCreatorNametag(sprite, { githubUsername: 'stephschofield' }, { gap: 16 });
        this.walkers.push({ sprite, shadow, label, nametag, anim: key, dir: 1, speed: 26, rest: 0 });
    }

    /** Who the dragon can toast: the walkers, and the player unless they're safe inside HQ. */
    private burnables(): Burnable[] {
        const out: Burnable[] = this.walkers.map((w) => ({
            sprite: w.sprite,
            headroom: w.label ? w.sprite.displayHeight + 16 : 24,
            nametag: w.nametag,
            hold: (seconds: number) => { w.rest = Math.max(w.rest, seconds); },
        }));
        if (this.bikeGang) out.push(...this.bikeGang.burnables());
        if (this.movieParade) out.push(...this.movieParade.burnables());
        if (this.lockAndKey) out.push(...this.lockAndKey.burnables());
        if (this.player && !this.insideHQ) out.push({ sprite: this.player.sprite, headroom: 56, nametag: this.player.nametag });
        if (this.disco) out.push(...this.disco.burnables());
        out.push(...(this.catchers?.burnables() ?? []), ...(this.roamers?.burnables() ?? []), ...(this.workout?.burnables() ?? []));
        if (this.factory) out.push(...this.factory.burnables());
        return out;
    }

    /** A gold "YOU: name" tag under your own feet, so you can tell yourself from other players (blue tags) and NPCs (dark tags). */
    private addYouTag(sprite: Phaser.GameObjects.Sprite) {
        const name = myName();
        const text = name ? `YOU: ${name}` : 'YOU';
        const canvas = new PixelCanvas(miniTextWidth(text) + 6, 9);
        canvas.rect(0, 0, canvas.width, 9, 'gold').rect(0, 8, canvas.width, 1, 'orange');
        miniText(canvas, 3, 2, text, 'ink');
        addPixels(this, 'preview-you-tag', canvas);
        const tag = this.add.image(sprite.x, sprite.y + 3, 'preview-you-tag').setOrigin(0.5, 0);
        const follow = () => tag.setPosition(sprite.x, sprite.y + 3).setDepth(sprite.y + 1).setVisible(sprite.visible);
        this.events.on('postupdate', follow);
        this.events.once('shutdown', () => this.events.off('postupdate', follow));
    }

    private createPlayer() {
        const look = myLook();
        const key = 'preview-player';
        // The dancer sheet: the usual frames plus dance poses, for standing still on the disco floor.
        const sheet = dancerSheet(look);
        addPixels(this, key, sheet.canvas, sheet.frames);

        for (const facing of ['down', 'up', 'side'] as const) {
            const anim = `${key}-${facing}-walk`;
            if (!this.anims.exists(anim)) {
                this.anims.create({
                    key: anim,
                    frames: [`${facing}-1`, `${facing}-0`, `${facing}-2`, `${facing}-0`].map((frame) => ({ key, frame })),
                    frameRate: 9,
                    repeat: -1,
                });
            }
        }

        const markerCanvas = new PixelCanvas(17, 16);
        markerCanvas
            .rect(5, 0, 7, 7, 'gold')
            .rect(7, 1, 3, 6, 'yellow')
            .rect(1, 6, 15, 3, 'gold')
            .rect(3, 9, 11, 2, 'yellow')
            .rect(5, 11, 7, 2, 'gold')
            .rect(7, 13, 3, 2, 'yellow')
            .set(8, 15, 'cream')
            .outline('ink', true);
        addPixels(this, 'preview-player-marker', markerCanvas);

        const x = 0, y = sp(158);
        const shadow = this.add.image(x, y, shadowTexture(this, 12)).setAlpha(0.35).setDepth(y - 1);
        const sprite = this.add.sprite(x, y, key, 'down-0').setOrigin(0.5, 1).setDepth(y);
        const marker = this.add.image(x, y - 34, 'preview-player-marker').setOrigin(0.5, 1).setDepth(y + 1);
        const nametag = addCreatorNametag(sprite, look, { gap: 34 });
        this.player = { sprite, shadow, marker, nametag };
        this.addYouTag(sprite);

        this.cursors = this.input.keyboard?.createCursorKeys();
        this.input.keyboard?.addCapture([
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);
    }

    private createVibes(found: readonly boolean[] = []) {
        const art = new PixelCanvas(15, 17);
        art.ascii(0, 0, [
            '.......g.......',
            '......hhh......',
            '.....hiiih.....',
            '..ggghjjjhggg..',
            '.ghhjjkkkjhhg..',
            'ghijjkkkkkjihg.',
            '.ghhjjkkkjhhg..',
            '..ggghjjjhggg..',
            '.....hiiih.....',
            '......hhh......',
            '.......g.......',
        ], { '.': null, g: 'orange', h: 'gold', i: 'yellow', j: 'cream', k: 'white' }).outline('ink', true);
        addPixels(this, 'preview-vibe', art);
        const glowArt = new PixelCanvas(31, 17);
        for (let y = 0; y < glowArt.height; y++) {
            for (let x = 0; x < glowArt.width; x++) {
                const dx = (x - 15) / 15;
                const dy = (y - 8) / 8;
                const distance = dx * dx + dy * dy;
                if (distance < 1 && 1 - distance > bayer(x, y)) glowArt.set(x, y, distance < 0.28 ? 'yellow' : 'gold');
            }
        }
        addPixels(this, 'preview-vibe-glow', glowArt);
        const pulseArt = new PixelCanvas(45, 25);
        for (let y = 0; y < pulseArt.height; y++) {
            for (let x = 0; x < pulseArt.width; x++) {
                const dx = (x - 22) / 21;
                const dy = (y - 12) / 11;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 0.72 && distance < 1 && 1 - distance > bayer(x, y) * 0.18) {
                    pulseArt.set(x, y, distance > 0.88 ? 'yellow' : 'gold');
                }
            }
        }
        addPixels(this, 'preview-vibe-pulse', pulseArt);

        const points = [
            [-330, 164], [-224, 34], [-104, 236], [92, 92], [180, 210], [350, 72],
        ].map(([x, y]) => [sp(x), sp(y)] as const);
        this.vibes = points.map(([x, y], index) => {
            const glow = this.add.image(x, y + 4, 'preview-vibe-glow')
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.2)
                .setDepth(y - 1);
            const sprite = this.add.image(x, y, 'preview-vibe').setDepth(y + 2);
            sprite.setAlpha(0.9 + index % 2 * 0.1);
            const collected = found[index] ?? false;
            for (const part of [sprite, glow]) part.setVisible(!collected).setActive(!collected);
            return { sprite, glow, homeY: y, found: collected };
        });
        this.syncVibes(true, 'Find all six. Fast pickups build a combo.');
    }

    private vibePulse() {
        const player = this.player?.sprite;
        const now = this.time.now;
        if (!player || now - this.lastVibePulse < 2_500) return;
        this.lastVibePulse = now;

        const ring = this.add.image(player.x, player.y - 7, 'preview-vibe-pulse')
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScale(0.35)
            .setAlpha(0.9)
            .setDepth(player.y + 3);
        this.tweens.add({
            targets: ring,
            scaleX: 3.8,
            scaleY: 3.2,
            alpha: 0,
            duration: 520,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
        });
        for (let i = 0; i < 12; i++) {
            const angle = Math.PI * 2 * i / 12;
            const spark = this.add.image(player.x, player.y - 9, 'preview-vibe')
                .setBlendMode(Phaser.BlendModes.ADD)
                .setScale(0.2)
                .setDepth(player.y + 4);
            this.tweens.add({
                targets: spark,
                x: player.x + Math.cos(angle) * 56,
                y: player.y - 9 + Math.sin(angle) * 30,
                alpha: 0,
                duration: 420,
                ease: 'Cubic.easeOut',
                onComplete: () => spark.destroy(),
            });
        }

        for (const walker of this.walkers) {
            if (Phaser.Math.Distance.Squared(player.x, player.y, walker.sprite.x, walker.sprite.y) > 110 * 110) continue;
            this.tweens.add({
                targets: walker.sprite,
                y: walker.sprite.y - 10,
                duration: 110,
                yoyo: true,
                ease: 'Quad.easeOut',
            });
        }
        for (const vibe of this.vibes) {
            if (!vibe.found && Phaser.Math.Distance.Squared(player.x, player.y - 8, vibe.sprite.x, vibe.sprite.y) <= 92 * 92) {
                this.collectVibe(vibe);
            }
        }
    }

    private syncVibes(active: boolean, message = '') {
        publishVibes({
            active,
            collected: this.vibeCollected,
            total: this.vibes.length,
            score: this.vibeScore,
            streak: this.vibeStreak,
            round: this.vibeRound,
            rush: this.time.now < this.rushUntil,
            message,
        });
    }

    private updateVibes() {
        const player = this.player?.sprite;
        if (!player || this.insideHQ) return;
        const now = this.time.now;
        for (let index = 0; index < this.vibes.length; index++) {
            const vibe = this.vibes[index];
            if (vibe.found) continue;
            vibe.sprite.y = vibe.homeY + Math.round(Math.sin(now / 220 + index) * 3);
            vibe.glow.setAlpha(0.16 + (Math.sin(now / 280 + index * 1.7) + 1) * 0.08);
            if (Phaser.Math.Distance.Squared(player.x, player.y - 8, vibe.sprite.x, vibe.sprite.y) < 22 * 22) {
                this.collectVibe(vibe);
            }
        }
    }

    private collectVibe(vibe: Vibe) {
        vibe.found = true;
        const now = this.time.now;
        this.vibeStreak = now - this.lastVibeAt <= 4_000 ? Math.min(5, this.vibeStreak + 1) : 1;
        this.lastVibeAt = now;
        this.vibeCollected++;
        this.vibeScore += 100 * this.vibeStreak;

        for (let i = 0; i < 8; i++) {
            const spark = this.add.image(vibe.sprite.x, vibe.sprite.y, 'preview-vibe')
                .setScale(0.35)
                .setAlpha(0.9)
                .setDepth(vibe.sprite.depth + 1);
            const angle = Math.PI * 2 * i / 8;
            this.tweens.add({
                targets: spark,
                x: spark.x + Math.cos(angle) * (16 + i % 3 * 4),
                y: spark.y + Math.sin(angle) * (16 + i % 3 * 4),
                alpha: 0,
                scale: 0.05,
                duration: 360,
                ease: 'Quad.easeOut',
                onComplete: () => spark.destroy(),
            });
        }
        this.tweens.add({
            targets: vibe.sprite,
            y: vibe.sprite.y - 20,
            alpha: 0,
            scale: 1.8,
            duration: 280,
            ease: 'Back.easeIn',
            onComplete: () => vibe.sprite.setActive(false).setVisible(false),
        });
        this.tweens.add({
            targets: vibe.glow,
            alpha: 0,
            scaleX: 2.4,
            scaleY: 1.7,
            duration: 320,
            ease: 'Quad.easeOut',
            onComplete: () => vibe.glow.setActive(false).setVisible(false),
        });

        if (this.vibeCollected < this.vibes.length) {
            this.syncVibes(true, `Vibe ${this.vibeCollected} of ${this.vibes.length}. Combo ${this.vibeStreak}.`);
            return;
        }

        this.rushUntil = now + 6_000;
        this.cameras.main.flash(180, 247, 181, 56, false);
        this.cameras.main.shake(180, 0.002);
        this.syncVibes(true, `Round ${this.vibeRound} clear. Vibe Rush activated.`);
        this.time.delayedCall(2_500, () => {
            this.vibeRound++;
            this.vibeCollected = 0;
            this.vibeStreak = 0;
            this.vibes.forEach((item) => {
                item.found = false;
                item.sprite.setPosition(item.sprite.x, item.homeY).setScale(1).setAlpha(1).setActive(true).setVisible(true);
                item.glow.setPosition(item.sprite.x, item.homeY + 4).setScale(1).setAlpha(0.2).setActive(true).setVisible(true);
            });
            this.syncVibes(true, `Round ${this.vibeRound}. The vibes are back.`);
        });
        this.time.delayedCall(6_000, () => this.syncVibes(true, 'Vibe Rush ended.'));
    }

    /**
     * The world map's named places (see src/map): what each one is and who made it. Built something? Add it here,
     * with whatever it covers on the ground, so people can find it and know who to thank (or blame).
     */
    private mapAreas(cottage: Placed, library: Placed, trafficLight: { sprite: Placed; label: Placed }) {
        const covering = (...things: (Placed | undefined)[]) => {
            const parts = things.filter((t): t is Placed => !!t);
            return () => parts.map((t) => t.getBounds()).reduce((a, b) => Phaser.Geom.Rectangle.Union(a, b));
        };
        const place = (info: AreaInfo, bounds?: () => Phaser.Geom.Rectangle) => bounds && addArea(info, bounds);
        const hq = this.hq;
        place({ id: 'atv-hq', name: 'ATV HQ', by: 'Veda Vundela', color: PALETTE.sky,
            about: 'Where everyone on the Teams call codes. It grows a floor as people dial in. Walk in to see who is here.' },
        hq && (() => hq.bounds()));
        place({ id: 'tower-library', name: 'Tower Library', by: 'Veda Vundela', color: PALETTE.violet,
            about: 'A stone tower full of real books. Walk in to browse the shelves or search the card catalog.' }, covering(library));
        place({ id: 'red-roof-cottage', name: 'Red-Roof Cottage', by: 'Ahmed Abdelsalam', color: PALETTE.red,
            about: 'The first house in town, from the little street that started ATV World.' }, covering(cottage));
        place({ id: 'town-square', name: 'Town Square', by: 'Ahmed Abdelsalam, ShahabName', color: PALETTE.cyan,
            about: 'Fountains, street lamps, flowers, a bench, and the ATV fruit tree, with townsfolk strolling by all day.' },
        () => new Phaser.Geom.Rectangle(sp(-225), sp(105), sp(355), sp(150)));
        const town = this.town, campus = this.campus;
        place({ id: 'the-town', name: 'The Town', by: 'Ahmed Abdelsalam', color: PALETTE.orange,
            about: 'A ring road with two-way traffic, police and fire stations, and houses. When one catches fire (or you click it), the fire truck rolls out.' },
        town && (() => town.bounds()));
        place({ id: 'redmond-campus', name: 'Redmond Campus', by: 'Ahmed Abdelsalam', color: PALETTE.mist,
            about: "Microsoft's campus: Buildings 92 and 99, The Commons and its sports field, a treehouse in the pines, and the Connector shuttle." },
        campus && (() => campus.bounds()));
        place({ id: 'disco', name: 'The Disco', by: 'Mark Briggs', color: PALETTE.pink,
            about: "A light-up dance floor, a glitter ball, spotlights, and people dancing on the music's beat." },
        this.disco && covering(...this.disco.parts));
        place({ id: 'pool', name: 'The Pool', by: 'Mark Briggs', color: PALETTE.blue,
            about: 'A swimming pool with a high dive. Swimmers queue up, dive, flip, or belly flop, and have something to say about it.' },
        covering(this.pool));
        place({ id: 'whack-a-mole', name: 'Whack-a-Mole', by: 'Veda Vundela', color: PALETTE.wood,
            about: 'A fenced patch of nine holes. Walk in to start a 30-second round.' },
        this.moles && covering(...this.moles.parts));
        place({ id: 'sorting-hat', name: 'The Sorting Hat', by: 'Veda Vundela', color: PALETTE.gold,
            about: 'Walk up to the stool and the hat sorts you into one of the four houses of ATV.' },
        this.sortingHat && covering(this.sortingHat.stool, this.sortingHat.hat));
        place({ id: 'kitten-corral', name: 'Kitten Corral', by: 'DeaderestPool', color: PALETTE.lime,
            about: 'Slippery kittens and their toys. They do not stay in the corral, and the townsfolk get distracted.' },
        this.kittens && (() => this.kittens!.bounds));
        place({ id: 'traffic-light', name: 'CI/CD Traffic Light', by: 'AI Fateen', color: PALETTE.leaf,
            about: 'Shows how main is doing in CI: green when it is healthy, red when it is broken.' },
        covering(trafficLight.sprite, trafficLight.label));
        place({ id: 'idea-machine', name: 'Idea Machine', by: 'AI Fateen', color: PALETTE.yellow,
            about: 'Walk up and press E (or click it) for a random build challenge.' }, covering(this.ideaMachine));
        place({ id: 'repair-crew', name: 'Self-Healing Repair Crew', by: 'AI Fateen', color: PALETTE.steel,
            about: 'A harmless production drill. Walk up and press C (or click the button) to start an incident and watch the crew fix it.' },
        this.incidents && covering(this.incidents.station, this.incidents.button));
        place({ id: 'hell-portal', name: 'Gate to the Upside Down', by: 'Veda Vundela', color: PALETTE.wine,
            about: 'A fleshy gate to a cold, dead mirror of the world, laced with vines and spores. Walk onto it if you dare.' }, covering(this.surfacePortal));
        place({ id: 'lake', name: 'The Lake', by: 'Veda Vundela', color: PALETTE.navy,
            about: 'A huge lake out west with a castle sunk on its bed, fish, and bubbles. You can swim in it.' },
        this.lake && covering(...this.lake.parts));
        place({ id: 'mars-rocket', name: 'Rocket to Mars', by: 'Veda Vundela', color: PALETTE.orange,
            about: 'A launch pad, a tower, and a rocket. Walk into the rocket to climb aboard and fly to Mars.' },
        this.launchPad && covering(...this.launchPad.parts));
        place({ id: 'rabbit-tree', name: 'The Rabbit Hole Tree', by: 'Veda Vundela', color: PALETTE.pink,
            about: 'A huge old tree with a swirling portal in its trunk. Follow the White Rabbit in, and fall down into Wonderland.' },
        this.rabbitTree && covering(...this.rabbitTree.parts));
        place({ id: 'agent-factory', name: 'Agent Factory', by: 'AI Fateen', color: PALETTE.steel,
            about: 'Walk in (or click it) to pick a role. A new agent rolls out on the conveyor belt and wanders town handing out work.' },
        this.factory && covering(...this.factory.parts));
        place({ id: 'keyhouse', name: 'Keyhouse Manor', by: 'ShahabName', color: PALETTE.plum,
            about: 'The Lock & Key room: a mysterious Victorian house of magical doors and glowing windows, with the Locke kids patrolling outside.' },
        this.lockAndKey && covering(...this.lockAndKey.parts));
        place({ id: 'tug-of-war', name: 'Tug of War', by: 'Mark Briggs', color: PALETTE.clay,
            about: 'Two teams hauling on a rope that never gets anywhere, shouting about it now and then.' }, covering(this.tugOfWar));
        place({ id: 'billboard', name: 'Giant Billboard', by: 'Mark Briggs', color: PALETTE.peach,
            about: 'A giant digital board running rotating, humorous AI ads.' },
        this.billboard && covering(...this.billboard.parts));

        worldMap.world = this.worldBounds;
        worldMap.view = this.cameras.main.worldView;
        worldMap.player = this.player?.sprite;
        worldMap.walkers = this.walkers.map((w) => w.sprite);
    }

    /** Everything placed grows the world's bounds, and shows on the world map (src/map) as a building, tree, or dot. */
    private includeInWorld(object: { getBounds: () => Phaser.Geom.Rectangle; visible?: boolean }, kind: FeatureKind = 'prop') {
        const bounds = object.getBounds();
        if (object.visible !== false) addFeature(kind, bounds);
        if (!this.contentBounds) {
            this.contentBounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        } else {
            const left = Math.min(this.contentBounds.left, bounds.left);
            const top = Math.min(this.contentBounds.top, bounds.top);
            const right = Math.max(this.contentBounds.right, bounds.right);
            const bottom = Math.max(this.contentBounds.bottom, bounds.bottom);
            this.contentBounds.setTo(left, top, right - left, bottom - top);
        }
        this.fitWorld();
    }

    /** The world is everything placed so far plus ATV HQ (which grows and shrinks with the call), with a margin. */
    private fitWorld() {
        const parts = [this.contentBounds, this.hq?.bounds(), this.town?.bounds(), this.campus?.bounds()].filter((r): r is Phaser.Geom.Rectangle => !!r);
        if (!parts.length) return;
        const left = Math.min(...parts.map((r) => r.left));
        const top = Math.min(...parts.map((r) => r.top));
        const right = Math.max(...parts.map((r) => r.right));
        const bottom = Math.max(...parts.map((r) => r.bottom));
        const padding = 64;
        this.worldBounds.setTo(left - padding, top - padding, right - left + padding * 2, bottom - top + padding * 2);
        this.ground
            ?.setPosition(this.worldBounds.centerX, this.worldBounds.centerY)
            .setSize(Math.max(2048, this.worldBounds.width + 512), Math.max(2048, this.worldBounds.height + 512));
        // HQ lost floors: bring back a player who was standing in the sky it left behind.
        const p = this.player;
        if (p && !this.insideHQ && !this.ocean?.active) {
            const x = Phaser.Math.Clamp(p.sprite.x, this.worldBounds.left + 12, this.worldBounds.right - 12);
            const y = Phaser.Math.Clamp(p.sprite.y, this.worldBounds.top + 12, this.worldBounds.bottom - 12);
            if (x !== p.sprite.x || y !== p.sprite.y) {
                p.sprite.setPosition(x, y).setDepth(y);
                p.shadow.setPosition(x, y).setDepth(y - 1);
                p.marker.setPosition(x, y - 34).setDepth(y + 1);
                this.view?.trackPlayer();
            }
        }
    }

    private movePlayer(dt: number) {
        if (!this.player || !this.cursors) return;
        const { sprite, shadow, marker } = this.player;
        const { dx, dy } = walkInput(this.cursors);
        const moving = dx !== 0 || dy !== 0;

        if (this.insideHQ || this.rocketing || this.tumbling) return;

        if (moving) {
            const length = Math.hypot(dx, dy);
            const speed = (this.time.now < this.rushUntil ? 146 : 92) * (this.skateboard?.speedMultiplier ?? 1);
            sprite.x = Phaser.Math.Clamp(sprite.x + dx / length * speed * dt, this.worldBounds.left + 12, this.worldBounds.right - 12);
            sprite.y = Phaser.Math.Clamp(sprite.y + dy / length * speed * dt, this.worldBounds.top + 12, this.worldBounds.bottom - 12);

            if (Math.abs(dx) > Math.abs(dy)) {
                this.playerFacing = 'side';
                sprite.setFlipX(dx < 0);
            } else {
                this.playerFacing = dy < 0 ? 'up' : 'down';
                sprite.setFlipX(false);
            }

            const anim = `preview-player-${this.playerFacing}-walk`;
            if (sprite.anims.currentAnim?.key !== anim) sprite.play(anim);
            if (this.time.now < this.rushUntil && this.time.now - this.lastRushTrail >= 65) {
                this.lastRushTrail = this.time.now;
                const colors = [HEX.gold, HEX.yellow, HEX.cyan, HEX.pink];
                const ghost = this.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
                    .setOrigin(sprite.originX, sprite.originY)
                    .setFlipX(sprite.flipX)
                    .setTint(colors[this.rushTrailColor++ % colors.length])
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setAlpha(0.42)
                    .setDepth(sprite.y - 0.5);
                this.tweens.add({
                    targets: ghost,
                    y: ghost.y - 5,
                    alpha: 0,
                    scaleX: 1.3,
                    scaleY: 0.9,
                    duration: 300,
                    ease: 'Quad.easeOut',
                    onComplete: () => ghost.destroy(),
                });
            }
        } else {
            sprite.stop();
            sprite.setFrame(`${this.playerFacing}-0`);
            if (this.disco?.contains(sprite.x, sprite.y)) this.disco.groove(sprite);
        }

        shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1);
        const markerBob = Math.round(Math.sin(this.time.now / 150) * 2);
        marker.setPosition(sprite.x, sprite.y - 34 + markerBob).setDepth(sprite.y + 1);
        sprite.setDepth(sprite.y);
        // Walked into HQ (through the door, or any wall, since nothing here is solid): go in.
        if (moving && this.hq?.contains(sprite.x, sprite.y)) this.enterHQ();
        if (moving) this.usePortal();
    }
}
