import { IpcRendererEvent, ipcRenderer } from 'electron';
import { SongUpdate } from '/@/renderer/types';

const requestFavorite = (
    cb: (
        event: IpcRendererEvent,
        data: { favorite: boolean; id: string; serverId: string },
    ) => void,
) => {
    ipcRenderer.on('request-favorite', cb);
};

const requestPosition = (cb: (event: IpcRendererEvent, data: { position: number }) => void) => {
    ipcRenderer.on('request-position', cb);
};

const requestRating = (
    cb: (event: IpcRendererEvent, data: { id: string; rating: number; serverId: string }) => void,
) => {
    ipcRenderer.on('request-rating', cb);
};

const requestSeek = (cb: (event: IpcRendererEvent, data: { offset: number }) => void) => {
    ipcRenderer.on('request-seek', cb);
};

const requestVolume = (cb: (event: IpcRendererEvent, data: { volume: number }) => void) => {
    ipcRenderer.on('request-volume', cb);
};

const requestSaveQueue = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('request-save-queue', cb);
};

const requestRestoreQueue = (cb: (event: IpcRendererEvent) => void) => {
    ipcRenderer.on('request-restore-queue', cb);
};

const setRemoteEnabled = (enabled: boolean): Promise<string | null> => {
    const result = ipcRenderer.invoke('remote-enable', enabled);
    return result;
};

const setRemotePort = (port: number): Promise<string | null> => {
    const result = ipcRenderer.invoke('remote-port', port);
    return result;
};

const updateFavorite = (favorite: boolean, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-favorite', favorite, serverId, ids);
};

const updatePassword = (password: string) => {
    ipcRenderer.send('remote-password', password);
};

const updateSetting = (
    enabled: boolean,
    port: number,
    username: string,
    password: string,
): Promise<string | null> => {
    return ipcRenderer.invoke('remote-settings', enabled, port, username, password);
};

const updateRating = (rating: number, serverId: string, ids: string[]) => {
    ipcRenderer.send('update-rating', rating, serverId, ids);
};

const updateRepeat = (repeat: string) => {
    ipcRenderer.send('update-repeat', repeat);
};

const updateShuffle = (shuffle: boolean) => {
    ipcRenderer.send('update-shuffle', shuffle);
};

const updateSong = (args: SongUpdate) => {
    ipcRenderer.send('update-song', args);
};

const updateUsername = (username: string) => {
    ipcRenderer.send('remote-username', username);
};

const updateVolume = (volume: number) => {
    ipcRenderer.send('update-volume', volume);
};

export const remote = {
    requestFavorite,
    requestPosition,
    requestRating,
    requestRestoreQueue,
    requestSaveQueue,
    requestSeek,
    requestVolume,
    setRemoteEnabled,
    setRemotePort,
    updateFavorite,
    updatePassword,
    updateRating,
    updateRepeat,
    updateSetting,
    updateShuffle,
    updateSong,
    updateUsername,
    updateVolume,
};

export type Remote = typeof remote;
