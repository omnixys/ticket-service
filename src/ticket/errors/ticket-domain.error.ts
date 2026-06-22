import { ContextAccessor } from '@omnixys/context';
import {
  FrameworkException,
  TicketNotFoundException as ContractTicketNotFoundException,
  type FrameworkExceptionOptions,
} from '@omnixys/contracts';

function options(
  metadata: Readonly<Record<string, unknown>> = {},
  cause?: unknown,
): FrameworkExceptionOptions {
  const context = ContextAccessor.get();
  return {
    cause,
    context: {
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      traceId: context?.trace?.traceId,
      actorId: context?.principal?.actorId,
      tenantId: context?.tenant?.tenantId ?? context?.principal?.tenantId,
    },
    metadata,
  };
}

export class TicketNotFoundException extends ContractTicketNotFoundException {
  constructor(ticketId?: string) {
    super(ticketId, options());
  }
}

export class TicketDomainException extends FrameworkException {
  constructor(
    code: string,
    message: string,
    metadata: Readonly<Record<string, unknown>> = {},
    cause?: unknown,
  ) {
    super(code, message, options(metadata, cause));
  }
}

export class TicketAlreadyExistsException extends TicketDomainException {
  constructor(invitationId: string) {
    super(
      'TICKET_ALREADY_EXISTS',
      'A ticket already exists for this invitation',
      {
        invitationId,
      },
    );
  }
}

export class TicketAccessDeniedException extends TicketDomainException {
  constructor(ticketId?: string, reason = 'insufficient-permission') {
    super('TICKET_ACCESS_DENIED', 'Ticket access is not authorized', {
      ticketId,
      reason,
    });
  }
}

export class TicketDeviceAlreadyBoundException extends TicketDomainException {
  constructor(ticketId: string) {
    super(
      'TICKET_DEVICE_ALREADY_BOUND',
      'Ticket is already bound to another device',
      {
        ticketId,
      },
    );
  }
}

export class TicketDeviceKeyInvalidException extends TicketDomainException {
  constructor(ticketId: string) {
    super(
      'TICKET_DEVICE_KEY_INVALID',
      'Device public key must be a P-256 EC public key',
      { ticketId },
    );
  }
}

export class TicketNonceUninitializedException extends TicketDomainException {
  constructor(ticketId: string) {
    super('TICKET_NONCE_UNINITIALIZED', 'Ticket nonce is not initialized', {
      ticketId,
    });
  }
}

export class TicketVerificationTokenException extends TicketDomainException {
  constructor(reason: 'invalid-token' | 'mapping-not-found', metadata = {}) {
    super(
      'TICKET_VERIFICATION_TOKEN_INVALID',
      'Guest verification ticket is invalid or expired',
      { reason, ...metadata },
    );
  }
}

export class TicketTokenInvalidException extends TicketDomainException {
  constructor(cause?: unknown) {
    super('TICKET_TOKEN_INVALID', 'QR token is invalid or expired', {}, cause);
  }
}
