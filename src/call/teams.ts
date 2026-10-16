/**
 * ATV World as a Teams meeting app. Everyone in the meeting who has ATV World open (in the side panel,
 * or on the stage once someone shares it there) sits down and codes in ATV HQ. Live Share presence
 * keeps everyone in sync. Teams hosts it, so there's no server to run and no secrets to keep.
 *
 * Each meeting gets its own Live Share session, so a meeting's HQ only ever holds that meeting. To show
 * one meeting on the public website too, type the website mirror key on the setup page: Save trades it for
 * a publish token that only works for that meeting, the tab's URL carries the token (?teams#hq=TOKEN), and
 * one client posts the roster to /api/hq (see ./relay.ts).
 *
 * Only loaded when the URL has ?teams (the Teams app's URLs do), so normal visits never download it.
 * The app package comes from ./teamsApp.ts (the call panel's "Add to Teams" button).
 */
import { LivePresence, LiveShareClient, PresenceState, type LivePresenceUser } from '@microsoft/live-share';
import { app, FrameContexts, LiveShareHost, meeting, pages } from '@microsoft/teams-js';
import type { IFluidContainer } from 'fluid-framework';
import { hashString } from '../game/kit';
import { mintToken, mirrorToken, publishMirror } from './relay';
import { call, type CallAction } from './roster';

/** How long a desk stays taken after Teams says someone left, so a reload or a network blip doesn't empty it. */
const GRACE_MS = 15_000;
const INIT_TIMEOUT_MS = 8_000;

/**
 * The page Teams shows in the meeting side panel and on the stage. A website mirror token rides in the
 * fragment (#hq=…), which browsers never send to servers, so it stays out of logs and Referer headers.
 */
export const contentUrl = (token = mirrorToken()) => `${location.origin}${location.pathname}?teams${token ? `#hq=${encodeURIComponent(token)}` : ''}`;

/** Callers are known by a hash of their Teams user ID: the same avatar everywhere, and raw IDs never leave Teams. */
const callerId = (userId: string) => `t:${hashString(userId).toString(36)}`;

const describe = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

const shareToStage: CallAction = {
    label: 'Share to stage',
    title: 'Put ATV World on the meeting stage, so everyone in the call shows up in HQ',
    run: () =>
        new Promise<void>((resolve, reject) => {
            meeting.shareAppContentToStage((error) => (error ? reject(new Error(error.message ?? `Teams error ${error.errorCode}`)) : resolve()), contentUrl());
        }),
};

/** `mode` is the ?teams= value: 'config' on the page Teams shows when the app is added to a meeting. */
export async function startTeams(mode: string | null): Promise<void> {
    call.setStatus({ kind: 'connecting', text: 'Connecting to Teams…' });
    try {
        await timeout(app.initialize(), INIT_TIMEOUT_MS);
    } catch {
        call.setStatus({ kind: 'error', text: "This page isn't open in Teams. Add ATV World to a Teams meeting to fill HQ with the call." });
        return;
    }
    const ctx = await app.getContext();
    if (mode === 'config' || ctx.page.frameContext === FrameContexts.settings) configure(ctx);
    else await joinCall(ctx);
}

/**
 * The page Teams shows when someone adds ATV World to a meeting. Save points the tab at the world. With the
 * website mirror key typed in, Save first trades it for a token that only works for this meeting, so the key
 * itself never goes into the tab's URL.
 */
function configure(ctx: app.Context) {
    let key = '';
    pages.config.registerOnSaveHandler((save) => {
        const meetingId = ctx.meeting?.id;
        if (key && !meetingId) {
            save.notifyFailure('The website mirror only works in a meeting. Clear the key to add ATV World here.');
            return;
        }
        (key && meetingId ? mintToken(key, meetingId) : Promise.resolve(''))
            .then((t) =>
                pages.config.setConfig({
                    contentUrl: contentUrl(t),
                    websiteUrl: `${location.origin}${location.pathname}`,
                    entityId: 'atv-hq',
                    suggestedDisplayName: 'ATV World',
                }),
            )
            .then(() => save.notifySuccess(), (e) => save.notifyFailure(describe(e)));
    });
    pages.config.setValidityState(true);
    call.setStatus({
        kind: 'config',
        text: 'Hit Save to add ATV World to this meeting. Everyone who opens it gets a desk in ATV HQ.',
        field: {
            label: 'To show this meeting on the public website too, enter the website mirror key (optional):',
            placeholder: 'Website mirror key',
            value: key,
            onChange: (value) => {
                key = value.trim();
            },
        },
    });
}

async function joinCall(ctx: app.Context) {
    const action = ctx.page.frameContext === FrameContexts.sidePanel ? shareToStage : undefined;
    call.setStatus({ kind: 'connecting', text: 'Joining the call…', action });

    const leaving = new Map<string, ReturnType<typeof setTimeout>>();
    const update = (user: LivePresenceUser) => {
        if (!user.userId) return;
        const id = callerId(user.userId);
        if (user.state === PresenceState.offline) {
            if (call.get(id) && !leaving.has(id)) {
                leaving.set(id, setTimeout(() => {
                    leaving.delete(id);
                    call.leave(id);
                }, GRACE_MS));
            }
            return;
        }
        clearTimeout(leaving.get(id));
        leaving.delete(id);
        call.join({ id, name: user.displayName || 'Teams guest', me: user.isLocalUser, source: 'teams' });
    };

    let container: IFluidContainer | undefined;
    let presence: LivePresence | undefined;
    try {
        const client = new LiveShareClient(LiveShareHost.create());
        ({ container } = await client.joinContainer({ initialObjects: { presence: LivePresence } }));
        presence = container.initialObjects.presence as LivePresence;
        presence.on('presenceChanged', update);
        await presence.initialize();
        presence.getUsers().forEach(update);
        call.setStatus({ kind: 'live', text: 'Live from your Teams meeting', action });
    } catch (e) {
        console.error('[ATV] Live Share failed:', e);
        // Undo anything half-joined, then fall back to just you.
        presence?.off('presenceChanged', update);
        leaving.forEach((t) => clearTimeout(t));
        leaving.clear();
        try {
            container?.dispose();
        } catch {
            // Already gone.
        }
        call.clear('teams');
        const me = ctx.user;
        call.join({ id: me?.id ? callerId(me.id) : 'teams:me', name: me?.displayName || 'You', me: true, source: 'teams' });
        call.setStatus({ kind: 'error', text: `Couldn't sync with the call (${describe(e)}), so it's just you for now.`, action });
        return;
    }

    // Set up with a website mirror token: show this meeting on the public website too.
    const token = mirrorToken();
    const meetingId = ctx.meeting?.id;
    if (!token || !meetingId || !presence) return;
    const live = presence;
    // One client per meeting posts: whoever's first by user ID among those online.
    const leader = () => {
        const me = live.localUser?.userId;
        const first = live.getUsers(PresenceState.online).map((u) => u.userId).filter(Boolean).sort()[0];
        return !!me && me === first;
    };
    let shown = '';
    const report = (problem: string | null) => {
        const text = problem ? `Live from your Teams meeting. ${problem}` : 'Live from your Teams meeting, and on the website too.';
        if (text !== shown) call.setStatus({ kind: 'live', text: (shown = text), action });
    };
    console.info('[ATV] Mirroring this meeting to the website. To pin it, set HQ_MEETING_ID to:', meetingId);
    publishMirror(token, meetingId, leader, report);
}
