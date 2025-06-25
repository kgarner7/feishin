import { MdOutlinePhone, MdPhoneEnabled } from 'react-icons/md';

import { RemoteButton } from '/@/remote/components/buttons/remote-button';
import { useMediaControl, useToggleMediaControl } from '/@/remote/store';

export const MediaButton = () => {
    const control = useMediaControl();
    const toggleMedia = useToggleMediaControl();

    return (
        <RemoteButton
            mr={5}
            onClick={() => toggleMedia()}
            size="lg"
            tooltip={{ label: control ? 'media control enabled' : 'media control disabled' }}
            variant="default"
        >
            {control ? <MdPhoneEnabled size={30} /> : <MdOutlinePhone size={30} />}
        </RemoteButton>
    );
};
