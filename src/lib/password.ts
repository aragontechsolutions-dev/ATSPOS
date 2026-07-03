import bcrypt from 'bcryptjs';
import * as Crypto from 'expo-crypto';

// bcryptjs is a pure-JS implementation (no native module / prebuild needed).
// It's slower than a native bcrypt binding, but logins here are infrequent
// (a handful of employees), so the extra milliseconds are not a concern and
// we avoid one more native dependency to maintain.
//
// bcryptjs v3 removed its insecure Math.random fallback and requires a secure
// PRNG. React Native/Hermes has no global `crypto.getRandomValues`, so without
// this the salt generation fails (surfacing as "Invalid string / salt: Not a
// string"). We wire it to expo-crypto's synchronous secure random bytes.
bcrypt.setRandomFallback((len) => Array.from(Crypto.getRandomBytes(len)));

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
