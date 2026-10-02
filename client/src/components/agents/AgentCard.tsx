import { Box, Button, Heading, HStack, Link, Text } from '@chakra-ui/react';
import { LuKeyRound, LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getAgentId, permissionLabel, type Agent } from '../../types/agent';
import AgentStatusBadge from './AgentStatusBadge';
import SkillTags from './SkillTags';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

const AgentCard = ({ agent, onEdit, onDelete }: AgentCardProps) => (
  <Box
    as="li"
    bg="bg.panel"
    borderWidth="1px"
    borderRadius="lg"
    p={{ base: 4, md: 5 }}
    opacity={agent.status === 'disabled' ? 0.75 : 1}
    minW="0"
  >
    <HStack justify="space-between" align="flex-start" gap={3}>
      <Box minW="0">
        <Heading as="h3" size="md" wordBreak="break-word">
          <Link asChild color="fg" _hover={{ color: 'accent.teal' }}>
            <RouterLink to={'/workforce/' + getAgentId(agent)}>{agent.name}</RouterLink>
          </Link>
        </Heading>
        <Text fontSize="sm" color="accent.violet" mt={0.5}>
          {agent.role}
        </Text>
      </Box>
      <AgentStatusBadge status={agent.status} />
    </HStack>
    <Text color="fg.muted" fontSize="sm" lineClamp={2} mt={2}>
      {agent.description || 'No description.'}
    </Text>
    <Box mt={3}>
      <SkillTags skills={agent.skills} />
    </Box>
    <HStack mt={3} gap={1.5} fontSize="xs" color="fg.muted" align="flex-start">
      <Box as="span" mt={0.5} flexShrink={0} aria-hidden="true">
        <LuKeyRound />
      </Box>
      <Text>
        {agent.permissions.length
          ? agent.permissions.map(permissionLabel).join(', ')
          : 'No permissions'}
      </Text>
    </HStack>
    <HStack justify="space-between" mt={4} gap={2} flexWrap="wrap">
      <Text fontSize="xs" color="fg.muted">
        {agent.updatedAt ? 'Updated ' + dateFormat.format(new Date(agent.updatedAt)) : ''}
      </Text>
      <HStack gap={1}>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onEdit(agent)}
          aria-label={'Edit ' + agent.name}
        >
          <LuPencil />
          Edit
        </Button>
        <Button
          size="xs"
          variant="ghost"
          colorPalette="red"
          onClick={() => onDelete(agent)}
          aria-label={'Delete ' + agent.name}
        >
          <LuTrash2 />
          Delete
        </Button>
      </HStack>
    </HStack>
  </Box>
);

export default AgentCard;
