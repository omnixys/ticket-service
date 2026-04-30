// TODO resolve eslint
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { PresenceState } from '../../../prisma/generated/client.js';
import { registerEnumType } from '@nestjs/graphql';

export const PresenceStateGraphQL = PresenceState;

registerEnumType(PresenceStateGraphQL, {
  name: 'PresenceState',
  description:
    'Whether the ticket holder is currently INSIDE or OUTSIDE the venue.',
});

/**
 * Convert string verdict → GraphQL ScanVerdict
 */
export function mapState(v: string): PresenceState {
  return (PresenceState as any)[v] ?? PresenceState.OUTSIDE;
}
