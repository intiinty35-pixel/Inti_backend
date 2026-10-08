import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateContactReportDto } from './dto/create-contact-report.dto';
import { ContactReportQueryDto } from './dto/contact-report-query.dto';

export interface ContactReportRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  message: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ContactReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateContactReportDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;
    const topic = dto.topic.trim();
    const message = dto.message.trim();

    const [report] = await this.prisma.$queryRaw<ContactReportRecord[]>`
      INSERT INTO "contact_reports" ("id", "name", "email", "phone", "topic", "message", "updatedAt")
      VALUES (gen_random_uuid(), ${name}, ${email}, ${phone}, ${topic}, ${message}, CURRENT_TIMESTAMP)
      RETURNING "id", "name", "email", "phone", "topic", "message", "status", "createdAt", "updatedAt"
    `;

    void this.mail.sendContactReportToAdmin({
      name,
      email,
      phone,
      topic,
      message,
      reportId: report.id,
    });

    void this.mail.sendContactReportConfirmation({
      name,
      email,
      topic,
    });

    return {
      id: report.id,
      message: 'Consulta enviada correctamente',
    };
  }

  async list(query: ContactReportQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const [items, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ContactReportRecord[]>`
        SELECT "id", "name", "email", "phone", "topic", "message", "status", "createdAt", "updatedAt"
        FROM "contact_reports"
        ORDER BY "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "contact_reports"
      `,
    ]);

    const total = Number(totalRows[0]?.count ?? 0);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }
}
