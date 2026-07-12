import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const REMINDER_WINDOW_MIN = 15;

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async getResources() {
    // Bookable assets stay bookable while Allocated etc.; only terminal
    // states drop out of the picker (ui-spec §5).
    return this.prisma.asset.findMany({
      where: {
        is_bookable: true,
        status: { notIn: ['Retired', 'Disposed', 'Lost'] },
      },
    });
  }

  /** Ongoing/Completed are derived from now() vs start/end (ui-spec §3 Screen 6). */
  private withDerivedStatus<T extends { status: string; start_time: Date; end_time: Date }>(
    booking: T,
  ): T {
    if (booking.status === 'Cancelled') return booking;
    const now = new Date();
    let status = 'Upcoming';
    if (now >= booking.end_time) status = 'Completed';
    else if (now >= booking.start_time) status = 'Ongoing';
    return { ...booking, status };
  }

  async findAll(filters: any, user: any) {
    const where: any = {};
    if (filters.asset_id) where.asset_id = filters.asset_id;
    if (filters.date) {
      const date = new Date(filters.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.start_time = { gte: date, lt: nextDay };
    }

    if (String(filters.my_bookings) === 'true') {
      where.booked_by = user.id;
    }
    if (String(filters.upcoming) === 'true') {
      where.start_time = { gte: new Date() };
      where.status = { not: 'Cancelled' };
    }

    const bookings = await this.prisma.resource_booking.findMany({
      where,
      orderBy: { start_time: 'asc' },
      include: { asset: true, booker: true },
    });
    return bookings.map((b) => this.withDerivedStatus(b));
  }

  private validateRange(start_time: Date, end_time: Date) {
    if (isNaN(start_time.getTime()) || isNaN(end_time.getTime())) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'Provide a valid start and end time.',
          field: 'start_time',
        },
      });
    }
    if (end_time <= start_time) {
      throw new BadRequestException({
        error: {
          code: 'validation_error',
          message: 'End time must be after start time.',
          field: 'end_time',
        },
      });
    }
  }

  async create(user: any, data: any) {
    const start_time = new Date(data.start_time);
    const end_time = new Date(data.end_time);
    this.validateRange(start_time, end_time);

    const asset = await this.prisma.asset.findUnique({
      where: { id: data.asset_id },
    });
    if (!asset) {
      throw new NotFoundException({
        error: { code: 'not_found', message: 'Resource not found' },
      });
    }
    if (!asset.is_bookable || ['Retired', 'Disposed', 'Lost'].includes(asset.status)) {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'This asset is not a bookable resource.',
        },
      });
    }

    // Overlap check + insert inside one transaction. SQLite serializes
    // writes, so this is the race-safe equivalent of Postgres' EXCLUDE
    // constraint (documented fallback in docs/database/PLAN.md §3).
    const booking = await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.resource_booking.findFirst({
        where: {
          asset_id: data.asset_id,
          status: { not: 'Cancelled' },
          AND: [
            { start_time: { lt: end_time } },
            { end_time: { gt: start_time } },
          ],
        },
        include: { booker: true },
      });

      if (overlap) {
        throw new ConflictException({
          error: {
            code: 'overlap',
            message: 'This asset is already booked for the selected time',
            meta: { conflicting_booking: overlap },
          },
        });
      }

      const created = await tx.resource_booking.create({
        data: {
          asset_id: data.asset_id,
          booked_by: user.id,
          start_time,
          end_time,
          purpose: data.purpose,
          on_behalf_of_department_id: data.on_behalf_of_department_id,
        },
      });

      await tx.notification.create({
        data: {
          recipient_id: user.id,
          type: 'BookingConfirmed',
          payload: {
            message: `Your booking for ${asset.name} (${asset.tag}) has been confirmed for ${start_time.toLocaleString()}.`,
            booking_id: created.id,
          },
        },
      });

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'booked_resource',
          entity_type: 'resource_booking',
          entity_id: created.id,
        },
      });

      return created;
    });

    return booking;
  }

  private assertOwnerOrManager(user: any, booking: { booked_by: string }) {
    if (
      booking.booked_by !== user.id &&
      !['Admin', 'Asset Manager'].includes(user.role)
    ) {
      throw new ForbiddenException({
        error: {
          code: 'forbidden',
          message: 'You can only modify your own bookings.',
        },
      });
    }
  }

  async update(id: string, user: any, data: any) {
    const booking = await this.prisma.resource_booking.findUnique({
      where: { id },
    });
    if (!booking) throw new NotFoundException();
    this.assertOwnerOrManager(user, booking);
    if (booking.status === 'Cancelled') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'Cancelled bookings cannot be rescheduled.',
        },
      });
    }

    const start_time = new Date(data.start_time);
    const end_time = new Date(data.end_time);
    this.validateRange(start_time, end_time);

    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.resource_booking.findFirst({
        where: {
          asset_id: booking.asset_id,
          id: { not: id },
          status: { not: 'Cancelled' },
          AND: [
            { start_time: { lt: end_time } },
            { end_time: { gt: start_time } },
          ],
        },
        include: { booker: true },
      });

      if (overlap) {
        throw new ConflictException({
          error: {
            code: 'overlap',
            message: 'This asset is already booked for the selected time',
            meta: { conflicting_booking: overlap },
          },
        });
      }

      const updated = await tx.resource_booking.update({
        where: { id },
        data: { start_time, end_time },
      });

      await tx.activity_log.create({
        data: {
          actor_id: user.id,
          action: 'rescheduled_booking',
          entity_type: 'resource_booking',
          entity_id: id,
        },
      });

      return updated;
    });
  }

  async cancel(id: string, user: any, reason?: string) {
    const booking = await this.prisma.resource_booking.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!booking) throw new NotFoundException();
    this.assertOwnerOrManager(user, booking);
    if (booking.status === 'Cancelled') {
      throw new ConflictException({
        error: {
          code: 'invalid_status',
          message: 'This booking is already cancelled.',
        },
      });
    }

    const update = await this.prisma.resource_booking.update({
      where: { id },
      data: { status: 'Cancelled' },
    });

    await this.prisma.notification.create({
      data: {
        recipient_id: booking.booked_by,
        type: 'BookingCancelled',
        payload: {
          message: `Your booking for ${booking.asset.name} (${booking.asset.tag}) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
          booking_id: booking.id,
        },
      },
    });

    await this.prisma.logActivity(
      user.id,
      'cancelled_booking',
      'resource_booking',
      id,
    );

    return update;
  }

  /** Booking Reminder before the slot starts (ui-spec §6 catalog). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendBookingReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000);

    const startingSoon = await this.prisma.resource_booking.findMany({
      where: {
        status: { not: 'Cancelled' },
        start_time: { gte: now, lte: windowEnd },
      },
      include: { asset: true },
    });
    if (startingSoon.length === 0) return;

    // ponytail: JSON payloads aren't queryable on SQLite — dedupe in JS
    // against recent reminders instead of a schema change.
    const recent = await this.prisma.notification.findMany({
      where: {
        type: 'BookingReminder',
        created_at: { gte: new Date(now.getTime() - 2 * 3600_000) },
      },
      select: { payload: true },
    });
    const alreadyReminded = new Set(
      recent.map((n) => (n.payload as any)?.booking_id).filter(Boolean),
    );

    for (const booking of startingSoon) {
      if (alreadyReminded.has(booking.id)) continue;
      await this.prisma.notification.create({
        data: {
          recipient_id: booking.booked_by,
          type: 'BookingReminder',
          payload: {
            message: `Reminder: your booking for ${booking.asset.name} (${booking.asset.tag}) starts at ${booking.start_time.toLocaleTimeString()}.`,
            booking_id: booking.id,
          },
        },
      });
    }
  }
}
