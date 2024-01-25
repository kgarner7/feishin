import { MutableRefObject, useCallback, useEffect } from 'react';
import { Flex, Group } from '@mantine/core';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import isElectron from 'is-electron';
import { useTranslation } from 'react-i18next';
import { HiOutlineQueueList } from 'react-icons/hi2';
import { MdOutlineLyrics } from 'react-icons/md';
import {
    RiVolumeUpFill,
    RiVolumeDownFill,
    RiVolumeMuteFill,
    RiHeartLine,
    RiHeartFill,
    RiUploadCloud2Line,
    RiUploadCloud2Fill,
    RiDownloadCloud2Fill,
} from 'react-icons/ri';
import {
    useAppStoreActions,
    useCurrentServer,
    useCurrentSong,
    useHotkeySettings,
    useLyricsStore,
    useMuted,
    usePlayerStore,
    usePreviousSong,
    useSidebarStore,
    useSpeed,
    useVolume,
} from '/@/renderer/store';
import { useRightControls } from '../hooks/use-right-controls';
import { PlayerButton } from './player-button';
import { LibraryItem, QueueSong, ServerType, Song } from '/@/renderer/api/types';
import { useCreateFavorite, useDeleteFavorite, useSetRating } from '/@/renderer/features/shared';
import { DropdownMenu, Rating, toast } from '/@/renderer/components';
import { PlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';
import { api } from '/@/renderer/api';
import { usePlayQueueAdd } from '/@/renderer/features/player/hooks/use-playqueue-add';
import { Play } from '/@/renderer/types';
import { Slider } from '/@/renderer/components/slider';

const ipc = isElectron() ? window.electron.ipc : null;
const remote = isElectron() ? window.electron.remote : null;

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
    const { setSideBar, setLyrics } = useAppStoreActions();
    const { rightExpanded: isQueueExpanded } = useSidebarStore();
    const { bindings } = useHotkeySettings();
    const {
        handleVolumeSlider,
        handleVolumeWheel,
        handleMute,
        handleVolumeDown,
        handleVolumeUp,
        handleSpeed,
    } = useRightControls();
    const { open } = useLyricsStore();

    const speed = useSpeed();

    const updateRatingMutation = useSetRating({});
    const addToFavoritesMutation = useCreateFavorite({});
    const removeFromFavoritesMutation = useDeleteFavorite({});
    const handlePlayQueueAdd = usePlayQueueAdd();

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

    const handleSavePosition = useCallback(() => {
        if (server === null) return;

        const { current } = usePlayerStore.getState();

        api.controller
            .savePlayQueue2({
                apiClientProps: { server },
                query: {
                    current: current.song?.id,
                    currentIndex: current.index,
                    positionMs: current.song ? Math.round(current.time * 1000) : undefined,
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

    const handleRestoreQueue = useCallback(async () => {
        if (server === null) return;

        const queue = await api.controller.getPlayQueue({ apiClientProps: { server } });
        if (queue && handlePlayQueueAdd) {
            await handlePlayQueueAdd({
                byData: queue.entry,
                initialIndex: queue.currentIndex,
                playType: Play.NOW,
            });

            if (seekRef.current) seekRef.current(queue.position ? queue.position / 1000 : 0);
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

            remote.requestSavePosition(() => {
                handleSavePosition();
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
                ipc?.removeAllListeners('request-save-position');
                ipc?.removeAllListeners('request-save-queue');
                ipc?.removeAllListeners('request-restore-queue');
            };
        }

        return () => {};
    }, [
        addToFavoritesMutation,
        handleRestoreQueue,
        handleSavePosition,
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
                        size="sm"
                        value={currentSong?.userRating || 0}
                        onChange={handleUpdateRating}
                    />
                )}
            </Group>
            <Group
                noWrap
                align="center"
                spacing="xs"
            >
                <DropdownMenu
                    withArrow
                    arrowOffset={12}
                    offset={0}
                    position="top-end"
                    width={425}
                >
                    <DropdownMenu.Target>
                        <PlayerButton
                            icon={<>{speed} x</>}
                            tooltip={{
                                label: t('player.playbackSpeed', { postProcess: 'sentenceCase' }),
                                openDelay: 500,
                            }}
                            variant="secondary"
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
                            onChange={handleSpeed}
                            onDoubleClick={() => handleSpeed(1)}
                        />
                    </DropdownMenu.Dropdown>
                </DropdownMenu>
                <PlayerButton
                    icon={
                        currentSong?.userFavorite ? (
                            <RiHeartFill
                                color="var(--primary-color)"
                                size="1.1rem"
                            />
                        ) : (
                            <RiHeartLine size="1.1rem" />
                        )
                    }
                    sx={{
                        svg: {
                            fill: !currentSong?.userFavorite
                                ? undefined
                                : 'var(--primary-color) !important',
                        },
                    }}
                    tooltip={{
                        label: currentSong?.userFavorite
                            ? t('player.unfavorite', { postProcess: 'titleCase' })
                            : t('player.favorite', { postProcess: 'titleCase' }),
                        openDelay: 500,
                    }}
                    variant="secondary"
                    onClick={() => handleToggleFavorite(currentSong)}
                />
                <PlayerButton
                    icon={<HiOutlineQueueList size="1.1rem" />}
                    tooltip={{ label: 'View queue', openDelay: 500 }}
                    variant="secondary"
                    onClick={handleToggleQueue}
                />
                {server && (
                    <>
                        <PlayerButton
                            icon={<RiUploadCloud2Line size="1.1rem" />}
                            tooltip={{ label: 'Save queue position', openDelay: 500 }}
                            variant="secondary"
                            onClick={handleSavePosition}
                        />
                        <PlayerButton
                            icon={<RiUploadCloud2Fill size="1.1rem" />}
                            tooltip={{ label: 'Save queue', openDelay: 500 }}
                            variant="secondary"
                            onClick={handleSaveQueue}
                        />
                        <PlayerButton
                            icon={<RiDownloadCloud2Fill size="1.1rem" />}
                            tooltip={{ label: 'Restore queue', openDelay: 500 }}
                            variant="secondary"
                            onClick={handleRestoreQueue}
                        />
                    </>
                )}
                {!isMinWidth ? (
                    <PlayerButton
                        icon={<HiOutlineQueueList size="1.1rem" />}
                        tooltip={{ label: 'View queue', openDelay: 500 }}
                        variant="secondary"
                        onClick={handleToggleQueue}
                    />
                ) : null}
                {!isMinWidth ? (
                    <PlayerButton
                        icon={<MdOutlineLyrics size="1.1rem" />}
                        tooltip={{
                            label: t('player.show_lyrics', { postProcess: 'titleCase' }),
                            openDelay: 500,
                        }}
                        variant="secondary"
                        onClick={handleToggleLyrics}
                    />
                ) : null}
                <Group
                    noWrap
                    spacing="xs"
                >
                    <PlayerButton
                        icon={
                            muted ? (
                                <RiVolumeMuteFill size="1.2rem" />
                            ) : volume > 50 ? (
                                <RiVolumeUpFill size="1.2rem" />
                            ) : (
                                <RiVolumeDownFill size="1.2rem" />
                            )
                        }
                        tooltip={{
                            label: muted ? t('player.muted', { postProcess: 'titleCase' }) : volume,
                            openDelay: 500,
                        }}
                        variant="secondary"
                        onClick={handleMute}
                        onWheel={handleVolumeWheel}
                    />
                    {!isMinWidth ? (
                        <PlayerbarSlider
                            max={100}
                            min={0}
                            size={6}
                            value={volume}
                            w="60px"
                            onChange={handleVolumeSlider}
                            onWheel={handleVolumeWheel}
                        />
                    ) : null}
                </Group>
            </Group>
            <Group h="calc(100% / 3)" />
        </Flex>
    );
};
