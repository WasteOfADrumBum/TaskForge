import { Image } from '@chakra-ui/react';

interface BrandProps {
  compact?: boolean;
  hero?: boolean;
}

const Brand = ({ compact = false, hero = false }: BrandProps) => (
  <Image
    src={hero ? '/taskforge-logo.png' : '/taskforge-logo-Alt.png'}
    alt="TaskForge"
    h={
      hero
        ? { base: '120px', md: '170px' }
        : compact
          ? { base: '56px', md: '64px' }
          : { base: '64px', md: '72px' }
    }
    w="auto"
    maxW={hero ? { base: '280px', md: '420px' } : compact ? '190px' : '220px'}
    objectFit="contain"
  />
);

export default Brand;
