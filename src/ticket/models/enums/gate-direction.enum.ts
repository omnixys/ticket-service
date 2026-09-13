import { PresenceState } from '../../../prisma/generated/client.js';
import { registerEnumType } from '@nestjs/graphql';

export enum GateDirection {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
}

registerEnumType(GateDirection, {
  name: 'GateDirection',
  description:
    'The direction of a gate scan: ENTRY (Einlass) or EXIT (Ausgang).',
});

export function intendedState(direction: GateDirection): PresenceState {
  return direction === GateDirection.ENTRY
    ? PresenceState.INSIDE
    : PresenceState.OUTSIDE;
}
