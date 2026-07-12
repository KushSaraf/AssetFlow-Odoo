import { BadRequestException, ConflictException } from '@nestjs/common';
import { AllocationsService } from './allocations.service';

/**
 * Unit tests for the brief's headline allocation rule:
 * "Priya has Laptop AF-0114. If Raj tries to allocate it too, the system
 *  blocks it and shows him 'currently held by Priya'."
 */
describe('AllocationsService', () => {
  const manager = { id: 'mgr-1', role: 'Asset Manager' };
  const laptop = {
    id: 'asset-1',
    tag: 'AF-0114',
    name: 'Dell Laptop',
    status: 'Allocated',
    condition: 'Good',
  };
  const openAllocation = {
    id: 'alloc-1',
    asset_id: laptop.id,
    employee_id: 'priya',
    returned_at: null,
    employee: { id: 'priya', name: 'Priya Shah' },
    department: null,
  };

  let prisma: any;
  let service: AllocationsService;

  beforeEach(() => {
    prisma = {
      asset: { findUnique: jest.fn(async () => laptop) },
      allocation: { findFirst: jest.fn(async () => openAllocation) },
      $transaction: jest.fn(),
    };
    service = new AllocationsService(prisma);
  });

  it('blocks allocating an already-allocated asset with the current holder in meta', async () => {
    expect.assertions(3);
    try {
      await service.create(manager, {
        asset_id: laptop.id,
        employee_id: 'raj',
      });
    } catch (e: any) {
      expect(e).toBeInstanceOf(ConflictException);
      const body = e.getResponse();
      expect(body.error.code).toBe('already_allocated');
      expect(body.error.meta.current_holder.employee.name).toBe('Priya Shah');
    }
  });

  it('requires exactly one of employee or department', async () => {
    await expect(
      service.create(manager, { asset_id: laptop.id }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(manager, {
        asset_id: laptop.id,
        employee_id: 'raj',
        department_id: 'dept-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks allocating a Retired asset even without an open allocation', async () => {
    prisma.allocation.findFirst = jest.fn(async () => null);
    prisma.asset.findUnique = jest.fn(async () => ({
      ...laptop,
      status: 'Retired',
    }));
    await expect(
      service.create(manager, { asset_id: laptop.id, employee_id: 'raj' }),
    ).rejects.toThrow(ConflictException);
  });

  it('requires check-in notes on return (ui-spec §7.1)', async () => {
    await expect(
      service.returnAsset(manager, 'alloc-1', { condition_in: 'Good' }),
    ).rejects.toThrow(BadRequestException);
  });
});
