import { Box, HStack, Text } from '@chakra-ui/react';
import type { IconType } from 'react-icons';

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  icon: IconType;
  accent?: string;
}

const MetricCard = ({ label, value, detail, icon: Icon, accent = 'fg.muted' }: MetricCardProps) => (
  <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 5 }} minW="0">
    <HStack justify="space-between" color="fg.muted" fontSize="sm">
      <Text>{label}</Text>
      <Box color={accent} aria-hidden="true">
        <Icon size={18} />
      </Box>
    </HStack>
    <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="semibold" mt={2} lineHeight="1.1">
      {value}
    </Text>
    <Text color="fg.muted" fontSize="xs" mt={1.5}>
      {detail}
    </Text>
  </Box>
);

export default MetricCard;
