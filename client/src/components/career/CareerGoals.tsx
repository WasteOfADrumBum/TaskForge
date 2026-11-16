import { Box, Button, Heading, Link, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useGoals } from '../../hooks/useGoals';
import { useToday } from '../../hooks/useToday';
import { getGoalId } from '../../types/goal';
import { goalTargetText } from '../../utils/goals';

// Active goals in the career area, read-only here; they are added and changed on Goals.
const CareerGoals = () => {
  const now = useToday();
  const { goals, loaded, error, pending, reload } = useGoals();
  const career = goals.filter((goal) => goal.status === 'active' && goal.area === 'career');
  return (
    <Box
      as="section"
      aria-labelledby="career-goals-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <Heading as="h2" id="career-goals-heading" size="md" mb={2}>
        Career goals
      </Heading>
      {error && !pending ? (
        <VStack align="start" gap={2}>
          <Text role="alert" color="fg.error">
            {error}
          </Text>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry loading goals
          </Button>
        </VStack>
      ) : !loaded ? (
        <Text color="fg.muted">Loading your career goals...</Text>
      ) : career.length ? (
        <Box as="ul" role="list" listStyleType="none" m={0} p={0} aria-label="Active career goals">
          {career.map((goal) => {
            const target = goalTargetText(goal, now);
            return (
              <Box
                as="li"
                key={getGoalId(goal)}
                py={2}
                borderTopWidth="1px"
                borderColor="border.muted"
              >
                <Text overflowWrap="anywhere">{goal.title}</Text>
                {target && (
                  <Text fontSize="sm" color="fg.muted">
                    {target}
                  </Text>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Text color="fg.muted">No active career goals yet. Choose the Career area on Goals.</Text>
      )}
      <Link asChild fontSize="sm" color="accent.teal" mt={3} display="inline-block">
        <RouterLink to="/goals">Add or update goals</RouterLink>
      </Link>
    </Box>
  );
};

export default CareerGoals;
