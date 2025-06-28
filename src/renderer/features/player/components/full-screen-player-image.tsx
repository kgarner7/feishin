import { useSetState } from '@mantine/hooks';
import clsx from 'clsx';
import { AnimatePresence, HTMLMotionProps, motion } from 'motion/react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { generatePath } from 'react-router';
import { Link } from 'react-router-dom';

import styles from './full-screen-player-image.module.css';

import { useFastAverageColor } from '/@/renderer/hooks';
import { AppRoute } from '/@/renderer/router/routes';
import { usePlayerData, usePlayerStore } from '/@/renderer/store';
import { useSettingsStore } from '/@/renderer/store/settings.store';
import { Badge } from '/@/shared/components/badge/badge';
import { Center } from '/@/shared/components/center/center';
import { Flex } from '/@/shared/components/flex/flex';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { Text } from '/@/shared/components/text/text';
import { PlayerData, QueueSong } from '/@/shared/types/domain-types';

const scaleImageUrl = (imageSize: number, url?: null | string) => {
    return url
        ?.replace(/&size=\d+/, `&size=${imageSize}`)
        .replace(/\?width=\d+/, `?width=${imageSize}`)
        .replace(/&height=\d+/, `&height=${imageSize}`);
};

const MotionImage = motion.img;

const ImageWithPlaceholder = ({
    blur,
    className,
    style,
    ...props
}: HTMLMotionProps<'img'> & { blur?: boolean; placeholder?: string }) => {
    const nativeAspectRatio = useSettingsStore((store) => store.general.nativeAspectRatio);

    if (!props.src) {
        return (
            <Center
                style={{
                    background: 'var(--theme-colors-surface)',
                    borderRadius: 'var(--theme-card-default-radius)',
                    height: '100%',
                    width: '100%',
                }}
            >
                <Icon
                    color="muted"
                    icon="itemAlbum"
                    size="25%"
                />
            </Center>
        );
    }

    return (
        <MotionImage
            className={clsx(styles.image, className)}
            style={{
                ...style,
                filter: blur
                    ? `blur(${Math.max(window.innerHeight, window.innerWidth) / 40}px)`
                    : undefined,
                objectFit: nativeAspectRatio ? 'contain' : 'cover',
                width: nativeAspectRatio ? 'auto' : '100%',
            }}
            {...props}
        />
    );
};

type ImageImfo = [string | undefined, boolean | undefined];
interface ImageState {
    bottomImage: ImageImfo;
    current: 0 | 1;
    topImage: ImageImfo;
}

export const FullScreenPlayerImage = () => {
    const mainImageRef = useRef<HTMLImageElement | null>(null);
    const [mainImageDimensions, setMainImageDimensions] = useState({ idealSize: 1 });

    const albumArtRes = useSettingsStore((store) => store.general.albumArtRes);
    const blurExplicit = useSettingsStore((store) => store.general.blurExplicit);

    const { queue } = usePlayerData();
    const currentSong = queue.current;
    const { background } = useFastAverageColor({
        algorithm: 'dominant',
        src: queue.current?.imageUrl,
        srcLoaded: true,
    });
    const imageKey = `image-${background}`;
    const [imageState, setImageState] = useSetState<ImageState>({
        bottomImage: [
            scaleImageUrl(mainImageDimensions.idealSize, queue.next?.imageUrl),
            queue.next?.explicit,
        ],
        current: 0,
        topImage: [
            scaleImageUrl(mainImageDimensions.idealSize, queue.current?.imageUrl),
            queue.current?.explicit,
        ],
    });

    const updateImageSize = useCallback(() => {
        if (mainImageRef.current) {
            setMainImageDimensions({
                idealSize:
                    albumArtRes ||
                    Math.ceil((mainImageRef.current as HTMLDivElement).offsetHeight / 100) * 100,
            });

            setImageState({
                bottomImage: [
                    scaleImageUrl(mainImageDimensions.idealSize, queue.next?.imageUrl),
                    queue.next?.explicit,
                ],
                current: 0,
                topImage: [
                    scaleImageUrl(mainImageDimensions.idealSize, queue.current?.imageUrl),
                    queue.current?.explicit,
                ],
            });
        }
    }, [mainImageDimensions.idealSize, queue, setImageState, albumArtRes]);

    useLayoutEffect(() => {
        updateImageSize();
    }, [updateImageSize]);

    useEffect(() => {
        const unsubSongChange = usePlayerStore.subscribe(
            (state) => [state.current.song, state.actions.getPlayerData().queue],
            (state) => {
                const isTop = imageState.current === 0;
                const queue = state[1] as PlayerData['queue'];

                const currentImageUrl: ImageImfo = [
                    scaleImageUrl(mainImageDimensions.idealSize, queue.current?.imageUrl),
                    queue.current?.explicit,
                ];
                const nextImageUrl: ImageImfo = [
                    scaleImageUrl(mainImageDimensions.idealSize, queue.next?.imageUrl),
                    queue.next?.explicit,
                ];

                setImageState({
                    bottomImage: isTop ? currentImageUrl : nextImageUrl,
                    current: isTop ? 1 : 0,
                    topImage: isTop ? nextImageUrl : currentImageUrl,
                });
            },
            { equalityFn: (a, b) => (a[0] as QueueSong)?.id === (b[0] as QueueSong)?.id },
        );

        return () => {
            unsubSongChange();
        };
    }, [imageState, mainImageDimensions.idealSize, queue, setImageState]);

    return (
        <Flex
            align="center"
            className={clsx(styles.playerContainer, 'full-screen-player-image-container')}
            direction="column"
            justify="flex-start"
            p="1rem"
        >
            <div
                className={styles.imageContainer}
                ref={mainImageRef}
            >
                <AnimatePresence
                    initial={false}
                    mode="sync"
                >
                    {imageState.current === 0 && (
                        <ImageWithPlaceholder
                            animate="open"
                            blur={blurExplicit && imageState.topImage[1]}
                            className="full-screen-player-image"
                            custom={{ isOpen: imageState.current === 0 }}
                            draggable={false}
                            exit="closed"
                            initial="closed"
                            key={imageKey}
                            placeholder="var(--theme-colors-foreground-muted)"
                            src={imageState.topImage[0] || ''}
                        />
                    )}
                    {imageState.current === 1 && (
                        <ImageWithPlaceholder
                            animate="open"
                            blur={blurExplicit && imageState.bottomImage[1]}
                            className="full-screen-player-image"
                            custom={{ isOpen: imageState.current === 1 }}
                            draggable={false}
                            exit="closed"
                            initial="closed"
                            key={imageKey}
                            placeholder="var(--theme-colors-foreground-muted)"
                            src={imageState.bottomImage[0] || ''}
                        />
                    )}
                </AnimatePresence>
            </div>
            <Stack
                className={styles.metadataContainer}
                gap="md"
                maw="100%"
            >
                <Text
                    fw={900}
                    lh="1.2"
                    overflow="hidden"
                    size="4xl"
                    w="100%"
                >
                    {currentSong?.name}
                </Text>
                <Text
                    component={Link}
                    isLink
                    overflow="hidden"
                    size="xl"
                    to={generatePath(AppRoute.LIBRARY_ALBUMS_DETAIL, {
                        albumId: currentSong?.albumId || '',
                    })}
                    w="100%"
                >
                    {currentSong?.album}
                </Text>
                <Text key="fs-artists">
                    {currentSong?.artists?.map((artist, index) => (
                        <Fragment key={`fs-artist-${artist.id}`}>
                            {index > 0 && (
                                <Text
                                    style={{
                                        display: 'inline-block',
                                        padding: '0 0.5rem',
                                    }}
                                >
                                    •
                                </Text>
                            )}
                            <Text
                                component={Link}
                                isLink
                                to={generatePath(AppRoute.LIBRARY_ALBUM_ARTISTS_DETAIL, {
                                    albumArtistId: artist.id,
                                })}
                            >
                                {artist.name}
                            </Text>
                        </Fragment>
                    ))}
                </Text>
                <Group
                    justify="center"
                    mt="sm"
                >
                    {currentSong?.container && (
                        <Badge variant="transparent">{currentSong?.container}</Badge>
                    )}
                    {currentSong?.releaseYear && (
                        <Badge variant="transparent">{currentSong?.releaseYear}</Badge>
                    )}
                </Group>
            </Stack>
        </Flex>
    );
};
