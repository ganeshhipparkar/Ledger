export class Mailer {
  async sendMail(mail) {
    const nodemailer = require('nodemailer');

    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
      auth: {
        user: process.env.SMTP_USER,
        pass: 'wpzb nxlf fzbl czxh',
      },
    });
    try {
      const otp = Math.floor(100000 + Math.random() * 900000);
      const info = await transporter.sendMail({
        from: 'forgotpass@otp.com', // sender address
        to: mail, // list of recipients
        subject: 'OTP for changing password', // subject line
        text: 'Hello world?', // plain text body
        html: `<b>${otp} </b>`, // HTML body
      });
      return otp;
    } catch (err) {
      console.error('Error while sending mail:', err);
    }
  }
}
