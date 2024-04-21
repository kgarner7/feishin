import { NumberInput, Slider, Switch } from '/@/renderer/components';
import { usePlaybackSettings, useSettingsStoreActions } from '/@/renderer/store/settings.store';
import { SettingOption, SettingsSection } from '../settings-section';
import { useTranslation } from 'react-i18next';

export const ScrobbleSettings = () => {
    const { t } = useTranslation();
    const settings = usePlaybackSettings();
    const { setSettings } = useSettingsStoreActions();

    const scrobbleOptions: SettingOption[] = [
        {
            control: (
                <Switch
                    aria-label="Toggle scrobble"
                    defaultChecked={settings.scrobble.enabled}
                    onChange={(e) => {
                        setSettings({
                            playback: {
                                ...settings,
                                scrobble: {
                                    ...settings.scrobble,
                                    enabled: e.currentTarget.checked,
                                },
                            },
                        });
                    }}
                />
            ),
            description: t('setting.scrobble', {
                context: 'description',
                postProcess: 'sentenceCase',
            }),
            title: t('setting.scrobble', { postProcess: 'sentenceCase' }),
        },
        {
            control: (
                <Slider
                    aria-label="Scrobble percentage"
                    defaultValue={settings.scrobble.scrobbleAtPercentage}
                    label={`${settings.scrobble.scrobbleAtPercentage}%`}
                    max={90}
                    min={25}
                    w={100}
                    onChange={(e) => {
                        setSettings({
                            playback: {
                                ...settings,
                                scrobble: {
                                    ...settings.scrobble,
                                    scrobbleAtPercentage: e,
                                },
                            },
                        });
                    }}
                />
            ),
            description: t('setting.minimumScrobblePercentage', {
                context: 'description',
                postProcess: 'sentenceCase',
            }),
            title: t('setting.minimumScrobblePercentage', { postProcess: 'sentenceCase' }),
        },
        {
            control: (
                <NumberInput
                    aria-label="Scrobble duration in seconds"
                    defaultValue={settings.scrobble.scrobbleAtDuration}
                    max={1200}
                    min={0}
                    width={75}
                    onChange={(e) => {
                        if (e === '') return;
                        setSettings({
                            playback: {
                                ...settings,
                                scrobble: {
                                    ...settings.scrobble,
                                    scrobbleAtDuration: e,
                                },
                            },
                        });
                    }}
                />
            ),
            description: t('setting.minimumScrobbleSeconds', {
                context: 'description',
                postProcess: 'sentenceCase',
            }),
            title: t('setting.minimumScrobbleSeconds', { postProcess: 'sentenceCase' }),
        },
        {
            control: (
                <Switch
                    aria-label="Toggle autosave"
                    defaultChecked={settings.autoSave.enabled}
                    onChange={(e) => {
                        setSettings({
                            playback: {
                                ...settings,
                                autoSave: {
                                    ...settings.autoSave,
                                    enabled: e.currentTarget.checked,
                                },
                            },
                        });
                    }}
                />
            ),
            description: t('setting.autoSave', {
                context: 'description',
                postProcess: 'sentenceCase',
            }),
            title: t('setting.autoSave', { postProcess: 'sentenceCase' }),
        },
        {
            control: (
                <NumberInput
                    aria-label="Autosave tracks"
                    defaultValue={settings.autoSave.songCount}
                    min={1}
                    width={75}
                    onChange={(e) => {
                        if (e === '') return;
                        setSettings({
                            playback: {
                                ...settings,
                                autoSave: {
                                    ...settings.scrobble,
                                    songCount: e,
                                },
                            },
                        });
                    }}
                />
            ),
            description: t('setting.autoSaveCount', {
                context: 'description',
                postProcess: 'sentenceCase',
            }),
            isHidden: !settings.autoSave.enabled,
            title: t('setting.autoSaveCount', { postProcess: 'sentenceCase' }),
        },
    ];

    return <SettingsSection options={scrobbleOptions} />;
};
