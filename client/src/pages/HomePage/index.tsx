import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { useAppDispatch } from '../../redux/hooks/typedHooks';
import { clearAuth } from '../../redux/slices/authSlice';

const HomePage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('token');
      dispatch(clearAuth());
      navigate('/login');
    }
  };

  return (
    <Box maxW="4xl" mx="auto" mt={10} p={6}>
      <VStack align="stretch" gap="6">
        <Heading>TaskForge</Heading>
        <Text>You are authenticated. Your task workspace will live here.</Text>
        <Button alignSelf="flex-start" onClick={handleLogout}>
          Log out
        </Button>
      </VStack>
    </Box>
  );
};

export default HomePage;
