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
        button: { label: 'Revisar propiedad', url: this.absoluteUrl(input.propertyUrl) },
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
      ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(input.expiresAt)
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
        button: { label: 'Ir a mi panel', url: `${this.frontendUrl()}/panel/owner/subscription` },
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
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
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
