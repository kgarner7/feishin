import { ComponentPropsWithoutRef } from 'react';
import { TextTitle } from '/@/renderer/components/text-title';
import styled from 'styled-components';

interface LyricLineProps extends ComponentPropsWithoutRef<'div'> {
  text: string;
}

const StyledText = styled(TextTitle)`
  color: var(--main-fg);
  font-weight: 100;
  font-size: 2vmax;
  line-height: 3.5vmax;
  opacity: 0.5;

  &.active {
    font-weight: 800;
    font-size: 2.5vmax;
    line-height: 4vmax;
    opacity: 1;
  }

  transition: opacity 0.3s ease-in-out, font-size 0.3s ease-in-out;
`;

export const LyricLine = ({ text, ...props }: LyricLineProps) => {
  return <StyledText {...props}>{text}</StyledText>;
};
