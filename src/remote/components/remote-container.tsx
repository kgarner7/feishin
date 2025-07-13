import formatDuration from 'format-duration';
import debounce from 'lodash/debounce';
import { createRef, useCallback, useEffect, useRef } from 'react';
import { RiPauseFill, RiPlayFill, RiVolumeUpFill } from 'react-icons/ri';

import { createSilentAudio } from '/@/remote/components/create-silent-audio';
import { PlayerImage } from '/@/remote/components/player-image';
import { WrappedSlider } from '/@/remote/components/wrapped-slider';
import { useInfo, useMediaControl, useSend, useShowImage } from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { Rating } from '/@/shared/components/rating/rating';
import { Stack } from '/@/shared/components/stack/stack';
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
        <Stack gap="md" h="100dvh" w="100%">
            {showImage && (
                <Flex align="center" justify="center" w="100%">
                    <PlayerImage src={song?.imageUrl} />
                </Flex>
            )}
            {id && (
                <Stack gap="xs">
                    <Text
                        fw={700}
                        size="xl"
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {song.name}
                    </Text>
                    <Text
                        isMuted
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {song.album}
                    </Text>
                    <Text
                        isMuted
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {song.artistName}
                    </Text>
                    <Group justify="space-between">
                        {song.releaseDate && (
                            <Text isMuted>{new Date(song.releaseDate).toLocaleDateString()}</Text>
                        )}
                        <Text isMuted>Plays: {song.playCount}</Text>
                    </Group>
                </Stack>
            )}
            <Group gap={0} grow>
                <ActionIcon
                    disabled={!id}
                    icon="favorite"
                    iconProps={{
                        fill: song?.userFavorite ? 'primary' : 'default',
                    }}
                    onClick={() => {
                        if (!id) return;

                        send({ event: 'favorite', favorite: !song.userFavorite, id });
                    }}
                    tooltip={{
                        label: song?.userFavorite ? 'Unfavorite' : 'Favorite',
                    }}
                    variant="transparent"
                />
                {(song?.serverType === 'navidrome' || song?.serverType === 'subsonic') && (
                    <div style={{ margin: 'auto' }}>
                        <Tooltip label="Double click to clear" openDelay={1000}>
                            <Rating
                                onChange={debouncedSetRating}
                                onDoubleClick={() => debouncedSetRating(0)}
                                style={{ margin: 'auto' }}
                                value={song.userRating ?? 0}
                            />
                        </Tooltip>
                    </div>
                )}
            </Group>
            <Group gap="xs" grow>
                <ActionIcon
                    disabled={!id}
                    icon="mediaPrevious"
                    iconProps={{
                        fill: 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'previous' })}
                    size="xl"
                    tooltip={{
                        label: 'Previous track',
                    }}
                    variant="default"
                />
                <ActionIcon
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
                </ActionIcon>
                <ActionIcon
                    disabled={!id}
                    icon="mediaNext"
                    iconProps={{
                        fill: 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'next' })}
                    size="xl"
                    tooltip={{
                        label: 'Next track',
                    }}
                    variant="default"
                />
            </Group>
            <Group gap="xs" grow>
                <ActionIcon
                    icon="mediaShuffle"
                    iconProps={{
                        fill: shuffle ? 'primary' : 'default',
                        size: 'lg',
                    }}
                    onClick={() => send({ event: 'shuffle' })}
                    size="xl"
                    tooltip={{
                        label: shuffle ? 'Shuffle tracks' : 'Shuffle disabled',
                    }}
                    variant="default"
                />
                <ActionIcon
                    icon={
                        repeat === undefined || repeat === PlayerRepeat.ONE
                            ? 'mediaRepeatOne'
                            : 'mediaRepeat'
                    }
                    iconProps={{
                        fill:
                            repeat !== undefined && repeat !== PlayerRepeat.NONE
                                ? 'primary'
                                : 'default',
                        size: 'lg',
                    }}
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
                />
                <ActionIcon
                    disabled={!song}
                    icon="upload"
                    onClick={() => send({ event: 'saveQueue' })}
                    size="xl"
                    tooltip={{ label: 'Save queue' }}
                    variant="default"
                />

                <ActionIcon
                    icon="download"
                    onClick={() => send({ event: 'restoreQueue' })}
                    size="xl"
                    tooltip={{ label: 'Restore queue' }}
                    variant="default"
                />
            </Group>
            <Stack gap="lg">
                {id && position !== undefined && (
                    <WrappedSlider
                        label={(value) => formatDuration(value * 1e3)}
                        leftLabel={formatDuration(position * 1e3)}
                        max={song.duration / 1e3}
                        onChangeEnd={(e) => send({ event: 'position', position: e })}
                        rightLabel={formatDuration(song.duration)}
                        value={position}
                    />
                )}
                <WrappedSlider
                    leftLabel={<RiVolumeUpFill size={20} />}
                    max={100}
                    onChangeEnd={(e) => send({ event: 'volume', volume: e })}
                    rightLabel={
                        <Text fw={600} size="xs">
                            {volume ?? 0}
                        </Text>
                    }
                    value={volume ?? 0}
                />
                {control && <audio autoPlay ref={audioRef} src={audioObj.current} />}
            </Stack>
        </Stack>
    );
};
