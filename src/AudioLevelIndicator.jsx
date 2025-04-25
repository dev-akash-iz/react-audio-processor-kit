import { Box, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import { useEffect, useRef, useState } from 'react';

// Define keyframe animations
const wave = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.85;
  }
  100% {
    transform: scale(1);
    opacity: 0.7;
  }
`;

const pulseRings = keyframes`
  0% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.4;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
`;

// Styled components
const MicContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '80px',
  marginBottom: theme.spacing(3),
}));

const RelativeContainer = styled(Box)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const OuterRing = styled(Box)(({ theme, size, opacity, isPulsing }) => ({
  position: 'absolute',
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  width: size,
  height: size,
  opacity: opacity,
  transition: 'all 0.2s ease-out',
  animation: isPulsing ? `${pulseRings} 1.5s infinite ease-in-out` : 'none',
}));

const MicIconContainer = styled(Box)(({ theme, size, isPulsing, normalizedLevel }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  width: size,
  height: size,
  color: 'white',
  transition: 'all 0.2s ease-out',
  transform: `scale(${1 + (normalizedLevel > 20 ? 0.05 : 0)})`,
  animation: isPulsing && normalizedLevel > 30 ? `${wave} 1s infinite ease-in-out` : 'none',
}));

const StatusText = styled(Typography)(({ theme }) => ({
  position: 'absolute',
  bottom: -24,
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
}));

const AudioLevelIndicator = ({ Subscribe }) => {
  // Calculate size for the mic animation based on audio level
  const baseSize = 40; // Base size in pixels
  const maxGrowth = 20; // Maximum additional size in pixels
  const ringOne = useRef();
  const ringTwo = useRef();

  useEffect(() => {
    Subscribe((data) => {
      const audioLevel = data.volume;
      const normalizedLevel = Math.max(0, Math.min(1, audioLevel));

      if (ringOne.current) {
        const el = ringOne.current;
        const newSize = baseSize + ((normalizedLevel / 0.09) * maxGrowth);
        const ringSize = `${newSize}px`;

        el.style.width = ringSize;
        el.style.height = ringSize;
        el.style.opacity = normalizedLevel / 0.2;
        el.style.animation = normalizedLevel > 0.01 ? `${pulseRings} 1.5s infinite ease-in-out` : 'none';
      }
      if (ringTwo.current) {
        const el = ringTwo.current;
        const newSize = baseSize + ((normalizedLevel / 0.09) * maxGrowth);
        const ringSize = `${newSize}px`;

        el.style.width = ringSize;
        el.style.height = ringSize;
        el.style.opacity = normalizedLevel / 0.09;
        el.style.animation = normalizedLevel > 0.01 ? `${pulseRings} 1.5s infinite ease-in-out` : 'none';
      }

    });

  }, []);


  // Ensure audioLevel is within 0-100 range




  return (
    <MicContainer>
      <RelativeContainer>
        {/* Outer rings - only visible when audio level is high enough */}
        <OuterRing
          ref={ringOne}
          sx={{
            animationDuration: '1.5s'
          }}
        />
        <OuterRing
          ref={ringTwo}

          sx={{
            animationDuration: '1.2s',
            animationDelay: '0.1s'
          }}
        />

        {/* Microphone icon with pulsing animation */}
        <MicIconContainer

        >
          <MicIcon sx={{ fontSize: 40 * 0.6 }} />
        </MicIconContainer>

      </RelativeContainer>
    </MicContainer>
  );
};

export default AudioLevelIndicator;
