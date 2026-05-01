/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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

/* eslint-disable no-console */
import { env } from '../env.js';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import axios, { type AxiosError } from 'axios';

// =====================================================
// 🔹 OPTIONAL HEALTH CHECK: KEYCLOAK
// =====================================================

async function verifyKeycloak(): Promise<void> {
  const base = env.KC_URL;
  const realm = env.KC_REALM;

  const url = `${base}/realms/${realm}`;

  try {
    const res = await axios.get(url);
    console.log(
      `[Keycloak] ✅ Realm reachable: ${res.status} ${res.statusText}`,
    );
  } catch (error: unknown) {
    const err = error as AxiosError;
    const msg =
      err.response?.status && err.response.statusText
        ? `${err.response.status} ${err.response.statusText}`
        : (err.message ?? 'Unknown error');
    console.error(`[Keycloak] ❌ Cannot reach ${url} – ${msg}`);
    throw new Error('Keycloak not reachable — aborting tests.', {
      cause: error,
    });
  }
}

// =====================================================
// 🚀 CREATE TEST APPLICATION
// =====================================================

export async function createTestApp(): Promise<{ app: INestApplication }> {
  await verifyKeycloak();
  const { AppModule } = await import('../../src/app.module.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.enableShutdownHooks();
  await app.init();

  console.log('[setup-e2e] ✅ NestJS application initialized');
  return { app };
}

// =====================================================
// 🧹 GRACEFUL SHUTDOWN (AFTER TESTS)
// =====================================================

let appRef: INestApplication | null = null;

globalThis.createTestApp = async (): Promise<{ app: INestApplication }> => {
  const { app } = await createTestApp();
  appRef = app;
  return { app };
};

afterAll(async () => {
  if (!appRef) {
    return;
  }

  console.log('[setup-e2e] 🧹 Initiating graceful shutdown ...');
  try {
    await appRef.close();
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('[setup-e2e] ✅ All modules closed cleanly.');
  } catch (e) {
    console.warn('[setup-e2e] ⚠️ Error during app.close()', e);
  }
});
