import { Box, HStack } from '@chakra-ui/react';
import { LuFolderKanban, LuListChecks } from 'react-icons/lu';
import { NavLink } from 'react-router-dom';

const tabs = [
  // `end` keeps Tasks from also matching /work/projects.
  { to: '/work', label: 'Tasks', icon: LuListChecks, end: true },
  { to: '/work/projects', label: 'Projects', icon: LuFolderKanban, end: false },
];

// Second-level navigation inside the Work section.
const WorkTabs = () => (
  <Box as="nav" aria-label="Work sections" borderBottomWidth="1px" mb={{ base: 6, md: 8 }}>
    <HStack as="ul" listStyleType="none" m={0} p={0} gap={{ base: 4, md: 6 }}>
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <Box as="li" key={to}>
          <Box
            asChild
            display="flex"
            alignItems="center"
            gap={2}
            pb={3}
            mb="-1px"
            borderBottomWidth="2px"
            borderColor="transparent"
            color="fg.muted"
            fontSize="sm"
            fontWeight="medium"
            _hover={{ color: 'fg' }}
            _focusVisible={{
              outline: '2px solid',
              outlineColor: 'accent.teal',
              outlineOffset: '2px',
            }}
            _currentPage={{ color: 'accent.teal', borderColor: 'accent.teal' }}
          >
            <NavLink to={to} end={end}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          </Box>
        </Box>
      ))}
    </HStack>
  </Box>
);

export default WorkTabs;
