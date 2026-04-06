// src/ticket/graphql/input/activate-device.input.ts
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ActivateDeviceInput {
  @Field(() => String)
  ticketId!: string;

  @Field(() => String)
  deviceId!: string;

  @Field(() => String)
  publicKey!: string;
}


export interface ActivateDeviceDTO {
  ticketId: string;
  publicKey: string;
  deviceId: string;
  ip?: string;
}
