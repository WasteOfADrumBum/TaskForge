import { User } from '../../models/userModel';
import { createUser, findUserByEmail } from './index';

jest.mock('../../models/userModel', () => ({
  User: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));

const mockedUser = jest.mocked(User);

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user through the User model', async () => {
    const userData = { email: 'test@example.com', password: 'hashed-password' };
    const createdUser = { id: 'user-id', ...userData };

    mockedUser.create.mockResolvedValue(createdUser as never);

    const result = await createUser(userData);

    expect(mockedUser.create).toHaveBeenCalledWith(userData);
    expect(result).toEqual(createdUser);
  });

  it('finds a user by email through the User model', async () => {
    const email = 'test@example.com';
    const foundUser = { id: 'user-id', email, password: 'hashed-password' };

    mockedUser.findOne.mockResolvedValue(foundUser as never);

    const result = await findUserByEmail(email);

    expect(mockedUser.findOne).toHaveBeenCalledWith({ email });
    expect(result).toEqual(foundUser);
  });
});
