/**
 * Base email layout wrapper for QuizzCraft transactional emails.
 * Built for bulletproof cross-client compatibility (Gmail, Apple Mail, Outlook, Yahoo)
 * with a futuristic, high-tech dark theme.
 */

export interface BaseEmailLayoutOptions {
  previewText?: string;
  badgeText?: string;
  badgeColor?: string; // hex color for badge border/text, defaults to cyan #2FE6C7
  contentHtml: string;
  footerNote?: string;
}

export function renderBaseEmailLayout(options: BaseEmailLayoutOptions): string {
  const {
    previewText = 'QuizzCraft Security & Mission Dispatch',
    badgeText = 'SYSTEM DISPATCH',
    badgeColor = '#2FE6C7',
    contentHtml,
    footerNote,
  } = options;

  const currentYear = new Date().getFullYear();
  const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://quizzcraft.app';

  // Generate hidden preheader padding so inbox previews don't leak remaining email body text
  const preheaderPadding = '&#847; &zwnj; &nbsp; &#8199; &shy; '.repeat(30);

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>QuizzCraft</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .email-content { padding: 24px 20px !important; }
      .otp-code { font-size: 30px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #07090e; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #07090e; opacity: 0;">
    ${previewText}
    ${preheaderPadding}
  </div>

  <!-- Email Wrapper Table -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #07090e; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 12px 48px;">
        
        <!-- Main Email Container (Max 600px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #0f172a; border-radius: 20px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #7c3aed 0%, #3b82f6 50%, #2fe6c7 100%); line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td style="padding: 36px 36px 20px; background: linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0) 100%);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Brand Logo & Name -->
                  <td valign="middle">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Glowing Icon Badge -->
                        <td width="38" height="38" style="background: linear-gradient(135deg, #7c3aed 0%, #2fe6c7 100%); border-radius: 10px; text-align: center; vertical-align: middle; box-shadow: 0 0 15px rgba(47, 230, 199, 0.35);">
                          <span style="font-size: 20px; line-height: 38px; color: #ffffff; display: block;">⚡</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 21px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; color: #ffffff;">
                            QUIZZ<span style="color: #2fe6c7;">CRAFT</span>
                          </div>
                          <div style="font-size: 11px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px;">
                            Interactive Knowledge Arenas
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Context Pill Badge -->
                  <td align="right" valign="middle">
                    <div style="display: inline-block; padding: 5px 12px; background-color: rgba(15, 23, 42, 0.8); border: 1px solid ${badgeColor}40; border-radius: 9999px;">
                      <span style="font-size: 10px; font-weight: 700; color: ${badgeColor}; letter-spacing: 1px; text-transform: uppercase;">
                        ${badgeText}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #1e293b; width: 100%;"></div>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td class="email-content" style="padding: 32px 36px 36px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="height: 1px; background-color: #1e293b; width: 100%;"></div>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 28px 36px 32px; background-color: #0b0f19; text-align: center;">
              
              ${footerNote ? `
              <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.6; color: #94a3b8;">
                ${footerNote}
              </p>
              ` : ''}

              <!-- Footer Quick Links -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 16px;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="${clientUrl}" style="color: #64748b; text-decoration: none; font-size: 12px; font-weight: 500;">QuizzCraft Arena</a>
                  </td>
                  <td style="color: #334155; font-size: 12px;">•</td>
                  <td style="padding: 0 10px;">
                    <a href="${clientUrl}/profile" style="color: #64748b; text-decoration: none; font-size: 12px; font-weight: 500;">Account Settings</a>
                  </td>
                  <td style="color: #334155; font-size: 12px;">•</td>
                  <td style="padding: 0 10px;">
                    <a href="mailto:support@quizzcraft.app" style="color: #64748b; text-decoration: none; font-size: 12px; font-weight: 500;">Support Desk</a>
                  </td>
                </tr>
              </table>

              <!-- Copyright & Automated Disclaimer -->
              <p style="margin: 0; font-size: 11px; line-height: 1.6; color: #475569;">
                &copy; ${currentYear} QuizzCraft Inc. All rights reserved.<br />
                This is a secure automated dispatch. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- End Main Email Container -->

      </td>
    </tr>
  </table>
  <!-- End Email Wrapper Table -->
</body>
</html>`;
}
