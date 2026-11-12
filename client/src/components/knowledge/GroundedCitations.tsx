import { Box, chakra, Heading, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { citationToHit, type GroundedRunReport } from '../../utils/askTaskForge';

// Renders a grounded knowledge Run draft: the bounded answer, then each retrieved excerpt with
// its exact recorded quote and a link that rechecks it against the current owned source.
export default function GroundedCitations({ report }: { report: GroundedRunReport }) {
  return (
    <Box>
      <Text color="fg.muted" mb={3}>
        Local AI draft grounded only in the excerpts below. Citations prove where text came from,
        not that it is true. Open a source to check whether the excerpt still matches its current
        version.
      </Text>
      <Heading as="h3" size="sm" mb={1}>
        Question
      </Heading>
      <Text whiteSpace="pre-wrap" overflowWrap="anywhere" mb={3}>
        {report.question}
      </Text>
      <Heading as="h3" size="sm" mb={1}>
        Draft answer
      </Heading>
      <Text whiteSpace="pre-wrap" overflowWrap="anywhere" mb={3}>
        {report.answer}
      </Text>
      <Heading as="h3" size="sm" mb={2}>
        {report.projectScoped ? 'Retrieved excerpts (project sources)' : 'Retrieved excerpts'}
      </Heading>
      <chakra.ol listStyleType="none" p={0} m={0}>
        {report.excerpts.map((item) => (
          <chakra.li key={item.key} borderTopWidth="1px" borderColor="border" py={3}>
            <Text fontSize="sm" color="fg.muted">
              [{item.key}] {item.cited ? 'Cited in the answer' : 'Retrieved, not cited'}
            </Text>
            <Link asChild color="accent.teal" overflowWrap="anywhere">
              <RouterLink
                to={'/knowledge/' + encodeURIComponent(item.sourceId)}
                state={{ citation: citationToHit(item) }}
              >
                {item.title} — version {item.version}
              </RouterLink>
            </Link>
            <chakra.blockquote
              mt={1}
              ps={3}
              borderStartWidth="2px"
              borderColor="border"
              whiteSpace="pre-wrap"
              overflowWrap="anywhere"
            >
              {item.quote}
            </chakra.blockquote>
          </chakra.li>
        ))}
      </chakra.ol>
    </Box>
  );
}
