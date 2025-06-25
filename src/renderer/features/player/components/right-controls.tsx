import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import isElectron from 'is-electron';
import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '/@/renderer/api';
import { PlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';
import { usePlayQueueAdd } from '/@/renderer/features/player/hooks/use-playqueue-add';
import { useRightControls } from '/@/renderer/features/player/hooks/use-right-controls';
import { useCreateFavorite, useDeleteFavorite, useSetRating } from '/@/renderer/features/shared';
import {
    useAppStoreActions,
    useCurrentServer,
    useCurrentSong,
    useHotkeySettings,
    useLyricsStore,
    useMuted,
    usePlayerStore,
    usePreviousSong,
    useSettingsStore,
    useSidebarStore,
    useSpeed,
    useVolume,
} from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { DropdownMenu } from '/@/shared/components/dropdown-menu/dropdown-menu';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { Rating } from '/@/shared/components/rating/rating';
import { Slider } from '/@/shared/components/slider/slider';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, QueueSong, ServerType, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

const ipc = isElectron() ? window.api.ipc : null;
const remote = isElectron() ? window.api.remote : null;

interface RightControlsProps {
    seekRef: MutableRefObject<((position: number) => void) | undefined>;
}

export const RightControls = ({ seekRef }: RightControlsProps) => {
    const { t } = useTranslation();
    const isMinWidth = useMediaQuery('(max-width: 480px)');
    const volume = useVolume();
    const muted = useMuted();
    const server = useCurrentServer();
    const currentSong = useCurrentSong();
    const previousSong = usePreviousSong();
    const { setLyrics, setSideBar } = useAppStoreActions();
    const { rightExpanded: isQueueExpanded } = useSidebarStore();
    const { bindings } = useHotkeySettings();
    const {
        handleMute,
        handleSpeed,
        handleVolumeDown,
        handleVolumeSlider,
        handleVolumeUp,
        handleVolumeWheel,
    } = useRightControls();
    const { open } = useLyricsStore();

    const speed = useSpeed();
    const volumeWidth = useSettingsStore((state) => state.general.volumeWidth);

    const updateRatingMutation = useSetRating({});
    const addToFavoritesMutation = useCreateFavorite({});
    const removeFromFavoritesMutation = useDeleteFavorite({});
    const handlePlayQueueAdd = usePlayQueueAdd();
    const autosave = useSettingsStore((state) => state.playback.autoSave);
    const songCount = useRef(1);
    const priorSongId = useRef<string | undefined>();

    const handleAddToFavorites = (song: QueueSong | undefined) => {
        if (!song?.id) return;

        addToFavoritesMutation.mutate({
            query: {
                id: [song.id],
                type: LibraryItem.SONG,
            },
            serverId: song?.serverId,
        });
    };

    const handleUpdateRating = (rating: number) => {
        if (!currentSong) return;

        updateRatingMutation.mutate({
            query: {
                item: [currentSong],
                rating,
            },
            serverId: currentSong?.serverId,
        });
    };

    const handleRemoveFromFavorites = (song: QueueSong | undefined) => {
        if (!song?.id) return;

        removeFromFavoritesMutation.mutate({
            query: {
                id: [song.id],
                type: LibraryItem.SONG,
            },
            serverId: song?.serverId,
        });
    };

    const handleToggleFavorite = (song: QueueSong | undefined) => {
        if (!song?.id) return;

        if (song.userFavorite) {
            handleRemoveFromFavorites(song);
        } else {
            handleAddToFavorites(song);
        }
    };

    const handleToggleQueue = () => {
        setSideBar({ rightExpanded: !isQueueExpanded });
    };

    const handleToggleLyrics = () => {
        setLyrics({ open: !open });
    };

    const formatPlaybackSpeedSliderLabel = (value: number) => {
        const bpm = Number(currentSong?.bpm);
        if (bpm > 0) {
            return `${value} x / ${(bpm * value).toFixed(1)} BPM`;
        }
        return `${value} x`;
    };

    const isSongDefined = Boolean(currentSong?.id);
    const showRating = isSongDefined && server?.type === ServerType.NAVIDROME;

    const handleSaveQueue = useCallback(() => {
        if (server === null) return;

        const { current, queue } = usePlayerStore.getState();
        let songIds: string[] = [];

        if (queue.shuffled.length > 0) {
            const queueMapping: Record<string, QueueSong> = {};
            for (const song of queue.default) {
                queueMapping[song.uniqueId] = song;
            }
            for (const shuffledId of queue.shuffled) {
                songIds.push(queueMapping[shuffledId].id);
            }
        } else {
            songIds = queue.default.map((song) => song.id);
        }

        api.controller
            .savePlayQueue({
                apiClientProps: { server },
                query: {
                    current: current.song?.id,
                    currentIndex: current.index,
                    positionMs: current.song ? Math.round(current.time * 1000) : undefined,
                    songs: songIds,
                },
            })
            .then(() => {
                return toast.success({ message: '', title: 'Saved play queue' });
            })
            .catch((error) => {
                toast.error({
                    message: 'This is most likely because your queue is too large (> 1000 tracks)',
                    title: 'Failed to save play queue',
                });
                console.error(error);
            });
    }, [server]);

    useEffect(() => {
        if (autosave.enabled) {
            if (currentSong?.uniqueId !== priorSongId.current) {
                if (songCount.current === autosave.songCount) {
                    handleSaveQueue();
                    songCount.current = 1;
                } else {
                    songCount.current += 1;
                }

                priorSongId.current = currentSong?.uniqueId;
            }
        }
    }, [autosave.enabled, autosave.songCount, currentSong?.uniqueId, handleSaveQueue]);

    const handleRestoreQueue = useCallback(async () => {
        if (server === null) return;

        try {
            const queue = await api.controller.getPlayQueue({ apiClientProps: { server } });
            if (queue && handlePlayQueueAdd) {
                handlePlayQueueAdd({
                    byData: queue.entry,
                    initialIndex: queue.currentIndex,
                    playType: Play.NOW,
                });
            }

            if (seekRef.current) seekRef.current(queue.position ? queue.position / 1000 : 0);
        } catch (error) {
            toast.error({
                message: (error as Error).message,
                title: 'Failed to get play queue',
            });
        }
    }, [handlePlayQueueAdd, seekRef, server]);

    useHotkeys([
        [bindings.volumeDown.isGlobal ? '' : bindings.volumeDown.hotkey, handleVolumeDown],
        [bindings.volumeUp.isGlobal ? '' : bindings.volumeUp.hotkey, handleVolumeUp],
        [bindings.volumeMute.isGlobal ? '' : bindings.volumeMute.hotkey, handleMute],
        [bindings.toggleQueue.isGlobal ? '' : bindings.toggleQueue.hotkey, handleToggleQueue],
        [
            bindings.favoriteCurrentAdd.isGlobal ? '' : bindings.favoriteCurrentAdd.hotkey,
            () => handleAddToFavorites(currentSong),
        ],
        [
            bindings.favoriteCurrentRemove.isGlobal ? '' : bindings.favoriteCurrentRemove.hotkey,
            () => handleRemoveFromFavorites(currentSong),
        ],
        [
            bindings.favoriteCurrentToggle.isGlobal ? '' : bindings.favoriteCurrentToggle.hotkey,
            () => handleToggleFavorite(currentSong),
        ],
        [
            bindings.favoritePreviousAdd.isGlobal ? '' : bindings.favoritePreviousAdd.hotkey,
            () => handleAddToFavorites(previousSong),
        ],
        [
            bindings.favoritePreviousRemove.isGlobal ? '' : bindings.favoritePreviousRemove.hotkey,
            () => handleRemoveFromFavorites(previousSong),
        ],
        [
            bindings.favoritePreviousToggle.isGlobal ? '' : bindings.favoritePreviousToggle.hotkey,
            () => handleToggleFavorite(previousSong),
        ],
        [bindings.rate0.isGlobal ? '' : bindings.rate0.hotkey, () => handleUpdateRating(0)],
        [bindings.rate1.isGlobal ? '' : bindings.rate1.hotkey, () => handleUpdateRating(1)],
        [bindings.rate2.isGlobal ? '' : bindings.rate2.hotkey, () => handleUpdateRating(2)],
        [bindings.rate3.isGlobal ? '' : bindings.rate3.hotkey, () => handleUpdateRating(3)],
        [bindings.rate4.isGlobal ? '' : bindings.rate4.hotkey, () => handleUpdateRating(4)],
        [bindings.rate5.isGlobal ? '' : bindings.rate5.hotkey, () => handleUpdateRating(5)],
    ]);

    useEffect(() => {
        if (remote) {
            remote.requestFavorite((_event, { favorite, id, serverId }) => {
                const mutator = favorite ? addToFavoritesMutation : removeFromFavoritesMutation;
                mutator.mutate({
                    query: {
                        id: [id],
                        type: LibraryItem.SONG,
                    },
                    serverId,
                });
            });

            remote.requestRating((_event, { id, rating, serverId }) => {
                updateRatingMutation.mutate({
                    query: {
                        item: [
                            {
                                id,
                                itemType: LibraryItem.SONG,
                                serverId,
                            } as Song, // This is not a type-safe cast, but it works because those are all the prop
                        ],
                        rating,
                    },
                    serverId,
                });
            });

            remote.requestSaveQueue(() => {
                handleSaveQueue();
            });

            remote.requestRestoreQueue(() => {
                handleRestoreQueue();
            });

            return () => {
                ipc?.removeAllListeners('request-favorite');
                ipc?.removeAllListeners('request-rating');
                ipc?.removeAllListeners('request-save-queue');
                ipc?.removeAllListeners('request-restore-queue');
            };
        }

        return () => {};
    }, [
        addToFavoritesMutation,
        handleRestoreQueue,
        handleSaveQueue,
        removeFromFavoritesMutation,
        updateRatingMutation,
    ]);

    return (
        <Flex
            align="flex-end"
            direction="column"
            h="100%"
            px="1rem"
            py="0.5rem"
        >
            <Group h="calc(100% / 3)">
                {showRating && (
                    <Rating
                        onChange={handleUpdateRating}
                        size="xs"
                        value={currentSong?.userRating || 0}
                    />
                )}
            </Group>
            <Group
                align="center"
                gap="xs"
                wrap="nowrap"
            >
                <DropdownMenu
                    arrowOffset={12}
                    offset={0}
                    position="top-end"
                    width={425}
                    withArrow
                >
                    <DropdownMenu.Target>
                        <ActionIcon
                            icon="mediaSpeed"
                            iconProps={{
                                size: 'lg',
                            }}
                            size="sm"
                            tooltip={{
                                label: t('player.playbackSpeed', { postProcess: 'sentenceCase' }),
                                openDelay: 0,
                            }}
                            variant="subtle"
                        />
                    </DropdownMenu.Target>
                    <DropdownMenu.Dropdown>
                        <Slider
                            label={formatPlaybackSpeedSliderLabel}
                            marks={[
                                { label: '0.5', value: 0.5 },
                                { label: '0.75', value: 0.75 },
                                { label: '1', value: 1 },
                                { label: '1.25', value: 1.25 },
                                { label: '1.5', value: 1.5 },
                            ]}
                            max={1.5}
                            min={0.5}
                            onChange={handleSpeed}
                            onDoubleClick={() => handleSpeed(1)}
                            step={0.01}
                            styles={{
                                markLabel: {
                                    paddingTop: '0.5rem',
                                },
                                root: {
                                    margin: '1rem 1rem 2rem 1rem',
                                },
                            }}
                            value={speed}
                        />
                    </DropdownMenu.Dropdown>
                </DropdownMenu>
                <ActionIcon
                    icon="favorite"
                    iconProps={{
                        fill: currentSong?.userFavorite ? 'primary' : undefined,
                        size: 'lg',
                    }}
                    onClick={() => handleToggleFavorite(currentSong)}
                    size="sm"
                    tooltip={{
                        label: currentSong?.userFavorite
                            ? t('player.unfavorite', { postProcess: 'titleCase' })
                            : t('player.favorite', { postProcess: 'titleCase' }),
                        openDelay: 0,
                    }}
                    variant="subtle"
                />
                <ActionIcon
                    icon={isQueueExpanded ? 'panelRightClose' : 'panelRightOpen'}
                    iconProps={{
                        size: 'lg',
                    }}
                    onClick={handleToggleQueue}
                    size="sm"
                    tooltip={{
                        label: t('player.viewQueue', { postProcess: 'titleCase' }),
                        openDelay: 0,
                    }}
                    variant="subtle"
                />
                {server && (
                    <>
                        <ActionIcon
                            icon="upload"
                            onClick={handleSaveQueue}
                            tooltip={{ label: 'Save queue', openDelay: 500 }}
                            variant="transparent"
                        />
                        <ActionIcon
                            icon="download"
                            onClick={handleRestoreQueue}
                            tooltip={{ label: 'Restore queue', openDelay: 500 }}
                            variant="transparent"
                        />
                    </>
                )}
                {!isMinWidth ? (
                    <ActionIcon
                        icon="lyrics"
                        onClick={handleToggleLyrics}
                        tooltip={{
                            label: t('player.show_lyrics', { postProcess: 'titleCase' }),
                            openDelay: 500,
                        }}
                        variant="transparent"
                    />
                ) : null}
                <ActionIcon
                    icon={muted ? 'volumeMute' : volume > 50 ? 'volumeMax' : 'volumeNormal'}
                    iconProps={{
                        color: muted ? 'muted' : undefined,
                        size: 'xl',
                    }}
                    onClick={handleMute}
                    onWheel={handleVolumeWheel}
                    size="sm"
                    tooltip={{
                        label: muted ? t('player.muted', { postProcess: 'titleCase' }) : volume,
                        openDelay: 0,
                    }}
                    variant="subtle"
                />
                {!isMinWidth ? (
                    <PlayerbarSlider
                        max={100}
                        min={0}
                        onChange={handleVolumeSlider}
                        onWheel={handleVolumeWheel}
                        size={6}
                        value={volume}
                        w={volumeWidth}
                    />
                ) : null}
            </Group>
            <Group h="calc(100% / 3)" />
        </Flex>
    );
};
