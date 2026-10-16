/**
 * Builds the Teams app package (manifest + icons, zipped) right in the browser, pointing at the site
 * you're on, and downloads it. Upload it in Teams (Apps > Manage your apps > Upload an app), add
 * ATV World to a meeting, and share it to the stage: everyone on the call gets a desk in ATV HQ.
 */
import { PixelCanvas, miniText, type Color } from '../game/kit';

/** The same ID every time, so uploading a newer package updates the app instead of adding another. */
const APP_ID = '92ddf116-95f7-49bd-98da-277fba501a40';
const LIVE_SITE = 'https://calm-sea-064d9241e.3.azurestaticapps.net/';
const REPO = 'https://github.com/All-The-Vibes/ATV-world';
export const PACKAGE_NAME = 'atv-world-teams.zip';

/** Teams only loads HTTPS pages: use this site when it's HTTPS (the live site), otherwise the live site. */
const siteUrl = () => (location.protocol === 'https:' ? new URL(location.pathname, location.origin) : new URL(LIVE_SITE));

export function teamsManifest(site: URL = siteUrl()) {
    const base = site.href;
    return {
        $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json',
        manifestVersion: '1.17',
        version: '1.0.0',
        id: APP_ID,
        developer: { name: 'All The Vibes', websiteUrl: base, privacyUrl: REPO, termsOfUseUrl: REPO },
        name: { short: 'ATV World', full: 'ATV World: everyone on the call, coding in ATV HQ' },
        description: {
            short: 'Everyone on the call gets a pixel avatar, coding at a desk in ATV HQ.',
            full:
                'Add ATV World to a Teams meeting and share it to the stage. Everyone who has it open gets a random ' +
                'pixel avatar at a desk in ATV HQ, typing away with code scrolling on their screen. Lights flick on ' +
                'when someone joins and off when they leave, and the building grows a floor for every eight people. ' +
                'ATV World is an open pixel-art city built by the All The Vibes crew.',
        },
        icons: { color: 'color.png', outline: 'outline.png' },
        accentColor: '#14101E',
        configurableTabs: [
            {
                configurationUrl: `${base}?teams=config`,
                canUpdateConfiguration: true,
                scopes: ['groupChat', 'team'],
                context: ['meetingSidePanel', 'meetingStage', 'meetingChatTab', 'meetingDetailsTab'],
            },
        ],
        permissions: ['identity'],
        validDomains: [site.host],
        authorization: {
            permissions: {
                resourceSpecific: [
                    { name: 'LiveShareSession.ReadWrite.Chat', type: 'Delegated' },
                    { name: 'LiveShareSession.ReadWrite.Group', type: 'Delegated' },
                    { name: 'MeetingStage.Write.Chat', type: 'Delegated' },
                    { name: 'ChannelMeetingStage.Write.Group', type: 'Delegated' },
                ],
            },
        },
    };
}

/** 192×192 color icon: ATV HQ with four lit windows, someone coding in each. */
function colorIcon(): HTMLCanvasElement {
    const pc = new PixelCanvas(32, 32).rect(0, 0, 32, 32, 'night');
    pc.rect(9, 1, 14, 7, 'ink').rect(11, 6, 1, 3, 'slate').rect(20, 6, 1, 3, 'slate');
    miniText(pc, 10, 2, 'ATV', 'gold');
    pc.rect(4, 9, 24, 21, 'cloud').rect(4, 9, 24, 3, 'blue').rect(4, 9, 24, 1, 'sky').rect(4, 28, 24, 2, 'steel');
    const people: [Color, Color, Color][] = [['gold', 'peach', 'red'], ['ink', 'clay', 'lime'], ['red', 'sand', 'sky'], ['violet', 'wood', 'gold']];
    people.forEach(([hair, skin, shirt], i) => {
        const x = 6 + (i % 2) * 11, y = 13 + Math.floor(i / 2) * 8;
        pc.rect(x, y, 9, 7, 'navy').rect(x + 1, y + 1, 7, 5, 'cream');
        pc.rect(x + 5, y + 2, 3, 2, 'ink').set(x + 6, y + 2, 'lime');
        pc.rect(x + 2, y + 2, 2, 1, hair).rect(x + 2, y + 3, 2, 1, skin).rect(x + 1, y + 4, 4, 2, shirt);
    });
    return upscale(pc.outline('ink'), 6);
}

/** 32×32 outline icon (white on transparent, as Teams asks): the building and its four windows. */
function outlineIcon(): HTMLCanvasElement {
    const pc = new PixelCanvas(32, 32);
    const box = (x: number, y: number, w: number, h: number) =>
        pc.rect(x, y, w, 1, 'white').rect(x, y + h - 1, w, 1, 'white').rect(x, y, 1, h, 'white').rect(x + w - 1, y, 1, h, 'white');
    box(10, 1, 12, 6);
    pc.rect(12, 7, 1, 2, 'white').rect(19, 7, 1, 2, 'white');
    box(4, 9, 24, 21);
    pc.rect(4, 11, 24, 1, 'white');
    for (let i = 0; i < 4; i++) {
        const x = 7 + (i % 2) * 10, y = 14 + Math.floor(i / 2) * 8;
        box(x, y, 8, 6);
        pc.rect(x + 2, y + 2, 2, 2, 'white');
    }
    return pc.flush();
}

function upscale(pc: PixelCanvas, k: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = pc.width * k;
    out.height = pc.height * k;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pc.flush(), 0, 0, out.width, out.height);
    return out;
}

const png = (canvas: HTMLCanvasElement) =>
    new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) =>
        canvas.toBlob((b) => (b ? b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject) : reject(new Error('PNG failed'))), 'image/png'),
    );

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (const b of data) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** A stored (uncompressed) ZIP. The files are tiny, so there's nothing to gain from deflating them. */
function zip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]): Blob {
    const parts: BlobPart[] = [];
    const central: BlobPart[] = [];
    let offset = 0;
    let centralSize = 0;
    for (const f of files) {
        const name = new TextEncoder().encode(f.name);
        const crc = crc32(f.data);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(12, 0x21, true); // 1980-01-01
        local.setUint32(14, crc, true);
        local.setUint32(18, f.data.length, true);
        local.setUint32(22, f.data.length, true);
        local.setUint16(26, name.length, true);
        parts.push(local.buffer, name, f.data);

        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true);
        entry.setUint16(6, 20, true);
        entry.setUint16(14, 0x21, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, f.data.length, true);
        entry.setUint32(24, f.data.length, true);
        entry.setUint16(28, name.length, true);
        entry.setUint32(42, offset, true);
        central.push(entry.buffer, name);

        offset += 30 + name.length + f.data.length;
        centralSize += 46 + name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/** Build the package and download it as atv-world-teams.zip. */
export async function downloadTeamsApp(): Promise<void> {
    const blob = zip([
        { name: 'manifest.json', data: new TextEncoder().encode(`${JSON.stringify(teamsManifest(), null, 2)}\n`) },
        { name: 'color.png', data: await png(colorIcon()) },
        { name: 'outline.png', data: await png(outlineIcon()) },
    ]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = PACKAGE_NAME;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
