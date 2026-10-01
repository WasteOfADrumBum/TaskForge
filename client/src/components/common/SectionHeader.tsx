import { Badge, Heading, HStack, Link } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface SectionHeaderProps {
  id?: string;
  title: string;
  count?: number;
  icon?: ReactNode;
  action?: { label: string; to: string };
  aside?: ReactNode;
}

const SectionHeader = ({ id, title, count, icon, action, aside }: SectionHeaderProps) => (
  <HStack justify="space-between" gap={3} mb={4}>
    <Heading as="h2" id={id} size="md" display="flex" alignItems="center" gap={2}>
      {icon}
      {title}
      {count !== undefined && (
        <Badge variant="subtle" size="sm">
          {count}
        </Badge>
      )}
    </Heading>
    {aside}
    {action && (
      <Link
        asChild
        fontSize="sm"
        color="fg.muted"
        whiteSpace="nowrap"
        _hover={{ color: 'accent.teal' }}
      >
        <RouterLink to={action.to}>{action.label}</RouterLink>
      </Link>
    )}
  </HStack>
);

export default SectionHeader;
