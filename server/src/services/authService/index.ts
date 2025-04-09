interface User {
  id: number;
  email: string;
  password: string;
}

let users: User[] = [];

export const createUser = async (userData: {
  email: string;
  password: string;
}) => {
  const newUser = { id: Date.now(), ...userData };
  users.push(newUser);
  return newUser;
};

export const findUserByEmail = async (email: string) => {
  return users.find((user) => user.email === email);
};
