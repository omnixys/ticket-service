import { PresenceState } from '../enums/presence-state.enum.js';
import { ScanVerdict } from '../enums/scan-verdict.enum.js';
import {
  Field,
  ID,
  ObjectType,
  GraphQLISODateTime,
  Int,
} from '@nestjs/graphql';


@ObjectType()
export class ScanLogPayload {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  ticketId!: string;
  @Field(() => String)
  eventId!: string;
  @Field(() => String)
  actorId!: string;

  @Field(() => PresenceState)
  direction!: PresenceState;
  @Field(() => String, { nullable: true })
  gate?: string;

  @Field(() => ScanVerdict)
  verdict!: ScanVerdict;
  @Field(() => Int, { nullable: true })
  nonce?: number;
  @Field(() => String, { nullable: true })
  deviceId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
