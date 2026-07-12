import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async getResources() {
    return this.prisma.asset.findMany({
      where: { is_bookable: true, status: 'Available' },
    });
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

    return this.prisma.resource_booking.findMany({
      where,
      orderBy: { start_time: 'asc' },
      include: { asset: true, booker: true },
    });
  }

  async create(user: any, data: any) {
    const start_time = new Date(data.start_time);
    const end_time = new Date(data.end_time);

    const overlap = await this.prisma.resource_booking.findFirst({
      where: {
        asset_id: data.asset_id,
        status: { not: 'Cancelled' },
        AND: [
          { start_time: { lt: end_time } },
          { end_time: { gt: start_time } },
        ],
      },
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

    const booking = await this.prisma.resource_booking.create({
      data: {
        asset_id: data.asset_id,
        booked_by: user.id,
        start_time,
        end_time,
        purpose: data.purpose,
        on_behalf_of_department_id: data.on_behalf_of_department_id,
      },
    });

    const asset = await this.prisma.asset.findUnique({ where: { id: data.asset_id } });
    if (asset) {
      await this.prisma.notification.create({
        data: {
          recipient_id: user.id,
          type: 'BookingConfirmed',
          payload: { message: `Your booking for ${asset.name} (${asset.tag}) has been confirmed for ${start_time.toLocaleDateString()}.` },
        },
      });
    }

    return booking;
  }

  async update(id: string, user: any, data: any) {
    const booking = await this.prisma.resource_booking.findUnique({
      where: { id },
    });
    if (!booking) throw new NotFoundException();

    const start_time = new Date(data.start_time);
    const end_time = new Date(data.end_time);

    const overlap = await this.prisma.resource_booking.findFirst({
      where: {
        asset_id: booking.asset_id,
        id: { not: id },
        status: { not: 'Cancelled' },
        AND: [
          { start_time: { lt: end_time } },
          { end_time: { gt: start_time } },
        ],
      },
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

    return this.prisma.resource_booking.update({
      where: { id },
      data: { start_time, end_time },
    });
  }

  async cancel(id: string, user: any, reason?: string) {
    const booking = await this.prisma.resource_booking.findUnique({ where: { id }, include: { asset: true } });
    
    const update = await this.prisma.resource_booking.update({
      where: { id },
      data: { status: 'Cancelled' }, // Could also log reason if schema supported it
    });

    if (booking && booking.asset) {
      await this.prisma.notification.create({
        data: {
          recipient_id: booking.booked_by,
          type: 'BookingCancelled',
          payload: { message: `Your booking for ${booking.asset.name} (${booking.asset.tag}) has been successfully canceled.` },
        },
      });
    }

    return update;
  }
}
