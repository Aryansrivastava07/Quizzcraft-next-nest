import { Inject, Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { verificationMail } from './mails/verification.mail';
import { passwordResetMail } from './mails/passwordResetMail.mail';
import { supportTicketMail, SupportTicketMailData } from './mails/supportTicket.mail';
import { scheduledQuizAlertMail, ScheduledQuizAlertMailData } from './mails/scheduledQuizAlert.mail';

@Injectable()
export class MailService {
  constructor(
    @Inject('RESEND_CLIENT')
    private readonly resend: Resend,
  ) { }

  async sendVerificationEmail(
    email: string,
    OTP: string,
  ) {
    const verificationMailConfig = verificationMail;
    console.log(`[Mail] Verification OTP dispatched to ${email}`);
    return this.resend.emails.send({
      from: verificationMailConfig.from,
      to: email,
      subject: verificationMailConfig.subject,
      html: verificationMailConfig.template({ OTP: OTP }),
    });
  }

  async sendPasswordResetEmail(
    email: string,
    OTP: string,
  ) {
    const passwordResetMailConfig = passwordResetMail;
    console.log(`[Mail] Password reset email dispatched to ${email}`);
    return this.resend.emails.send({
      from: passwordResetMailConfig.from,
      to: email,
      subject: passwordResetMailConfig.subject,
      html: passwordResetMailConfig.template({ OTP: OTP }),
    });
  }

  async sendSupportTicketEmail(data: SupportTicketMailData) {
    const config = supportTicketMail;
    console.log(`[Mail] Support ticket [${data.ticketId}] dispatched to ${data.email}`);
    return this.resend.emails.send({
      from: config.from,
      to: data.email,
      subject: `Support Ticket Received: [${data.ticketId}] - ${data.subject}`,
      html: config.template(data),
    });
  }

  async sendScheduledQuizAlertEmail(data: ScheduledQuizAlertMailData) {
    const config = scheduledQuizAlertMail;
    console.log(`[Mail] 5-min launch alert for "${data.quizTitle}" dispatched to ${data.ownerEmail}`);
    return this.resend.emails.send({
      from: config.from,
      to: data.ownerEmail,
      subject: `T-Minus 5 Minutes: "${data.quizTitle}" Launches Soon [PIN: ${data.pin}]`,
      html: config.template(data),
    });
  }
}