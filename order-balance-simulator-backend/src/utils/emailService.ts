// src/utils/emailService.ts
import nodemailer from 'nodemailer';

// Enhanced email configuration with better error handling
const createTransporter = () => {
  // Check for required environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email configuration missing:');
    console.error('- EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.error('- EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }

  console.log('📧 Creating email transporter with:', {
    service: 'gmail',
    user: process.env.EMAIL_USER,
    passLength: process.env.EMAIL_PASS?.length || 0
  });

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Additional configuration for better reliability
    pool: true,
    maxConnections: 1,
    rateDelta: 20000,
    rateLimit: 5,
  });
};

let transporter: nodemailer.Transporter | null = null;

// Initialize transporter with error handling
const getTransporter = () => {
  if (!transporter) {
    try {
      transporter = createTransporter();
    } catch (error) {
      console.error('❌ Failed to create email transporter:', error);
      throw error;
    }
  }
  return transporter;
};

// Test email connection with detailed error reporting
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    console.log('🔍 Testing email connection...');
    const testTransporter = getTransporter();
    
    const verified = await testTransporter.verify();
    if (verified) {
      console.log('✅ Email service is ready and verified');
      return true;
    } else {
      console.error('❌ Email service verification failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    
    // Provide specific error guidance
    if (error instanceof Error) {
      if (error.message.includes('Invalid login')) {
        console.error('💡 Gmail authentication failed. Please check:');
        console.error('   1. Email and password are correct');
        console.error('   2. 2-Factor Authentication is enabled');
        console.error('   3. App Password is generated and used (not regular password)');
        console.error('   4. Less secure app access is enabled (if not using App Password)');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Connection refused. Check your internet connection.');
      } else if (error.message.includes('ETIMEDOUT')) {
        console.error('💡 Connection timeout. Check firewall/proxy settings.');
      }
    }
    
    return false;
  }
};

// Enhanced email sending function with comprehensive error handling
export const sendVerificationEmail = async (
  email: string, 
  code: string, 
  fullName: string
): Promise<any> => {
  console.log('📤 Starting email send process...');
  console.log('📧 Recipients:', email);
  console.log('👤 Full name:', fullName);
  console.log('🔢 Code:', code);

  // Validate inputs
  if (!email || !code || !fullName) {
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!code) missingFields.push('code');
    if (!fullName) missingFields.push('fullName');
    
    const errorMsg = `Missing required parameters: ${missingFields.join(', ')}`;
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const errorMsg = 'Invalid email format';
    console.error('❌', errorMsg, email);
    throw new Error(errorMsg);
  }

  // Validate code format (should be 6 digits)
  if (!/^\d{6}$/.test(code)) {
    const errorMsg = 'Invalid verification code format (should be 6 digits)';
    console.error('❌', errorMsg, code);
    throw new Error(errorMsg);
  }

  try {
    const emailTransporter = getTransporter();
    
    const mailOptions = {
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verifikacija email adrese - Vaš kod',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verifikacija email adrese</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white; 
              border-radius: 10px; 
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              text-align: center; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white;
              padding: 30px 20px; 
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content { 
              padding: 30px 20px; 
            }
            .greeting {
              font-size: 18px;
              color: #2c3e50;
              margin-bottom: 20px;
            }
            .code-container {
              text-align: center;
              margin: 30px 0;
            }
            .code { 
              font-size: 36px; 
              font-weight: bold; 
              color: #667eea; 
              background: #f8f9fa; 
              border: 2px dashed #667eea;
              border-radius: 10px; 
              padding: 20px;
              letter-spacing: 5px;
              display: inline-block;
              min-width: 200px;
            }
            .warning { 
              color: #e74c3c; 
              font-weight: 600; 
              background: #ffeaa7;
              padding: 15px;
              border-radius: 5px;
              border-left: 4px solid #e74c3c;
              margin: 20px 0;
            }
            .instructions {
              background: #e8f4fd;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #3498db;
              margin: 20px 0;
            }
            .instructions h3 {
              margin-top: 0;
              color: #2980b9;
            }
            .footer { 
              text-align: center; 
              font-size: 12px; 
              color: #7f8c8d; 
              background: #ecf0f1;
              padding: 20px;
              border-top: 1px solid #bdc3c7;
            }
            .security-notice {
              font-size: 13px;
              color: #7f8c8d;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verifikacija Email Adrese</h1>
            </div>
            <div class="content">
              <div class="greeting">Pozdrav ${fullName}!</div>
              
              <p>Hvala vam što ste se registrovali. Da biste dovršili proces registracije, molimo vas da verifikujete svoju email adresu.</p>
              
              <div class="instructions">
                <h3>📝 Kako da verifikujete email:</h3>
                <ol>
                  <li>Kopirajte kod ispod</li>
                  <li>Vratite se u aplikaciju</li>
                  <li>Unesite kod u polje za verifikaciju</li>
                  <li>Kliknite "Verifikuj Email"</li>
                </ol>
              </div>

              <div class="code-container">
                <div class="code">${code}</div>
              </div>
              
              <div class="warning">
                ⚠️ <strong>Važno:</strong> Ovaj kod važi samo <strong>2 minuta</strong>!<br>
                Ako kod istekne, možete zatražiti novi iz aplikacije.
              </div>

              <div class="security-notice">
                <strong>🛡️ Sigurnosna napomena:</strong><br>
                Ako niste zatražili verifikaciju svog email-a, molimo vas da ignorirate ovaj email. 
                Vaš nalog je siguran i niko neće moći da mu pristupi bez vaše dozvole.
              </div>
            </div>
            <div class="footer">
              <p><strong>Your App Name</strong></p>
              <p>Ovaj email je automatski generisan. Molimo ne odgovarajte na njega.</p>
              <p>Ako imate problema, kontaktirajte našu podršku.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      // Also include plain text version for better compatibility
      text: `
        Pozdrav ${fullName}!

        Vaš verifikacioni kod je: ${code}

        Ovaj kod važi samo 2 minuta.

        Ako niste zatražili verifikaciju, ignorirajte ovaj email.

        Your App Name
      `,
    };

    console.log('📤 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log('✅ Verification email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📤 Response:', info.response);
    
    return info;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    
    // Enhanced error handling with specific guidance
    if (error instanceof Error) {
      let userFriendlyMessage = 'Failed to send verification email';
      
      if (error.message.includes('Invalid login')) {
        userFriendlyMessage = 'Email service authentication failed. Please contact support.';
        console.error('💡 Gmail authentication issue - check App Password configuration');
      } else if (error.message.includes('rate limit')) {
        userFriendlyMessage = 'Too many emails sent. Please wait a moment and try again.';
      } else if (error.message.includes('recipient')) {
        userFriendlyMessage = 'Invalid recipient email address.';
      } else if (error.message.includes('ECONNREFUSED')) {
        userFriendlyMessage = 'Email service temporarily unavailable. Please try again later.';
      } else if (error.message.includes('timeout')) {
        userFriendlyMessage = 'Email sending timed out. Please try again.';
      }
      
      throw new Error(userFriendlyMessage);
    }
    
    throw new Error('Unknown error occurred while sending email');
  }
};

// Function to validate email service configuration on startup
export const validateEmailConfig = (): boolean => {
  const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing email configuration:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}: Not set`);
    });
    return false;
  }
  
  console.log('✅ Email configuration variables are set');
  return true;
};