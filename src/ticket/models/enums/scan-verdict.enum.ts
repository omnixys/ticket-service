import { ScanVerdict as PrismaScanVerdict } from '../../../prisma/generated/client.js';
import { registerEnumType } from '@nestjs/graphql';

export const ScanVerdict = PrismaScanVerdict;
export type ScanVerdict = PrismaScanVerdict;

registerEnumType(ScanVerdict, {
  name: 'ScanVerdict',
  description: 'The result of a ticket scan, including anti-sharing cases.',
});

export function mapVerdict(value: string): ScanVerdict {
  return Object.values(ScanVerdict).includes(value as ScanVerdict)
    ? (value as ScanVerdict)
    : ScanVerdict.UNKNOWN;
}
