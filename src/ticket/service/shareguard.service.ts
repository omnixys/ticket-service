import { ShareGuard } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { getLogger } from '@omnixys/logger-ts';

interface RiskInput {
  invalidSignature?: boolean;
  replay?: boolean;
  invalidNonce?: boolean;
  deviceMismatch?: boolean;
  rapidScan?: boolean;
}

export interface RiskResult {
  score: number;
  shouldBlock: boolean;
  shouldRevoke: boolean;
  reason?: string;
}

@Injectable()
export class ShareGuardService {
  readonly #logger = getLogger(ShareGuardService.name);
  private readonly BASE_THRESHOLD = 3;
  private readonly BLOCK_TTL_MS = 5 * 60 * 1000; // 5 min
  private readonly REVOKE_THRESHOLD = 10;

  constructor(private readonly prisma: PrismaService) {}

  async resetShareGuard(ticketId: string): Promise<ShareGuard | null> {
    const guard = await this.prisma.shareGuard.findUnique({ where: { ticketId } });
    if (!guard) {
      return null;
    }

    const updated = await this.prisma.shareGuard.update({
      where: { ticketId },
      data: {
        failCount: 0,
        blockedUntil: null,
        reason: null,
      },
    });

    return updated;
  }

  async isBlocked(ticketId: string): Promise<boolean> {
    const guard = await this.prisma.shareGuard.findUnique({
      where: { ticketId },
    });

    if (!guard?.blockedUntil) {
      return false;
    }

    return guard.blockedUntil > new Date();
  }

  calculateRisk(input: RiskInput): RiskResult {
    let score = 0;

    if (input.invalidSignature) {
      score += 5;
    }
    if (input.deviceMismatch) {
      score += 4;
    }
    if (input.replay) {
      score += 3;
    }
    if (input.invalidNonce) {
      score += 2;
    }
    if (input.rapidScan) {
      score += 2;
    }

    return {
      score,
      shouldBlock: score >= this.BASE_THRESHOLD,
      shouldRevoke: score >= this.REVOKE_THRESHOLD,
      reason: this.mapReason(input),
    };
  }

  private mapReason(input: RiskInput): string {
    if (input.invalidSignature) {
      return 'INVALID_SIGNATURE';
    }
    if (input.deviceMismatch) {
      return 'DEVICE_MISMATCH';
    }
    if (input.replay) {
      return 'REPLAY_ATTACK';
    }
    if (input.invalidNonce) {
      return 'INVALID_NONCE';
    }
    return 'UNKNOWN';
  }

  async applyDecision(ticketId: string, result: RiskResult): Promise<void> {
    const now = new Date();

    const guard = await this.prisma.shareGuard.upsert({
      where: { ticketId },
      update: {},
      create: { ticketId },
    });

    const failCount = guard.failCount + 1;

    if (result.shouldRevoke || failCount >= this.REVOKE_THRESHOLD) {
      this.#logger.warn(
        { ticketId, failCount, reason: result.reason },
        'shareguard_ticket_revoked',
      );
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          revoked: true,
          currentState: 'OUTSIDE',
          revokedAt: now,
          revokedBy: "8822d655-e711-7194-bd65-aaa5bf5f254c",
        },
      });

      return;
    }

    if (result.shouldBlock || failCount >= this.BASE_THRESHOLD) {
      this.#logger.warn(
        { ticketId, failCount, reason: result.reason },
        'shareguard_ticket_blocked',
      );
      await this.prisma.shareGuard.update({
        where: { ticketId },
        data: {
          failCount,
          lastFailAt: now,
          blockedUntil: new Date(now.getTime() + this.BLOCK_TTL_MS),
          reason: result.reason,
        },
      });

      return;
    }

    await this.prisma.shareGuard.update({
      where: { ticketId },
      data: {
        failCount,
        lastFailAt: now,
        reason: result.reason,
      },
    });

    this.#logger.debug(
      { ticketId, failCount, reason: result.reason, score: result.score },
      'shareguard_risk_recorded',
    );
  }
}
