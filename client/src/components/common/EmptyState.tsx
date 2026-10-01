import { Box, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

const EmptyState = ({ icon, title, description, children }: EmptyStateProps) => (
  <Box textAlign="center" py={{ base: 8, md: 10 }} px={4} color="fg.muted">
    {icon && (
      <Box display="flex" justifyContent="center" mb={3} aria-hidden="true">
        {icon}
      </Box>
    )}
    <Heading as="h3" size="sm" color="fg">
      {title}
    </Heading>
    {description && (
      <Text mt={2} fontSize="sm">
        {description}
      </Text>
    )}
    {children}
  </Box>
);

export default EmptyState;
