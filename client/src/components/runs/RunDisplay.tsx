import { Badge, Box, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { runStatusLabel, type RunStatus } from '../../types/run';
export const RunStatusBadge = ({ status }: { status: RunStatus }) => (
  <Badge colorPalette={status === 'failed' ? 'red' : status === 'approved' ? 'teal' : 'gray'}>
    {runStatusLabel[status]}
  </Badge>
);
export const RunSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box
    as="section"
    aria-label={title}
    bg="bg.panel"
    borderWidth="1px"
    borderColor="border.muted"
    borderRadius="lg"
    p={{ base: 4, md: 5 }}
    minW="0"
  >
    <Heading as="h2" size="md" mb={3}>
      {title}
    </Heading>
    {children}
  </Box>
);
export const RunText = ({ value }: { value: unknown }) => (
  <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
    {typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? 'None recorded.')}
  </Text>
);
export const runDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
};
