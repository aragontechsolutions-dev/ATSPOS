import bcrypt from 'bcryptjs';

// bcryptjs is a pure-JS implementation (no native module / prebuild needed).
// It's slower than a native bcrypt binding, but logins here are infrequent
// (a handful of employees), so the extra milliseconds are not a concern and
// we avoid one more native dependency to maintain.
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
