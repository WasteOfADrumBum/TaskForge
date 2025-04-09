import { Request, Response } from "express";
import { createUser, findUserByEmail } from "../../services/authService";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Handle User Registration
export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const userExists = await findUserByEmail(email);
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({ email, password: hashedPassword });

    res.status(201).json({ message: "User created", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Handle User Login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, "your_jwt_secret");
    res.json({ message: "Logged in successfully", token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
