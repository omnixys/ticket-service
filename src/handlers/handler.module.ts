/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

import { TicketModule } from '../ticket/ticket.module.js';
import { AuthenticationHandler } from './authentication.handler.js';
import { EventRoleHandler } from './event-role.handler.js';
import { EventSettingsHandler } from './event-settings.handler.js';
import { EventHandler } from './event.handler.js';
import { SeatHandler } from './seat.handler.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [TicketModule],
  providers: [
    SeatHandler,
    AuthenticationHandler,
    EventHandler,
    EventRoleHandler,
    EventSettingsHandler,
  ],
  exports: [
    SeatHandler,
    AuthenticationHandler,
    EventHandler,
    EventRoleHandler,
    EventSettingsHandler,
  ],
})
export class HandlerModule {}
