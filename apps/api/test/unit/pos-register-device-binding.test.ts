import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActorRequest } from '../../src/modules/auth/current-actor.js';
import { PosEmployeeGuard } from '../../src/modules/auth/pos-employee.guard.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';
import { PosRegistersService } from '../../src/modules/shifts/registers/pos-registers.service.js';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const registerId = '44444444-4444-4444-8444-444444444444';
const otherRegisterId = '55555555-5555-4555-8555-555555555555';
const deviceId = '66666666-6666-4666-8666-666666666666';
const otherDeviceId = '77777777-7777-4777-8777-777777777777';

const employee: PosEmployeeSession = {
  id: employeeId,
  merchantId,
  username: 'cashier-one',
  displayName: 'Cashier One',
  role: 'cashier',
  permissions: ['open_register_shift', 'sell'],
  branch: { id: branchId, name: 'Main', archivedAt: null },
  deviceId,
  deviceRegister: null,
};

function requestContext(request: Partial<ActorRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeGuard(currentEmployee: PosEmployeeSession): PosEmployeeGuard {
  const auth = { requirePosEmployee: async () => currentEmployee } as unknown as AuthService;
  return new PosEmployeeGuard(auth);
}

test('unpaired browser may list available registers and bind one', async () => {
  const guard = makeGuard(employee);
  const listRequest = {
    path: '/pos/registers',
    method: 'GET',
    query: { branchId },
    body: {},
  } as unknown as ActorRequest;
  const bindRequest = {
    path: '/pos/registers/bind',
    method: 'POST',
    query: {},
    body: { registerId },
  } as unknown as ActorRequest;

  assert.equal(await guard.canActivate(requestContext(listRequest)), true);
  assert.equal(await guard.canActivate(requestContext(bindRequest)), true);
  assert.equal(listRequest.posEmployee, employee);
  assert.equal(bindRequest.posEmployee, employee);
});

test('unpaired browser cannot read a register before setup', async () => {
  const guard = makeGuard(employee);
  const request = {
    path: '/pos/shifts/current',
    method: 'GET',
    query: { registerId },
    body: {},
  } as unknown as ActorRequest;

  await assert.rejects(guard.canActivate(requestContext(request)), ForbiddenException);
});

test('unpaired browser may browse and quote but not change anything', async () => {
  const guard = makeGuard(employee);
  const browse = {
    path: '/pos/orders',
    method: 'GET',
    query: { branchId },
    body: {},
  } as unknown as ActorRequest;
  const quote = {
    path: '/pos/orders/quote',
    method: 'POST',
    query: {},
    body: { items: [] },
  } as unknown as ActorRequest;
  const accept = {
    path: '/pos/orders/88888888-8888-4888-8888-888888888888/accept',
    method: 'POST',
    query: {},
    body: {},
  } as unknown as ActorRequest;

  assert.equal(await guard.canActivate(requestContext(browse)), true);
  assert.equal(await guard.canActivate(requestContext(quote)), true);
  await assert.rejects(guard.canActivate(requestContext(accept)), ForbiddenException);
});

test('paired browser rejects another register from query or command payload', async () => {
  const pairedEmployee = {
    ...employee,
    deviceRegister: { id: registerId, branchId, name: 'Front' },
  } satisfies PosEmployeeSession;
  const guard = makeGuard(pairedEmployee);
  const wrongQuery = {
    path: '/pos/shifts/current',
    method: 'GET',
    query: { registerId: otherRegisterId },
    body: {},
  } as unknown as ActorRequest;
  const wrongCommand = {
    path: '/pos/orders',
    method: 'POST',
    query: {},
    body: { request: { registerId: otherRegisterId } },
  } as unknown as ActorRequest;

  await assert.rejects(guard.canActivate(requestContext(wrongQuery)), ForbiddenException);
  await assert.rejects(guard.canActivate(requestContext(wrongCommand)), ForbiddenException);
});

test('paired browser accepts its register and attaches the authenticated employee', async () => {
  const pairedEmployee = {
    ...employee,
    deviceRegister: { id: registerId, branchId, name: 'Front' },
  } satisfies PosEmployeeSession;
  const guard = makeGuard(pairedEmployee);
  const request = {
    path: '/pos/shifts/current',
    method: 'GET',
    query: { registerId },
    body: {},
  } as unknown as ActorRequest;

  assert.equal(await guard.canActivate(requestContext(request)), true);
  assert.equal(request.posEmployee, pairedEmployee);
});

test('pairing binds an active register on the employee branch', async () => {
  const register = {
    id: registerId,
    branchId,
    deviceId: null,
    active: true,
    name: 'Front',
  };
  let updateInput: unknown;
  const tx = {
    $queryRaw: async () => [register],
    posRegister: {
      findFirst: async () => null,
      updateMany: async (input: unknown) => {
        updateInput = input;
        return { count: 1 };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  assert.deepEqual(await service.pairDeviceToRegister(employee, { registerId }), {
    id: registerId,
    branchId,
    name: 'Front',
  });
  assert.deepEqual(updateInput, {
    where: { id: registerId, merchantId, deviceId: null },
    data: {
      deviceId,
      revision: { increment: 1 },
      updatedBy: employee.username,
    },
  });
});

test('pairing refuses a register outside the employee branch', async () => {
  const register = {
    id: registerId,
    branchId: otherRegisterId,
    deviceId: null,
    active: true,
    name: 'Back',
  };
  const tx = {
    $queryRaw: async () => [register],
    posRegister: {
      findFirst: async () => null,
      updateMany: async () => {
        throw new Error('The register must not be updated.');
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  await assert.rejects(
    service.pairDeviceToRegister(employee, { registerId }),
    ForbiddenException,
  );
});

test('pairing refuses an inactive register', async () => {
  const register = {
    id: registerId,
    branchId,
    deviceId: null,
    active: false,
    name: 'Front',
  };
  const tx = {
    $queryRaw: async () => [register],
    posRegister: {
      findFirst: async () => null,
      updateMany: async () => {
        throw new Error('The register must not be updated.');
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  await assert.rejects(
    service.pairDeviceToRegister(employee, { registerId }),
    /Choose an active POS register/,
  );
});

test('pairing refuses a browser already assigned to a different register', async () => {
  const register = {
    id: registerId,
    branchId,
    deviceId: null,
    active: true,
    name: 'Front',
  };
  const tx = {
    $queryRaw: async () => [register],
    posRegister: {
      findFirst: async () => ({ id: otherRegisterId }),
      updateMany: async () => {
        throw new Error('The register must not be updated.');
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  await assert.rejects(
    service.pairDeviceToRegister(employee, { registerId }),
    /already paired with another register/,
  );
});

test('pairing refuses a register already assigned to another browser', async () => {
  const register = {
    id: registerId,
    branchId,
    deviceId: otherDeviceId,
    active: true,
    name: 'Front',
  };
  const tx = {
    $queryRaw: async () => [register],
    posRegister: {
      findFirst: async () => null,
      updateMany: async () => {
        throw new Error('The register must not be updated.');
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  await assert.rejects(
    service.pairDeviceToRegister(employee, { registerId }),
    /register is already paired with another browser/,
  );
});

test('owner cannot unpair a register while a shift is open', async () => {
  const tx = {
    $queryRaw: async () => [{ id: registerId, deviceId }],
    posRegister: {
      findFirst: async () => ({ id: registerId, revision: 2 }),
      updateMany: async () => {
        throw new Error('The register must not be unpaired.');
      },
    },
    posShift: { findFirst: async () => ({ id: '77777777-7777-4777-8777-777777777777' }) },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  await assert.rejects(
    service.unpairDevice(merchantId, 'owner-one', registerId, { revision: 2 }),
    /Close the active shift before unpairing/,
  );
});

test('owner unpairs a register and increments its revision after shift closure', async () => {
  const updatedRegister = {
    id: registerId,
    branchId,
    deviceId: null,
    name: 'Front',
    active: true,
    revision: 3,
    branch: { name: 'Main' },
  };
  let updateInput: unknown;
  const tx = {
    $queryRaw: async () => [{ id: registerId, deviceId }],
    posRegister: {
      findFirst: async (input: { select?: unknown }) =>
        input.select ? { id: registerId, revision: 2 } : updatedRegister,
      updateMany: async (input: unknown) => {
        updateInput = input;
        return { count: 1 };
      },
    },
    posShift: { findFirst: async () => null },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaService;
  const service = new PosRegistersService(prisma);

  assert.deepEqual(await service.unpairDevice(merchantId, 'owner-one', registerId, { revision: 2 }), {
    id: registerId,
    branchId,
    branchName: 'Main',
    name: 'Front',
    active: true,
    revision: 3,
    devicePaired: false,
  });
  assert.deepEqual(updateInput, {
    where: { id: registerId, merchantId, revision: 2 },
    data: { deviceId: null, revision: { increment: 1 }, updatedBy: 'owner-one' },
  });
});
