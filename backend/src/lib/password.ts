import bcrypt from 'bcryptjs';

// Cost 12: roughly 250ms on typical hardware. Deliberately slow — that is the
// point of a password hash.
const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
