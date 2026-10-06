import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MailAddress {
  email: string;
  name?: string;
}

interface SendMailInput {
  to: MailAddress[];
  subject: string;
  html: string;
  replyTo?: MailAddress;
}

interface LeadNotificationInput {
  ownerEmail: string;
  ownerName: string;
  publicationType: 'propiedad' | 'proyecto';
  publicationTitle: string;
  publicationUrl: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string | null;
  message: string;
}

interface PriceAlertInput {
  ownerEmail: string;
  ownerName: string;
  propertyTitle: string;
  propertyUrl: string;
  userName: string;
  userEmail: string;
  targetPrice?: string | null;
}

interface WelcomeInput {
  email: string;
  name: string;
  isProfessional?: boolean;
}

interface MembershipApprovedInput {
  email: string;
  name: string;
  planName: string;
  expiresAt?: Date | null;
}

interface AdminNoticeInput {
  email: string;
  name: string;
  subject?: string;
  message?: string;
}

interface ReferralStatusUpdatedInput {
  referrerName: string;
  referrerEmail: string;
  interestLabel: string;
  projectName: string;
  status: string;
  pointsAwarded: number;
  referralPoints: number;
  totalPoints: number;
}

interface ReferrerWelcomeInput {
  referrerName: string;
  referrerEmail: string;
  referrerCode: string;
}

interface RedemptionRequestedInput {
  referrerName: string;
  referrerEmail: string;
  incentiveName: string;
  pointsSpent: number;
  remainingPoints: number;
}

interface RedemptionApprovedInput {
  referrerName: string;
  referrerEmail: string;
  incentiveName: string;
  pointsSpent: number;
}

interface RedemptionRejectedInput {
  referrerName: string;
  referrerEmail: string;
  incentiveName: string;
  pointsRefunded: number;
  newBalance: number;
  reason?: string;
}

interface RedemptionDeliveredInput {
  referrerName: string;
  referrerEmail: string;
  incentiveName: string;
}

const BRAND = {
  primary: '#00124f',
  accent: '#f2a900',
  soft: '#e8ecf8',
  canvas: '#f5f6fa',
  ink: '#0b1437',
  muted: '#646d8a',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendLeadNotification(input: LeadNotificationInput) {
    return this.send({
      to: [{ email: input.ownerEmail, name: input.ownerName }],
      replyTo: { email: input.leadEmail, name: input.leadName },
      subject: `Nueva consulta por ${input.publicationTitle}`,
      html: this.layout({
        preheader: 'Tienes una nueva consulta desde ARIZ.',
        title: `Nueva consulta por tu ${input.publicationType}`,
        intro: `Hola ${this.escape(input.ownerName)}, alguien quiere comunicarse por tu publicación.`,
        content: `
          ${this.infoRow(input.publicationType === 'proyecto' ? 'Proyecto' : 'Propiedad', input.publicationTitle)}
          ${this.infoRow('Interesado', input.leadName)}
          ${this.infoRow('Correo', input.leadEmail)}
          ${input.leadPhone ? this.infoRow('Telefono', input.leadPhone) : ''}
          <div style="margin-top:18px;padding:16px;border-radius:12px;background:${BRAND.canvas};color:${BRAND.ink};line-height:1.65;">
            ${this.escape(input.message).replace(/\n/g, '<br>')}
          </div>
        `,
        button: {
          label:
            input.publicationType === 'proyecto'
              ? 'Ver proyecto'
              : 'Ver propiedad',
          url: this.absoluteUrl(input.publicationUrl),
        },
      }),
    });
  }

  async sendPriceAlertToOwner(input: PriceAlertInput) {
    return this.send({
      to: [{ email: input.ownerEmail, name: input.ownerName }],
      replyTo: { email: input.userEmail, name: input.userName },
      subject: `Aviso de baja de precio: ${input.propertyTitle}`,
      html: this.layout({
        preheader: 'Un usuario activo una alerta de precio.',
        title: 'Alguien espera una baja de precio',
        intro: `Hola ${this.escape(input.ownerName)}, un usuario activo el aviso de baja de precio en tu propiedad.`,
        content: `
          ${this.infoRow('Propiedad', input.propertyTitle)}
          ${this.infoRow('Usuario', input.userName)}
          ${this.infoRow('Correo', input.userEmail)}
          ${input.targetPrice ? this.infoRow('Precio objetivo', input.targetPrice) : ''}
        `,
        button: {
          label: 'Revisar propiedad',
          url: this.absoluteUrl(input.propertyUrl),
        },
      }),
    });
  }

  async sendWelcome(input: WelcomeInput) {
    return this.send({
      to: [{ email: input.email, name: input.name }],
      subject: 'Bienvenido a ARIZ',
      html: this.layout({
        preheader: 'Tu cuenta en ARIZ ya esta lista.',
        title: `Bienvenido, ${this.escape(input.name)}`,
        intro: input.isProfessional
          ? 'Tu cuenta profesional fue creada correctamente. Completa tu perfil y prepara tus publicaciones.'
          : 'Tu cuenta fue creada correctamente. Ya puedes guardar propiedades, crear alertas y contactar anunciantes.',
        content: `
          <p style="margin:0;color:${BRAND.muted};line-height:1.7;">
            Gracias por confiar en ARIZ. Hemos preparado una experiencia clara y ordenada para que encuentres o publiques oportunidades inmobiliarias con mayor confianza.
          </p>
        `,
        button: { label: 'Ir a ARIZ', url: this.frontendUrl() },
      }),
    });
  }

  async sendMembershipApproved(input: MembershipApprovedInput) {
    const expires = input.expiresAt
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(
          input.expiresAt,
        )
      : null;

    return this.send({
      to: [{ email: input.email, name: input.name }],
      subject: `Membresia aprobada: ${input.planName}`,
      html: this.layout({
        preheader: 'Tu membresia fue aprobada.',
        title: 'Tu membresia ya esta activa',
        intro: `Hola ${this.escape(input.name)}, aprobamos tu membresia ${this.escape(input.planName)}.`,
        content: `
          ${this.infoRow('Plan', input.planName)}
          ${expires ? this.infoRow('Vigencia hasta', expires) : ''}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Ya puedes publicar y administrar tus anuncios segun los limites de tu plan.
          </p>
        `,
        button: {
          label: 'Ir a mi panel',
          url: `${this.frontendUrl()}/panel/owner/subscription`,
        },
      }),
    });
  }

  async sendReferralStatusUpdated(input: ReferralStatusUpdatedInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: `Actualización de tu referido en ARIZ: ${input.status}`,
      html: this.layout({
        preheader: 'Tu referido avanzó y tus puntos fueron actualizados.',
        title: 'Tus puntos en ARIZ fueron actualizados',
        intro: `Hola ${this.escape(input.referrerName)}, el estado de tu referido fue actualizado correctamente.`,
        content: `
          ${this.infoRow('Interés', input.interestLabel)}
          ${this.infoRow('Proyecto', input.projectName)}
          ${this.infoRow('Estado actualizado', input.status)}
          ${this.infoRow('Puntos obtenidos en este cambio', String(input.pointsAwarded))}
          ${this.infoRow('Puntos acumulados del referido', String(input.referralPoints))}
          ${this.infoRow('Total acumulado de tus referidos', String(input.totalPoints))}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Gracias por confiar en ARIZ y ayudarnos a conectar más personas con nuevas oportunidades inmobiliarias.
          </p>
        `,
        button: { label: 'Conocer ARIZ', url: this.frontendUrl() },
      }),
    });
  }

  async sendReferrerWelcome(input: ReferrerWelcomeInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: '¡Bienvenido al programa de referidos de ARIZ!',
      html: this.layout({
        preheader: 'Tu código de referente está listo para usar.',
        title: '¡Bienvenido al programa de referidos!',
        intro: `Hola ${this.escape(input.referrerName)}, gracias por unirte al programa de referidos de ARIZ.`,
        content: `
          <p style="margin:0 0 18px;color:${BRAND.muted};line-height:1.7;">
            Tu registro fue exitoso. A partir de ahora puedes referir personas a nuestros proyectos inmobiliarios y acumular puntos con cada referido.
          </p>
          <div style="background:${BRAND.canvas};border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
            <p style="margin:0 0 8px;color:${BRAND.muted};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Tu código de referente</p>
            <p style="margin:0;font-size:24px;font-weight:800;color:${BRAND.primary};letter-spacing:.05em;">${this.escape(input.referrerCode)}</p>
          </div>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Comparte este código con las personas que quieras referir. Cuando lo usen para registrarse, sus referidos se vincularán automáticamente a tu cuenta y podrás ver tus puntos acumulados.
          </p>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            <strong style="color:${BRAND.ink};">¿Cómo funciona?</strong><br>
            • Cada referido inicia con puntos al ser contactado<br>
            • Ganas más puntos cuando el referido avanza de estado<br>
            • Los puntos se acumulan por cada referido exitoso
          </p>
        `,
        button: { label: 'Conocer más sobre ARIZ', url: this.frontendUrl() },
      }),
    });
  }

  async sendAdminNotice(input: AdminNoticeInput) {
    const message =
      input.message ??
      'Estamos revisando tu cuenta y tus publicaciones para mantener la calidad de la plataforma. Si necesitas actualizar datos o corregir informacion, ingresa a tu panel de ARIZ.';

    return this.send({
      to: [{ email: input.email, name: input.name }],
      subject: input.subject ?? 'Notificacion administrativa de ARIZ',
      html: this.layout({
        preheader: 'Tienes una notificacion administrativa de ARIZ.',
        title: 'Notificacion administrativa',
        intro: `Hola ${this.escape(input.name)}, el equipo de ARIZ te envia este aviso desde el panel administrativo.`,
        content: `
          <div style="margin-top:4px;padding:16px;border-radius:12px;background:${BRAND.canvas};color:${BRAND.ink};line-height:1.65;">
            ${this.escape(message).replace(/\n/g, '<br>')}
          </div>
        `,
        button: { label: 'Ir a mi panel', url: `${this.frontendUrl()}/panel/owner` },
      }),
    });
  }

  async sendRedemptionRequested(input: RedemptionRequestedInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: 'Solicitud de canje recibida - ARIZ',
      html: this.layout({
        preheader: 'Tu solicitud de canje ha sido recibida.',
        title: 'Solicitud de canje recibida',
        intro: `Hola ${this.escape(input.referrerName)}, hemos recibido tu solicitud de canje.`,
        content: `
          ${this.infoRow('Recompensa', input.incentiveName)}
          ${this.infoRow('Puntos utilizados', `${input.pointsSpent} pts`)}
          ${this.infoRow('Puntos restantes', `${input.remainingPoints} pts`)}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Tu solicitud está siendo revisada por nuestro equipo. Te notificaremos cuando sea aprobada o si necesitamos más información.
          </p>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            <strong style="color:${BRAND.ink};">¿Qué sigue?</strong><br>
            • Revisaremos tu solicitud en las próximas 24-48 horas<br>
            • Si es aprobada, coordinaremos la entrega de tu recompensa<br>
            • Si es rechazada, tus puntos serán devueltos automáticamente
          </p>
        `,
        button: { label: 'Ver mis canjes', url: `${this.frontendUrl()}/rewards/my` },
      }),
    });
  }

  async sendRedemptionApproved(input: RedemptionApprovedInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: '¡Tu canje ha sido aprobado! - ARIZ',
      html: this.layout({
        preheader: 'Tu canje ha sido aprobado.',
        title: '¡Canje aprobado!',
        intro: `Hola ${this.escape(input.referrerName)}, tu solicitud de canje ha sido aprobada.`,
        content: `
          ${this.infoRow('Recompensa', input.incentiveName)}
          ${this.infoRow('Puntos utilizados', `${input.pointsSpent} pts`)}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Tu recompensa está siendo preparada. Pronto nos pondremos en contacto contigo para coordinar la entrega.
          </p>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            ¡Gracias por ser parte del programa de referidos de ARIZ!
          </p>
        `,
        button: { label: 'Ver mis canjes', url: `${this.frontendUrl()}/rewards/my` },
      }),
    });
  }

  async sendRedemptionRejected(input: RedemptionRejectedInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: 'Actualización sobre tu canje - ARIZ',
      html: this.layout({
        preheader: 'Tu solicitud de canje ha sido revisada.',
        title: 'Solicitud de canje revisada',
        intro: `Hola ${this.escape(input.referrerName)}, lamentablemente tu solicitud de canje no pudo ser aprobada en esta ocasión.`,
        content: `
          ${this.infoRow('Recompensa', input.incentiveName)}
          ${this.infoRow('Puntos devueltos', `${input.pointsRefunded} pts`)}
          ${this.infoRow('Nuevo saldo', `${input.newBalance} pts`)}
          ${input.reason ? `<p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;"><strong style="color:${BRAND.ink};">Motivo:</strong> ${this.escape(input.reason)}</p>` : ''}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Tus puntos han sido devueltos a tu cuenta y están disponibles para futuros canjes.
          </p>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Si tienes alguna duda, no dudes en contactarnos.
          </p>
        `,
        button: { label: 'Ver catálogo de recompensas', url: `${this.frontendUrl()}/rewards` },
      }),
    });
  }

  async sendRedemptionDelivered(input: RedemptionDeliveredInput) {
    return this.send({
      to: [{ email: input.referrerEmail, name: input.referrerName }],
      subject: '¡Tu recompensa ha sido entregada! - ARIZ',
      html: this.layout({
        preheader: 'Tu recompensa ha sido entregada.',
        title: '¡Recompensa entregada!',
        intro: `Hola ${this.escape(input.referrerName)}, tu recompensa ha sido marcada como entregada.`,
        content: `
          ${this.infoRow('Recompensa', input.incentiveName)}
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Esperamos que disfrutes tu recompensa. ¡Gracias por ser parte del programa de referidos de ARIZ!
          </p>
          <p style="margin:18px 0 0;color:${BRAND.muted};line-height:1.7;">
            Sigue refiriendo personas para acumular más puntos y desbloquear nuevas recompensas.
          </p>
        `,
        button: { label: 'Ver catálogo de recompensas', url: `${this.frontendUrl()}/rewards` },
      }),
    });
  }

  private async send(input: SendMailInput) {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const senderEmail = this.config.get<string>('BREVO_SENDER_EMAIL');
    const senderName = this.config.get<string>('BREVO_SENDER_NAME', 'ARIZ');

    if (!apiKey || !senderEmail) {
      this.logger.warn('Brevo no configurado: correo omitido');
      return;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: input.to,
          replyTo: input.replyTo,
          subject: input.subject,
          htmlContent: input.html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Brevo respondio ${response.status}: ${body}`);
      }
    } catch (error) {
      this.logger.error('No se pudo enviar correo con Brevo', error as Error);
    }
  }

  private layout({
    preheader,
    title,
    intro,
    content,
    button,
  }: {
    preheader: string;
    title: string;
    intro: string;
    content: string;
    button?: { label: string; url: string };
  }) {
    const logo = `${this.frontendUrl()}/logo/logo.png`;

    return `
      <!doctype html>
      <html>
        <body style="margin:0;background:${BRAND.canvas};font-family:Segoe UI,Arial,sans-serif;color:${BRAND.ink};">
          <div style="display:none;max-height:0;overflow:hidden;">${this.escape(preheader)}</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.canvas};padding:32px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dde1ec;border-radius:18px;overflow:hidden;">
                  <tr>
                    <td style="background:${BRAND.primary};padding:26px 28px;">
                      <img src="${logo}" alt="ARIZ" style="height:40px;width:auto;display:block;background:#ffffff;border-radius:8px;padding:6px;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 28px 10px;">
                      <p style="margin:0 0 10px;color:${BRAND.accent};font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">ARIZ Proyectos</p>
                      <h1 style="margin:0;color:${BRAND.primary};font-size:28px;line-height:1.2;font-weight:800;">${title}</h1>
                      <p style="margin:14px 0 0;color:${BRAND.muted};font-size:15px;line-height:1.7;">${intro}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px 6px;">${content}</td>
                  </tr>
                  ${
                    button
                      ? `<tr><td style="padding:22px 28px 34px;"><a href="${button.url}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;font-weight:800;border-radius:10px;padding:13px 18px;">${this.escape(button.label)}</a></td></tr>`
                      : ''
                  }
                </table>
                <p style="max-width:640px;margin:16px auto 0;color:${BRAND.muted};font-size:12px;line-height:1.5;">
                  Este correo fue enviado automaticamente por ARIZ.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private infoRow(label: string, value: string) {
    return `
      <div style="padding:12px 0;border-bottom:1px solid #dde1ec;">
        <span style="display:block;color:${BRAND.muted};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${this.escape(label)}</span>
        <strong style="display:block;margin-top:4px;color:${BRAND.ink};font-size:15px;">${this.escape(value)}</strong>
      </div>
    `;
  }

  private frontendUrl() {
    return this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  private absoluteUrl(value: string) {
    if (/^https?:\/\//i.test(value)) return value;
    return `${this.frontendUrl()}${value.startsWith('/') ? value : `/${value}`}`;
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
