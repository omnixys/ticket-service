import { PresenceState } from '../../../prisma/generated/client.js';
import { registerEnumType } from '@nestjs/graphql';

export const PresenceStateGraphQL = PresenceState;

registerEnumType(PresenceStateGraphQL, {
  name: 'PresenceState',
  description:
    'Whether the ticket holder is currently INSIDE or OUTSIDE the venue.',
});

export function mapState(value: string): PresenceState {
  return value === PresenceState.INSIDE
    ? PresenceState.INSIDE
    : PresenceState.OUTSIDE;
}
