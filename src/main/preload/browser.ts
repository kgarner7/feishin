import { ipcRenderer } from 'electron';

const exit = () => {
    ipcRenderer.send('window-close');
};
const maximize = () => {
    ipcRenderer.send('window-maximize');
};
const minimize = () => {
    ipcRenderer.send('window-minimize');
};
const unmaximize = () => {
    ipcRenderer.send('window-unmaximize');
};

const devtools = () => {
    ipcRenderer.send('window-dev-tools');
};

const ssoLogin = async (url: string): Promise<void> => {
    return ipcRenderer.invoke('sso-login', url);
};

export const browser = {
    devtools,
    exit,
    maximize,
    minimize,
    ssoLogin,
    unmaximize,
};

export type Browser = typeof browser;
