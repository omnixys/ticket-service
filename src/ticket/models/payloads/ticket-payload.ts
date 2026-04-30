import { PresenceState } from '../../../prisma/generated/client.js';
import { PresenceStateGraphQL } from '../enums/presence-state.enum.js';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TicketPayload {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  eventId!: string;
  @Field(() => ID)
  invitationId!: string;
  @Field(() => ID)
  seatId!: string;
  @Field(() => ID)
  guestProfileId!: string;

  @Field(() => String, { nullable: true })
  deviceId?: string;
  @Field(() => String, { nullable: true })
  devicePublicKey?: string;
  @Field(() => Date, { nullable: true })
  deviceActivationAt?: Date;
  @Field(() => String, { nullable: true })
  deviceActivationIP?: string;

  @Field(() => Int, { nullable: true })
  lastNonce?: number;
  @Field(() => Int, { nullable: true })
  nextNonce?: number;

  @Field(() => PresenceStateGraphQL)
  currentState!: PresenceState;
  @Field(() => Date, { nullable: true })
  checkedInAt?: Date;

  @Field(() => Boolean)
  revoked!: boolean;
  @Field(() => Date, { nullable: true })
  revokedAt?: Date;
  @Field(() => String, { nullable: true })
  revokedBy?: string;
  @Field(() => String, { nullable: true })
  revokedReason?: string;

  @Field(() => Date)
  createdAt!: Date;
  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class TicketMessagePayload {
  @Field()
  ok!: boolean;

  @Field(() => String, { nullable: true })
  message?: string;

  @Field(() => TicketPayload, { nullable: true })
  ticket?: TicketPayload;
}
