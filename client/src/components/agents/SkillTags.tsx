import { HStack, Tag, Text } from '@chakra-ui/react';

interface SkillTagsProps {
  skills: string[];
  // Shows a remove button on each tag when given.
  onRemove?: (skill: string) => void;
  emptyText?: string;
}

const SkillTags = ({ skills, onRemove, emptyText = 'No skills listed.' }: SkillTagsProps) =>
  skills.length ? (
    <HStack as="ul" listStyleType="none" m={0} p={0} gap={1.5} flexWrap="wrap" aria-label="Skills">
      {skills.map((skill) => (
        <li key={skill}>
          <Tag.Root size="sm" variant="subtle" colorPalette="purple">
            <Tag.Label>{skill}</Tag.Label>
            {onRemove && (
              <Tag.EndElement>
                <Tag.CloseTrigger
                  aria-label={'Remove skill ' + skill}
                  onClick={() => onRemove(skill)}
                />
              </Tag.EndElement>
            )}
          </Tag.Root>
        </li>
      ))}
    </HStack>
  ) : (
    <Text fontSize="sm" color="fg.muted">
      {emptyText}
    </Text>
  );

export default SkillTags;
