import { Inject, Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { verificationMail } from './mails/verification.mail';
import { passwordResetMail } from './mails/passwordResetMail.mail';
import { supportTicketMail, SupportTicketMailData } from './mails/supportTicket.mail';
import { scheduledQuizAlertMail, ScheduledQuizAlertMailData } from './mails/scheduledQuizAlert.mail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject('RESEND_CLIENT')
    private readonly resend: Resend,
  ) { }

  async sendVerificationEmail(
    email: string,
    OTP: string,
  ) {
    const config = verificationMail;
    this.logger.log(`Dispatching verification OTP [${OTP}] to ${email}`);
    try {
      return await this.resend.emails.send({
        from: config.from,
        to: email,
        subject: config.subject,
        html: config.template({ OTP, email }),
      });
    } catch (err: any) {
      this.logger.error(`Failed to dispatch verification email to ${email}: ${err?.message || err}`);
      throw err;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    OTP: string,
  ) {
    const config = passwordResetMail;
    this.logger.log(`Dispatching password reset OTP to ${email}`);
    try {
      return await this.resend.emails.send({
        from: config.from,
        to: email,
        subject: config.subject,
        html: config.template({ OTP, email }),
      });
    } catch (err: any) {
      this.logger.error(`Failed to dispatch password reset email to ${email}: ${err?.message || err}`);
      throw err;
    }
  }

  async sendSupportTicketEmail(data: SupportTicketMailData) {
    const config = supportTicketMail;
    this.logger.log(`Dispatching support ticket confirmation [${data.ticketId}] to ${data.email}`);
    try {
      return await this.resend.emails.send({
        from: config.from,
        to: data.email,
        subject: `Support Ticket Received: [${data.ticketId}] - ${data.subject}`,
        html: config.template(data),
      });
    } catch (err: any) {
      this.logger.error(`Failed to dispatch support ticket email to ${data.email}: ${err?.message || err}`);
      throw err;
    }
  }

  async sendScheduledQuizAlertEmail(data: ScheduledQuizAlertMailData) {
    const config = scheduledQuizAlertMail;
    this.logger.log(`Dispatching 5-min launch alert for "${data.quizTitle}" to ${data.ownerEmail}`);
    try {
      return await this.resend.emails.send({
        from: config.from,
        to: data.ownerEmail,
        subject: `T-Minus 5 Minutes: "${data.quizTitle}" Launches Soon [PIN: ${data.pin}]`,
        html: config.template(data),
      });
    } catch (err: any) {
      this.logger.error(`Failed to dispatch scheduled quiz alert to ${data.ownerEmail}: ${err?.message || err}`);
      throw err;
    }
  }
}