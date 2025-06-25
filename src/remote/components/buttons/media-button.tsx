import { useMediaControl, useToggleMediaControl } from '/@/remote/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';

export const MediaButton = () => {
    const control = useMediaControl();
    const toggleMedia = useToggleMediaControl();

    return (
        <ActionIcon
            icon={control ? 'phoneEnabled' : 'phoneDisabled'}
            mr={5}
            onClick={() => toggleMedia()}
            size="lg"
            tooltip={{ label: control ? 'media control enabled' : 'media control disabled' }}
            variant="default"
        />
    );
};
