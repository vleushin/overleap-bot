import Sqids from 'sqids';

const sqids = new Sqids({
  alphabet: process.env.SQIDS_ALPHABET
})

export const toHashedId = (id: number): string => {
  return sqids.encode([id]);
}

export const fromHashedId = (hashedId: string): number => {
  return sqids.decode(hashedId)[0]!;
}
