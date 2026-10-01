import 'dotenv/config';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { Task } from '../models/taskModel';
import { User } from '../models/userModel';
import { requireEnv } from '../config/env';

const seedDemo = async () => {
  const mongoUri = requireEnv('MONGO_URI');
  const email = requireEnv('DEMO_EMAIL').toLowerCase();
  const password = requireEnv('DEMO_PASSWORD');

  await mongoose.connect(mongoUri);

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({ email, password: await bcrypt.hash(password, 10) });
  } else {
    user.password = await bcrypt.hash(password, 10);
    await user.save();
  }

  await Task.deleteMany({ owner: user._id });

  // Due dates are calendar dates stored as UTC midnight, the same shape the task form
  // produces, so the client shows the intended day in every time zone.
  const dueInDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  };
  const tomorrow = dueInDays(1);
  const nextWeek = dueInDays(7);
  const yesterday = dueInDays(-1);

  await Task.insertMany([
    {
      title: 'Review product roadmap',
      description: 'Prioritize the next TaskForge milestone and capture follow-up work.',
      status: 'in-progress',
      priority: 'high',
      dueDate: tomorrow,
      owner: user._id,
    },
    {
      title: 'Prepare sprint planning notes',
      description: 'Turn open work into an actionable plan for the next sprint.',
      status: 'todo',
      priority: 'medium',
      dueDate: nextWeek,
      owner: user._id,
    },
    {
      title: 'Close completed launch checklist',
      description: 'Verify completed items and archive anything no longer needed.',
      status: 'done',
      priority: 'low',
      dueDate: null,
      owner: user._id,
    },
    {
      title: 'Resolve overdue API follow-up',
      description: 'Review the outstanding API integration issue and document the resolution.',
      status: 'todo',
      priority: 'high',
      dueDate: yesterday,
      owner: user._id,
    },
  ]);

  console.log('Demo workspace seeded for ' + email);
  await mongoose.disconnect();
};

seedDemo().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
