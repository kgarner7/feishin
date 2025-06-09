import { ServerEvent } from '/@/shared/types/remote-types';

export interface WorkerConnected {
    event: 'connect';
}

export interface WorkerDisconnected {
    action: 'down' | 'other' | 'reload' | 'unnatural';
    event: 'disconnect';
    natural: boolean;
}

export type WorkerEvent = WorkerConnected | WorkerDisconnected | WorkerMessage;

export interface WorkerMessage {
    data: ServerEvent;
    event: 'message';
}
