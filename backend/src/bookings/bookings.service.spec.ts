import { BadRequestException, ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

/**
 * Unit tests for the brief's headline booking rule:
 * "Room B2 is booked 9:00–10:00. A request for 9:30–10:30 gets rejected;
 *  a request for 10:00–11:00 is fine since it starts right after."
 */
describe('BookingsService', () => {
  const user = { id: 'emp-1', role: 'Employee' };
  const room = {
    id: 'room-b2',
    name: 'Room B2',
    tag: 'AF-0201',
    is_bookable: true,
    status: 'Available',
  };
  const nineToTen = {
    id: 'bk-1',
    asset_id: room.id,
    start_time: new Date('2026-07-12T09:00:00Z'),
    end_time: new Date('2026-07-12T10:00:00Z'),
    status: 'Upcoming',
  };

  let prisma: any;
  let service: BookingsService;

  beforeEach(() => {
    const tx = {
      resource_booking: {
        // simulate the DB overlap query with a real interval check
        findFirst: jest.fn(async ({ where }: any) => {
          const start = where.AND[1].end_time.gt as Date;
          const end = where.AND[0].start_time.lt as Date;
          const overlaps =
            nineToTen.start_time < end && nineToTen.end_time > start;
          return overlaps ? nineToTen : null;
        }),
        create: jest.fn(async ({ data }: any) => ({ id: 'bk-new', ...data })),
      },
      notification: { create: jest.fn() },
      activity_log: { create: jest.fn() },
    };
    prisma = {
      asset: { findUnique: jest.fn(async () => room) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    service = new BookingsService(prisma);
  });

  it('rejects an overlapping booking (9:30–10:30 vs existing 9:00–10:00)', async () => {
    await expect(
      service.create(user, {
        asset_id: room.id,
        start_time: '2026-07-12T09:30:00Z',
        end_time: '2026-07-12T10:30:00Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('accepts an adjacent booking that starts exactly when the prior one ends (10:00–11:00)', async () => {
    const booking = await service.create(user, {
      asset_id: room.id,
      start_time: '2026-07-12T10:00:00Z',
      end_time: '2026-07-12T11:00:00Z',
    });
    expect(booking.id).toBe('bk-new');
  });

  it('rejects end time before start time', async () => {
    await expect(
      service.create(user, {
        asset_id: room.id,
        start_time: '2026-07-12T11:00:00Z',
        end_time: '2026-07-12T10:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects booking a non-bookable asset', async () => {
    prisma.asset.findUnique = jest.fn(async () => ({
      ...room,
      is_bookable: false,
    }));
    await expect(
      service.create(user, {
        asset_id: room.id,
        start_time: '2026-07-12T12:00:00Z',
        end_time: '2026-07-12T13:00:00Z',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
