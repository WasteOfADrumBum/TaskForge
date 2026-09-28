import { createUser, findUserByEmail } from './index';

describe('authService', () => {
  it('creates a user that can be found by email', async () => {
    const email = 'test@example.com';
    const password = 'hashed-password';

    const createdUser = await createUser({ email, password });
    const foundUser = await findUserByEmail(email);

    expect(foundUser).toEqual(createdUser);
    expect(foundUser).toMatchObject({ email, password });
  });
});
