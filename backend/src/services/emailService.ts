import nodemailer from 'nodemailer'

// Auto-detect SMTP settings from the sender's email domain.
// Users configure only EMAIL_USER + EMAIL_PASS — no manual host/port needed.
function resolveSmtp(email: string): { host: string; port: number } {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''

  if (domain === 'gmail.com') {
    return { host: 'smtp.gmail.com', port: 587 }
  }
  if (['outlook.com', 'hotmail.com', 'live.com', 'live.co.uk', 'msn.com'].includes(domain)) {
    return { host: 'smtp-mail.outlook.com', port: 587 }
  }
  // Generic fallback — works for most business email providers
  return { host: `smtp.${domain}`, port: 587 }
}

function createTransporter() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    throw new Error(
      'EMAIL_USER and EMAIL_PASS must be set in .env to send emails.\n' +
      'For Gmail: use an App Password (myaccount.google.com/apppasswords).\n' +
      'For Outlook: use your regular password.',
    )
  }

  const { host, port } = resolveSmtp(user)

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on port 587
    auth: { user, pass },
  })
}

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<void> {
  const transporter = createTransporter()
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Waddle Procurement'
  const fromAddress = process.env.EMAIL_USER!

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text: body,
  })
}
