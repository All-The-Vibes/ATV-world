import { PixelCanvas, miniText, miniTextWidth, shadowTexture, type Color, type ColorName } from '../kit';
import { AI_ADS, type AIAd } from './ads';

export const BILLBOARD_W = 118;
export const BILLBOARD_H = 74;
export const SCREEN_W = 100;
export const SCREEN_H = 44;
export const SCREEN_OFFSET_X = 9;
export const SCREEN_OFFSET_Y = 5;

/** Draw the 20x20 pixel art illustration for an ad icon. */
function drawAdIcon(pc: PixelCanvas, ox: number, oy: number, icon: AIAd['icon']) {
    switch (icon) {
        case 'server-fire': {
            // Server rack
            pc.rect(ox + 2, oy + 4, 11, 15, 'steel')
                .rect(ox + 3, oy + 5, 9, 13, 'slate')
                // Server drive slots
                .rect(ox + 4, oy + 7, 7, 2, 'night').set(ox + 9, oy + 7, 'lime').set(ox + 10, oy + 7, 'cyan')
                .rect(ox + 4, oy + 11, 7, 2, 'night').set(ox + 9, oy + 11, 'gold').set(ox + 10, oy + 11, 'red')
                .rect(ox + 4, oy + 15, 7, 2, 'night').set(ox + 9, oy + 15, 'red').set(ox + 10, oy + 15, 'red');
            // Fire flames licking the server
            pc.line(ox + 11, oy + 8, ox + 14, oy + 4, 'orange')
                .line(ox + 12, oy + 7, ox + 15, oy + 2, 'red')
                .set(ox + 13, oy + 5, 'yellow')
                .line(ox + 8, oy + 3, ox + 10, oy + 1, 'orange')
                .set(ox + 9, oy + 2, 'yellow')
                .set(ox + 10, oy + 0, 'red');
            // Protective little blue umbrella over top
            pc.ellipse(ox + 10, oy + 2, 7, 3, 'sky')
                .line(ox + 3, oy + 3, ox + 17, oy + 3, 'blue')
                .line(ox + 10, oy + 3, ox + 10, oy + 7, 'clay');
            break;
        }
        case 'wizard-pc': {
            // Beige retro computer monitor
            pc.rect(ox + 3, oy + 7, 14, 11, 'sand')
                .rect(ox + 5, oy + 9, 10, 7, 'ink')
                .rect(ox + 6, oy + 10, 8, 5, 'navy')
                // Green prompt cursor
                .set(ox + 7, oy + 11, 'lime').set(ox + 8, oy + 11, 'lime')
                .rect(ox + 6, oy + 18, 8, 2, 'earth');
            // Wizard pointy hat perched on top
            pc.ellipse(ox + 10, oy + 7, 7, 2, 'plum')
                .line(ox + 5, oy + 7, ox + 15, oy + 7, 'violet')
                .line(ox + 7, oy + 6, ox + 13, oy + 6, 'plum')
                .line(ox + 8, oy + 5, ox + 12, oy + 5, 'violet')
                .line(ox + 9, oy + 4, ox + 11, oy + 4, 'plum')
                .set(ox + 10, oy + 3, 'violet')
                .set(ox + 11, oy + 2, 'gold') // golden star tip
                // Magical sparkles
                .set(ox + 2, oy + 5, 'yellow')
                .set(ox + 17, oy + 4, 'gold')
                .set(ox + 18, oy + 9, 'yellow');
            break;
        }
        case 'token-leaf': {
            // Golden circular coin / token
            pc.ellipse(ox + 10, oy + 11, 7, 7, 'gold')
                .ellipse(ox + 10, oy + 11, 5, 5, 'yellow')
                // Token 'T' glyph
                .rect(ox + 8, oy + 9, 5, 1, 'wood')
                .rect(ox + 10, oy + 10, 1, 3, 'wood')
                // Shiny glint
                .set(ox + 6, oy + 7, 'white').set(ox + 7, oy + 8, 'white');
            // Sprouting green eco leaf on top
            pc.line(ox + 10, oy + 5, ox + 10, oy + 2, 'leaf')
                .ellipse(ox + 13, oy + 2, 3, 2, 'lime')
                .ellipse(ox + 7, oy + 1, 3, 2, 'grass')
                .set(ox + 12, oy + 2, 'leaf')
                .set(ox + 8, oy + 1, 'leaf');
            break;
        }
        case 'gpu-flame': {
            // Dark green PCIe graphics card PCB
            pc.rect(ox + 1, oy + 6, 17, 10, 'forest')
                .rect(ox + 2, oy + 7, 15, 8, 'pine')
                // PCIe golden pins at bottom
                .rect(ox + 4, oy + 16, 11, 1, 'gold')
                // Dual cooling fans
                .ellipse(ox + 6, oy + 11, 3, 3, 'night').set(ox + 6, oy + 11, 'steel')
                .ellipse(ox + 13, oy + 11, 3, 3, 'night').set(ox + 13, oy + 11, 'steel')
                // Sizzling heat & frying pan with egg on top
                .line(ox + 4, oy + 4, ox + 15, oy + 4, 'slate')
                .line(ox + 15, oy + 4, ox + 18, oy + 2, 'steel') // pan handle
                // Fried egg
                .ellipse(ox + 9, oy + 3, 4, 2, 'white')
                .ellipse(ox + 9, oy + 3, 2, 1, 'gold')
                // Steam waves
                .set(ox + 6, oy + 1, 'cloud').set(ox + 7, oy + 0, 'cloud')
                .set(ox + 11, oy + 1, 'cloud').set(ox + 12, oy + 0, 'cloud');
            break;
        }
        case 'energy-can': {
            // Neon cyan / pink energy drink can
            pc.rect(ox + 6, oy + 4, 8, 14, 'navy')
                .rect(ox + 7, oy + 5, 6, 12, 'cyan')
                .rect(ox + 6, oy + 3, 8, 1, 'mist') // top lid
                .rect(ox + 8, oy + 2, 4, 1, 'cloud') // pull tab
                // Yellow lightning bolt on can
                .line(ox + 10, oy + 6, ox + 8, oy + 10, 'yellow')
                .line(ox + 8, oy + 10, ox + 11, oy + 10, 'gold')
                .line(ox + 11, oy + 10, ox + 9, oy + 15, 'yellow')
                // Fizz bubbles popping out
                .set(ox + 5, oy + 1, 'yellow')
                .set(ox + 12, oy + 0, 'pink')
                .set(ox + 14, oy + 3, 'cyan')
                .set(ox + 4, oy + 5, 'lime');
            break;
        }
        case 'crying-robot': {
            // Robot square head
            pc.rect(ox + 4, oy + 5, 12, 11, 'steel')
                .rect(ox + 5, oy + 6, 10, 9, 'cloud')
                // Antenna with red blinking LED
                .line(ox + 10, oy + 5, ox + 10, oy + 2, 'slate')
                .ellipse(ox + 10, oy + 1, 2, 2, 'red')
                // Sad eyes
                .rect(ox + 6, oy + 8, 2, 2, 'navy')
                .rect(ox + 12, oy + 8, 2, 2, 'navy')
                // Sad mouth
                .line(ox + 8, oy + 13, ox + 11, oy + 13, 'slate')
                // Blue streaming tears
                .line(ox + 6, oy + 10, ox + 6, oy + 16, 'cyan')
                .line(ox + 13, oy + 10, ox + 13, oy + 17, 'sky')
                .set(ox + 5, oy + 17, 'blue').set(ox + 14, oy + 18, 'blue');
            break;
        }
        case 'brain-glitch': {
            // Glowing violet brain
            pc.ellipse(ox + 9, oy + 10, 6, 5, 'plum')
                .ellipse(ox + 13, oy + 10, 5, 5, 'plum')
                .ellipse(ox + 8, oy + 9, 4, 4, 'pink')
                .ellipse(ox + 13, oy + 9, 4, 4, 'violet')
                .rect(ox + 9, oy + 12, 4, 4, 'plum')
                // Brain fold crevices
                .line(ox + 9, oy + 6, ox + 11, oy + 11, 'night')
                .line(ox + 6, oy + 10, ox + 8, oy + 12, 'night')
                // Question marks floating around
                .set(ox + 2, oy + 4, 'gold').set(ox + 3, oy + 3, 'gold').set(ox + 3, oy + 5, 'gold')
                .set(ox + 3, oy + 7, 'yellow')
                .set(ox + 16, oy + 3, 'cyan').set(ox + 17, oy + 2, 'cyan').set(ox + 17, oy + 4, 'cyan')
                .set(ox + 17, oy + 6, 'cyan');
            break;
        }
        case 'sleeping-bot': {
            // Sleeping bot head
            pc.rect(ox + 4, oy + 6, 12, 10, 'steel')
                .rect(ox + 5, oy + 7, 10, 8, 'mist')
                // Sleeping horizontal eyes (- -)
                .line(ox + 6, oy + 9, ox + 8, oy + 9, 'night')
                .line(ox + 11, oy + 9, ox + 13, oy + 9, 'night')
                // Cute smile
                .line(ox + 8, oy + 12, ox + 10, oy + 12, 'slate')
                // Floating Zzz
                .line(ox + 14, oy + 4, ox + 16, oy + 4, 'cyan')
                .line(ox + 14, oy + 5, ox + 16, oy + 5, 'cyan')
                .line(ox + 15, oy + 2, ox + 18, oy + 0, 'sky')
                // Dollar sign / coin bag beside it
                .ellipse(ox + 3, oy + 14, 3, 3, 'gold').set(ox + 3, oy + 14, 'wood');
            break;
        }
    }
}

/**
 * Creates the billboard chassis/frame canvas with animated marquee lights.
 * Marquee frame: 0, 1, or 2 for moving marquee lights.
 */
export function createBillboardFrame(frameIndex: number): PixelCanvas {
    const pc = new PixelCanvas(BILLBOARD_W, BILLBOARD_H);

    // --- SUPPORT POSTS & FOOTINGS (bottom) ---
    // Left post (x: 20..26, y: 49..71)
    pc.rect(20, 49, 7, 23, 'slate').rect(21, 49, 2, 23, 'steel').rect(25, 49, 2, 23, 'night');
    // Left post lattice diagonals
    for (let py = 51; py < 68; py += 5) {
        pc.line(20, py, 26, py + 4, 'night');
    }
    // Left concrete footing
    pc.rect(17, 68, 13, 5, 'earth').rect(18, 68, 11, 4, 'clay').rect(19, 68, 9, 1, 'sand')
        .set(20, 69, 'night').set(26, 69, 'night'); // anchor bolts

    // Right post (x: 91..97, y: 49..71)
    pc.rect(91, 49, 7, 23, 'slate').rect(92, 49, 2, 23, 'steel').rect(96, 49, 2, 23, 'night');
    // Right post lattice diagonals
    for (let py = 51; py < 68; py += 5) {
        pc.line(91, py, 97, py + 4, 'night');
    }
    // Right concrete footing
    pc.rect(88, 68, 13, 5, 'earth').rect(89, 68, 11, 4, 'clay').rect(90, 68, 9, 1, 'sand')
        .set(91, 69, 'night').set(97, 69, 'night'); // anchor bolts

    // --- MAIN BILLBOARD CHASSIS / BEZEL ---
    // Heavy outer frame
    pc.rect(4, 0, 110, 50, 'ink')
        .rect(5, 1, 108, 48, 'night')
        .rect(6, 2, 106, 46, 'slate')
        .rect(7, 3, 104, 44, 'night');

    // Inner screen cutout border
    pc.rect(SCREEN_OFFSET_X - 1, SCREEN_OFFSET_Y - 1, SCREEN_W + 2, SCREEN_H + 2, 'ink');

    // Rivets/bolts on the outer corners
    const rivets = [
        [7, 3], [109, 3], [7, 46], [109, 46],
        [32, 2], [58, 2], [84, 2],
        [32, 47], [84, 47],
    ];
    rivets.forEach(([rx, ry]) => {
        pc.set(rx, ry, 'steel').set(rx + 1, ry, 'cloud');
    });

    // Top antenna & red aviation warning beacon
    pc.line(59, 0, 59, 0, 'steel');
    const beaconOn = frameIndex % 2 === 0;
    pc.set(58, 0, beaconOn ? 'red' : 'wine')
        .set(59, 0, beaconOn ? 'peach' : 'red');

    // Top miniature solar cell bracket
    pc.rect(26, 0, 12, 2, 'navy').rect(27, 0, 10, 1, 'cyan');

    // Bottom nameplate banner
    const titleText = 'ATV AI-TRON DIGITAL';
    const tx = Math.floor((BILLBOARD_W - miniTextWidth(titleText)) / 2);
    miniText(pc, tx, 44, titleText, 'mist');

    // --- MARQUEE CHASE LIGHTS AROUND SCREEN PERIMETER ---
    // Top & bottom horizontal marquee lights
    const marqueeColors: ColorName[] = ['gold', 'yellow', 'night'];
    let lightCount = 0;
    for (let lx = SCREEN_OFFSET_X + 2; lx < SCREEN_OFFSET_X + SCREEN_W - 2; lx += 4) {
        const cTop = marqueeColors[(lightCount + frameIndex) % marqueeColors.length];
        const cBot = marqueeColors[(lightCount + frameIndex + 1) % marqueeColors.length];
        pc.set(lx, SCREEN_OFFSET_Y - 2, cTop);
        pc.set(lx, SCREEN_OFFSET_Y + SCREEN_H + 1, cBot);
        lightCount++;
    }
    // Left & right vertical marquee lights
    for (let ly = SCREEN_OFFSET_Y + 2; ly < SCREEN_OFFSET_Y + SCREEN_H - 2; ly += 4) {
        const cLeft = marqueeColors[(lightCount + frameIndex) % marqueeColors.length];
        const cRight = marqueeColors[(lightCount + frameIndex + 1) % marqueeColors.length];
        pc.set(SCREEN_OFFSET_X - 2, ly, cLeft);
        pc.set(SCREEN_OFFSET_X + SCREEN_W + 1, ly, cRight);
        lightCount++;
    }

    pc.outline('ink', true);
    return pc;
}

/**
 * Creates the 100x44 pixel art screen content for a specific AI ad.
 */
export function createAdScreen(ad: AIAd, adIndex: number, totalAds: number): PixelCanvas {
    const pc = new PixelCanvas(SCREEN_W, SCREEN_H);

    // Screen dark background with subtle horizontal scanlines
    for (let y = 0; y < SCREEN_H; y++) {
        const c = y % 2 === 0 ? 'ink' : 'night';
        pc.rect(0, y, SCREEN_W, 1, c);
    }

    // --- TOP STATUS BAR (y: 1..7) ---
    // Top separator line
    pc.line(0, 7, SCREEN_W - 1, 7, 'slate');

    // Category badge pill (x: 2..w)
    const badgeW = miniTextWidth(ad.badge) + 4;
    pc.rect(2, 1, badgeW, 6, 'slate').rect(3, 1, badgeW - 2, 5, 'ink');
    miniText(pc, 4, 2, ad.badge, ad.badgeColor);

    // Right: blinking status dot + "AD [X/Y]"
    pc.set(SCREEN_W - 38, 3, 'lime').set(SCREEN_W - 37, 3, 'white');
    const indexText = `AD ${adIndex + 1}/${totalAds}`;
    miniText(pc, SCREEN_W - 32, 2, indexText, 'mist');

    // --- LEFT SIDE: 22x22 ICON DISPLAY (x: 3..25, y: 10..32) ---
    // Recessed frame for icon
    pc.rect(3, 10, 22, 22, 'slate')
        .rect(4, 11, 20, 20, 'ink')
        .outline('night', false, { x: 3, y: 10, w: 22, h: 22 });
    drawAdIcon(pc, 4, 11, ad.icon);

    // Small decorative sub-meter under icon
    pc.rect(4, 34, 20, 2, 'slate')
        .rect(4, 34, 14, 2, ad.accentColor);
    miniText(pc, 6, 38, 'DEAL', 'gold');

    // --- RIGHT SIDE: AD COPY & PUNCHLINES (x: 28..98) ---
    const textLeft = 28;

    // Line 1: Brand / Product Name (y: 10)
    miniText(pc, textLeft, 10, ad.brand, ad.accentColor);

    // Line 2: Headline / Problem (y: 17)
    miniText(pc, textLeft, 17, ad.headline, 'white');

    // Line 3: Tagline / Funny punchline (y: 25)
    miniText(pc, textLeft, 25, ad.tagline, 'peach');

    // Line 4: Offer / Pricing CTA pill (y: 33)
    const offerW = miniTextWidth(ad.offer) + 6;
    pc.rect(textLeft, 33, offerW, 8, 'slate')
        .rect(textLeft + 1, 34, offerW - 2, 6, 'ink');
    miniText(pc, textLeft + 3, 35, ad.offer, ad.accentColor);

    return pc;
}

/** Ground shadow for the billboard posts. */
export function createBillboardShadow(): PixelCanvas {
    const pc = new PixelCanvas(BILLBOARD_W, 14);
    // Left post shadow
    pc.ellipse(24, 7, 14, 4, 'ink');
    // Right post shadow
    pc.ellipse(95, 7, 14, 4, 'ink');
    // Soft connecting structure shadow
    pc.ellipse(59, 7, 46, 3, 'night');
    return pc;
}
