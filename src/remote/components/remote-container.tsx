import { Image, Title } from '@mantine/core';
import formatDuration from 'format-duration';
import debounce from 'lodash/debounce';
import { createRef, useCallback, useEffect, useRef } from 'react';
import {
    RiDownloadCloud2Fill,
    RiHeartLine,
    RiPauseFill,
    RiPlayFill,
    RiRepeat2Line,
    RiRepeatOneLine,
    RiShuffleFill,
    RiSkipBackFill,
    RiSkipForwardFill,
    RiUploadCloud2Fill,
    RiVolumeUpFill,
} from 'react-icons/ri';

import { RemoteButton } from '/@/remote/components/buttons/remote-button';
import { createSilentAudio } from '/@/remote/components/create-silent-audio';
import { WrapperSlider } from '/@/remote/components/wrapped-slider';
import { useInfo, useMediaControl, useSend, useShowImage } from '/@/remote/store';
import { Group } from '/@/shared/components/group/group';
import { Rating } from '/@/shared/components/rating/rating';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { PlayerRepeat, PlayerStatus } from '/@/shared/types/types';

const MEDIA_EVENTS: MediaSessionAction[] = [
    'pause',
    'play',
    'nexttrack',
    'previoustrack',
    'seekto',
];

export const RemoteContainer = () => {
    const { position, repeat, shuffle, song, status, volume } = useInfo();
    const send = useSend();
    const control = useMediaControl();
    const showImage = useShowImage();
    const audioObj = useRef<string>();
    const audioRef = createRef<HTMLAudioElement>();

    useEffect(() => {
        if (!control) {
            return () => {};
        }

        const audioSrc = song?.duration ? createSilentAudio(song.duration / 1000, 8000) : undefined;
        audioObj.current = audioSrc;

        return () => {
            if (audioSrc) {
                URL.revokeObjectURL(audioSrc);
            }
        };
    }, [control, song?.duration]);

    const id = song?.id;

    const setMetadata = useCallback(() => {
        if (!song) {
            navigator.mediaSession.metadata = null;
            return;
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            album: song.album || undefined,
            artist: song.artistName,
            artwork: [{ src: song.imageUrl || '' }],
            title: song.name,
        });
    }, [song]);

    useEffect(() => {
        if (control) {
            navigator.mediaSession.setActionHandler('pause', () => {
                send({ event: 'pause' });
            });

            navigator.mediaSession.setActionHandler('play', () => {
                send({ event: 'play' });
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                send({ event: 'next' });
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                send({ event: 'previous' });
            });

            navigator.mediaSession.setActionHandler('seekto', (evt) => {
                if (evt.seekTime !== undefined) {
                    send({ event: 'position', position: evt.seekTime });
                }
            });

            return () => {
                for (const event of MEDIA_EVENTS) {
                    navigator.mediaSession.setActionHandler(event, null);
                }
            };
        }

        return () => {};
    }, [audioRef, control, send]);

    useEffect(() => {
        if (audioRef.current) {
            if (status === PlayerStatus.PLAYING) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    }, [audioRef, status]);

    useEffect(() => {
        if (audioRef.current) {
            if (position !== undefined && song?.duration !== undefined) {
                if (Math.abs(audioRef.current.currentTime - position) >= 0.3) {
                    audioRef.current.currentTime = position;
                }
            }
        }
    }, [audioRef, position, song?.duration]);

    useEffect(() => {
        setMetadata();
    }, [setMetadata]);

    const setRating = useCallback(
        (rating: number) => {
            send({ event: 'rating', id: id!, rating });
        },
        [send, id],
    );

    const debouncedSetRating = debounce(setRating, 400);

    return (
        <>
            {id && (
                <>
                    <Title order={1}>{song.name}</Title>
                    <Group align="flex-end">
                        <Title order={2}>Album: {song.album}</Title>
                        <Title order={2}>Artist: {song.artistName}</Title>
                    </Group>
                    <Group justify="space-between">
                        <Title order={3}>Duration: {formatDuration(song.duration)}</Title>
                        {song.releaseDate && (
                            <Title order={3}>
                                Released: {new Date(song.releaseDate).toLocaleDateString()}
                            </Title>
                        )}
                        <Title order={3}>Plays: {song.playCount}</Title>
                    </Group>
                </>
            )}
            <Group
                gap={0}
                grow
            >
                <RemoteButton
                    disabled={!id}
                    onClick={() => send({ event: 'previous' })}
                    size="xl"
                    tooltip={{
                        label: 'Previous track',
                    }}
                    variant="default"
                >
                    <RiSkipBackFill size={25} />
                </RemoteButton>
                <RemoteButton
                    disabled={!id}
                    onClick={() => {
                        setMetadata();
                        if (status === PlayerStatus.PLAYING) {
                            send({ event: 'pause' });
                        } else if (status === PlayerStatus.PAUSED) {
                            send({ event: 'play' });
                        }
                    }}
                    size="xl"
                    tooltip={{
                        label: id && status === PlayerStatus.PLAYING ? 'Pause' : 'Play',
                    }}
                    variant="default"
                >
                    {id && status === PlayerStatus.PLAYING ? (
                        <RiPauseFill size={25} />
                    ) : (
                        <RiPlayFill size={25} />
                    )}
                </RemoteButton>
                <RemoteButton
                    disabled={!id}
                    onClick={() => send({ event: 'next' })}
                    size="xl"
                    tooltip={{
                        label: 'Next track',
                    }}
                >
                    <RiSkipForwardFill size={25} />
                </RemoteButton>
            </Group>
            <Group
                gap={0}
                grow
            >
                <RemoteButton
                    isActive={shuffle || false}
                    onClick={() => send({ event: 'shuffle' })}
                    size="xl"
                    tooltip={{
                        label: shuffle ? 'Shuffle tracks' : 'Shuffle disabled',
                    }}
                    variant="default"
                >
                    <RiShuffleFill size={25} />
                </RemoteButton>
                <RemoteButton
                    isActive={repeat !== undefined && repeat !== PlayerRepeat.NONE}
                    onClick={() => send({ event: 'repeat' })}
                    size="xl"
                    tooltip={{
                        label: `Repeat ${
                            repeat === PlayerRepeat.ONE
                                ? 'One'
                                : repeat === PlayerRepeat.ALL
                                  ? 'all'
                                  : 'none'
                        }`,
                    }}
                    variant="default"
                >
                    {repeat === undefined || repeat === PlayerRepeat.ONE ? (
                        <RiRepeatOneLine size={25} />
                    ) : (
                        <RiRepeat2Line size={25} />
                    )}
                </RemoteButton>
                <RemoteButton
                    disabled={!id}
                    isActive={song?.userFavorite}
                    onClick={() => {
                        if (!id) return;

                        send({ event: 'favorite', favorite: !song.userFavorite, id });
                    }}
                    size="xl"
                    tooltip={{
                        label: song?.userFavorite ? 'Unfavorite' : 'Favorite',
                    }}
                    variant="default"
                >
                    <RiHeartLine size={25} />
                </RemoteButton>
            </Group>
            <Group
                gap={0}
                grow
            >
                {(song?.serverType === 'navidrome' || song?.serverType === 'subsonic') && (
                    <div style={{ margin: 'auto' }}>
                        <Tooltip
                            label="Double click to clear"
                            openDelay={1000}
                        >
                            <Rating
                                onChange={debouncedSetRating}
                                onDoubleClick={() => debouncedSetRating(0)}
                                size="md"
                                style={{ margin: 'auto' }}
                                value={song.userRating ?? 0}
                            />
                        </Tooltip>
                    </div>
                )}
                <RemoteButton
                    disabled={!song}
                    onClick={() => send({ event: 'saveQueue' })}
                    size="xl"
                    tooltip={{ label: 'Save queue' }}
                    variant="default"
                >
                    <RiUploadCloud2Fill size={25} />
                </RemoteButton>

                <RemoteButton
                    onClick={() => send({ event: 'restoreQueue' })}
                    size="xl"
                    tooltip={{ label: 'Restore queue' }}
                    variant="default"
                >
                    <RiDownloadCloud2Fill size={25} />
                </RemoteButton>
            </Group>
            {id && position !== undefined && (
                <WrapperSlider
                    label={(value) => formatDuration(value * 1e3)}
                    leftLabel={formatDuration(position * 1e3)}
                    max={song.duration / 1e3}
                    onChangeEnd={(e) => send({ event: 'position', position: e })}
                    rightLabel={formatDuration(song.duration)}
                    value={position}
                />
            )}
            <WrapperSlider
                leftLabel={<RiVolumeUpFill size={20} />}
                max={100}
                onChangeEnd={(e) => send({ event: 'volume', volume: e })}
                rightLabel={
                    <Text
                        fw={600}
                        size="xs"
                    >
                        {volume ?? 0}
                    </Text>
                }
                value={volume ?? 0}
            />
            {control && (
                <audio
                    autoPlay
                    ref={audioRef}
                    src={audioObj.current}
                />
            )}
            {showImage && (
                <Image
                    onError={() => send({ event: 'proxy' })}
                    src={song?.imageUrl?.replaceAll(/&(size|width|height=\d+)/g, '')}
                />
            )}
        </>
    );
};
