import { Brand, type BrandFontRole, type BrandKind } from '../../models/brandModel';
import { createRunIndexGuard, RunInputError } from '../runService';

export class BrandUnavailableError extends Error {}

// Lazy, single-flight creation of the one-profile-per-owner-and-kind index; no startup writes.
// Reuses the run index guard, which fails closed after a deadline.
const guard = createRunIndexGuard(() =>
  Brand.collection.createIndex({ owner: 1, kind: 1 }, { unique: true, maxTimeMS: 5000 }),
);
export const ensureBrandIndex = async () => {
  try {
    await guard();
  } catch (error) {
    if (error instanceof RunInputError) throw new BrandUnavailableError();
    throw error;
  }
};

export interface BrandInput {
  name: string;
  tagline: string;
  colors: Array<{ name: string; hex: string }>;
  fonts: Array<{ role: BrandFontRole; family: string }>;
  logos: Array<{ label: string; url: string }>;
  voice: string;
  writingStyle: string;
  imagePrompts: string[];
}

const isDuplicateKey = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;

export const findBrandsByOwner = async (ownerId: string) =>
  Brand.find({ owner: ownerId }).sort({ kind: 1 });

// Create or replace one of the owner's profiles. Two first saves racing each other can both try
// to insert; the loser hits the unique index and retries as an update.
export const saveBrand = async (ownerId: string, kind: BrandKind, input: BrandInput) => {
  await ensureBrandIndex();
  const write = () =>
    Brand.findOneAndUpdate(
      { owner: ownerId, kind },
      { $set: input },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  try {
    return await write();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return write();
  }
};
