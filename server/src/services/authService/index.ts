import { User } from '../../models/userModel';

export const createUser = async (userData: { email: string; password: string }) => {
  return User.create(userData);
};

export const findUserByEmail = async (email: string) => {
  return User.findOne({ email });
};
