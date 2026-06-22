// src/ticket/graphql/input/activate-device.input.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

@InputType()
export class ActivateDeviceInput {
  @Field(() => String)
  @IsUUID()
  ticketId!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}

export interface ActivateDeviceDTO {
  ticketId: string;
  publicKey: string;
  deviceId: string;
  ip?: string;
}
