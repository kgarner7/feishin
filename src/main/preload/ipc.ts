import { ipcRenderer } from 'electron';

const removeAllListeners = (channel: string) => {
    if (ipcRenderer) {
        ipcRenderer.removeAllListeners(channel);
    } else {
        console.error('ipc renderer is gone');
    }
};

const send = (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
};

export const ipc = {
    removeAllListeners,
    send,
};

export type Ipc = typeof ipc;
