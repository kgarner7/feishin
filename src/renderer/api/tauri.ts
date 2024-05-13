import { createClient } from '@rspc/client';
import { TauriTransport } from '@rspc/tauri';
import type { Procedures } from '/@/generated/tauri';
import type { MpvPLayer } from '/@/main/preload/mpv-player';
import { PlayerData } from '/@/renderer/store';

export const client = createClient<Procedures>({
    transport: new TauriTransport(),
});

client.addSubscription(['mpv.status', []], (resp) => {
    console.log(resp);
});

function toString(o) {
    Object.keys(o).forEach((k) => {
        if (typeof o[k] === 'object') {
            toString(o[k]);
        }

        o[k] = `${o[k]}`;
    });

    return o;
}

export const mpvPlayer: MpvPLayer = {
    autoNext: (data: PlayerData) => {
        client
            .mutation(['mpv.auto-next', data.queue.next?.streamUrl ?? null])
            .catch((arg) => console.error('auto-next', arg));
    },
    cleanup: () => {
        return new Promise<void>((resolve) => {
            resolve();
        });
    },
    currentTime: () => {},

    getCurrentTime: async () => {
        return client.query(['mpv.time']);
    },

    initialize: (data: { extraParameters?: string[]; properties?: Record<string, any> }) => {
        console.log(data);
        return client.mutation(['mpv.initialize']);
    },

    isRunning: () => {
        return new Promise((resolve) => {
            resolve(false);
        });
    },

    mute: (mute: boolean) => {
        client.mutation(['mpv.mute', mute]).catch((arg) => console.error('mute', arg));
    },

    next: () => {
        client.mutation(['mpv.next']).catch((arg) => console.error('next', arg));
    },

    pause: () => {
        client.mutation(['mpv.pause']).catch((arg) => console.error('pause', arg));
    },

    play: () => {
        client.mutation(['mpv.play']).catch((arg) => console.error('play', arg));
    },

    previous: () => {
        client.mutation(['mpv.previous']).catch((arg) => console.error('previous', arg));
    },

    quit: () => {
        client.mutation(['mpv.quit']).catch((arg) => console.error('quit', arg));
    },

    restart: (data: {
        binaryPath?: string;
        extraParameters?: string[];
        properties?: Record<string, any>;
    }) => {
        return new Promise<void>((resolve) => {
            console.log(data);
            resolve();
        });
    },

    seek: (seconds: number) => {
        client.mutation(['mpv.seek', seconds]).catch((arg) => console.error('seek', arg));
    },

    seekTo: (seconds: number) => {
        client.mutation(['mpv.seek-to', seconds]).catch((arg) => console.error('seek-to', arg));
    },

    setProperties: (data: Record<string, any>) => {
        client
            .mutation(['mpv.set-properties', toString(data)])
            .catch((arg) => console.error('set-properties', arg));
    },

    setQueue: (data: PlayerData, pause?: boolean) => {
        client
            .mutation([
                'mpv.set-queue',
                {
                    current: data.queue.current?.streamUrl ?? null,
                    next: data.queue.next?.streamUrl ?? null,
                    pause: pause ?? null,
                },
            ])
            .catch((arg) => console.error('set-queue', arg));
    },

    setQueueNext: (data: PlayerData) => {
        client
            .mutation(['mpv.set-queue-next', data.queue.next?.streamUrl ?? null])
            .catch((arg) => console.error('set-queue-next', arg));
    },

    stop: () => {
        client.mutation(['mpv.stop']).catch((arg) => console.error('stop', arg));
    },

    volume: (value?: number) => {
        client.mutation(['mpv.volume', value ?? 50]).catch((arg) => console.error('volume', arg));
    },
};

export const getMpvPlayer = () => {
    return window.__TAURI__ ? mpvPlayer : null;
};
