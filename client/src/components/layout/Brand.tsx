import { Image } from '@chakra-ui/react';

interface BrandProps {
  compact?: boolean;
  hero?: boolean;
}

// The logo files are cropped to their visible content, so these heights are the logo's real
// size. maxW keeps it inside narrow containers such as the sidebar.
const Brand = ({ compact = false, hero = false }: BrandProps) => (
  <Image
    src={hero ? '/taskforge-logo.png' : '/taskforge-logo-alt.png'}
    alt="TaskForge"
    h={
      hero
        ? { base: '120px', md: '170px' }
        : compact
          ? { base: '36px', md: '40px' }
          : { base: '44px', md: '48px' }
    }
    w="auto"
    maxW={hero ? { base: '280px', md: '420px' } : 'min(100%, 220px)'}
    objectFit="contain"
  />
);

export default Brand;
