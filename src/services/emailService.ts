import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { Vendor } from '../utils/types';

dotenv.config();

// Configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Safety Controls
const FORCE_TEST_MODE = true; // Always send to test address for now
const TEST_RECIPIENT = 'clungz@gmail.com';
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'ic-recruiter@xiri.ai';
const SENDER_IDENTITY = `"Xiri Facility Solutions Recruitment Team" <${MAIL_FROM_ADDRESS}>`;

console.log('Initializing SMTP transporter...');
if (!SMTP_USER || !SMTP_PASS) {
    console.error('CRITICAL: SMTP_USER or SMTP_PASS is missing from environment variables!');
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
});

interface EmailTemplate {
    subject: (vendor: Vendor) => string;
    body: (vendor: Vendor) => string;
}

const getFooter = (vendor: Vendor) => `
        <div style="margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
            <p>Xiri Facility Solutions | [Address]</p>
            <p>
                <a href="${process.env.API_URL || 'http://localhost:3000/api'}/vendors/${vendor.id}/unsubscribe" style="color: #999;">Unsubscribe / Darse de baja</a>
            </p>
        </div>
    `;

// Helper for dynamic greetings
const getFirstName = (vendor: Vendor) => vendor.name?.split(' ')[0] || 'Partner';

const templates: Record<string, EmailTemplate> = {
    // ----------------------------------------------------------------
    // SEQUENCE 1: COLD OUTREACH (Focus: Revenue & No Admin)
    // ----------------------------------------------------------------
    initial_outreach: {
        subject: (vendor) => `Commercial ${vendor.trades?.[0] || 'Service'} Contracts - No Bidding Required`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                <p>Hi ${getFirstName(vendor)},</p>
                
                <p>I'm reaching out because Xiri Facility Solutions manages facilities in your area, and we need a reliable partner for <strong>${vendor.trades?.[0] || 'commercial maintenance'}</strong>.</p>
                
                <p>Unlike lead-gen sites, we are the direct facility manager. We don't sell you leads. <strong>We assign you contracts.</strong></p>
                
                <p><strong>Why contractors work with Xiri:</strong></p>
                <ul>
                    <li><strong>Zero Admin:</strong> We handle the sales, customer service, and billing.</li>
                    <li><strong>Guaranteed Payment:</strong> You invoice us directly, not the tenant. We pay on time, every time.</li>
                    <li><strong>High-Quality Sites:</strong> Single-tenant commercial spaces that respect your time.</li>
                </ul>
                
                <p>Are you open to taking on new commercial accounts this month?</p>
                
                <p>Best,</p>
                <p><strong>[Recruiter Name]</strong><br>Vendor Manager | Xiri Facility Solutions</p>
                
                 <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                
                <p><strong>Español:</strong></p>
                <p>Hola ${getFirstName(vendor)},</p>
                <p>Xiri Facility Solutions busca socios confiables para contratos comerciales de ${vendor.trades?.[0] || 'mantenimiento'}. No vendemos leads; le asignamos trabajo directo y nosotros nos encargamos de la facturación y el servicio al cliente.</p>
                <p>¿Están aceptando nuevos clientes comerciales?</p>
                
                ${getFooter(vendor)}
            </div>
        `
    },
    follow_up_1: {
        subject: (vendor) => `One quick question regarding ${vendor.name}`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                <p>Hi ${getFirstName(vendor)},</p>
                
                <p>I wanted to follow up on my previous note. We have upcoming demand for ${vendor.trades?.[0] || 'services'} in your territory and I'd prefer to assign this volume to a local independent team rather than a national chain.</p>
                
                <p>It takes about 5 minutes to verify your credentials. Once active, we can start sending work orders directly to your inbox.</p>
                
                <p>Do you have capacity for a 5-minute chat this week?</p>
                
                <p>Thanks,</p>
                <p><strong>Xiri Recruitment Team</strong></p>
                
                ${getFooter(vendor)}
            </div>
        `
    },
    follow_up_2: {
        subject: (vendor) => `Closing your file (Xiri Vendor Network)`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                <p>Hi ${getFirstName(vendor)},</p>
                
                <p>Since I haven't heard back, I'll assume your schedule is fully booked for the season. I'll go ahead and close your file so I don't bother you further.</p>
                
                <p>If your capacity changes and you want to fill gaps in your schedule with commercial work, feel free to reply to this email anytime.</p>
                
                <p>All the best,</p>
                <p><strong>Xiri Recruitment Team</strong></p>

                ${getFooter(vendor)}
            </div>
        `
    },

    // ----------------------------------------------------------------
    // SEQUENCE 2: AUTOMATED ONBOARDING (Trigger: Positive Reply)
    // ----------------------------------------------------------------
    onboarding_request: {
        subject: (vendor) => `Next Steps: Activating ${vendor.name} with Xiri`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                <p>Hi ${getFirstName(vendor)},</p>
                
                <p>Great to hear you are interested. To officially approve you for our commercial sites, we need to complete a quick compliance check.</p>
                
                <p><strong>Please reply to this email attaching the following:</strong></p>
                <ol>
                    <li><strong>Certificate of Insurance (COI):</strong> General Liability (Min $1M).</li>
                    <li><strong>Form W-9:</strong> So we can set you up for payment.</li>
                </ol>
                
                <p><i>Alternatively, you can upload them securely to your portal here: <a href="#">[Insert Portal Link]</a></i></p>
                
                <p>Once received, our compliance team will review (usually within 24 hours), and we can discuss specific site allocations.</p>
                
                <p>Best,</p>
                <p><strong>Onboarding Team | Xiri Facility Solutions</strong></p>
            </div>
        `
    },

    // ----------------------------------------------------------------
    // SEQUENCE 3: QUALIFIED / BOOK MEETING (Trigger: Documents Verified)
    // ----------------------------------------------------------------
    meeting_invite: {
        subject: (vendor) => `Approved: Let's discuss capacity & rates`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                <p>Hi ${getFirstName(vendor)},</p>
                
                <p>Good news—your documents have been verified and <strong>${vendor.name} is now an approved vendor</strong> in the Xiri network.</p>
                
                <p>I'd like to schedule a brief onboarding call to finalize your profile. We will cover:</p>
                <ul>
                    <li><strong>Your Team Size:</strong> Matching job size to your crew capacity.</li>
                    <li><strong>Service Territory:</strong> Defining your exact zip code radius.</li>
                    <li><strong>Pricing/Rates:</strong> Setting your standard service rates.</li>
                </ul>
                
                <p><strong>Please select a time that works for you here:</strong><br>
                <a href="[Insert Calendly Link]">Book your Onboarding Call</a></p>
                
                <p>Looking forward to getting you started.</p>
                
                <p>Best,</p>
                <p><strong>Xiri Vendor Operations</strong></p>
            </div>
        `
    }
};

export const sendEmail = async (vendor: Vendor, templateKey: string) => {
    const template = templates[templateKey];
    if (!template) throw new Error(`Template ${templateKey} not found`);

    const recipient = FORCE_TEST_MODE ? TEST_RECIPIENT : (vendor.email || TEST_RECIPIENT);
    const subject = template.subject(vendor) + (FORCE_TEST_MODE ? ` [TEST to: ${vendor.email}]` : '');
    const html = template.body(vendor);

    console.log(`Sending email (${templateKey}) to ${recipient} (Original: ${vendor.email})...`);

    try {
        const info = await transporter.sendMail({
            from: SENDER_IDENTITY,
            replyTo: MAIL_FROM_ADDRESS,
            to: recipient,
            subject: subject,
            html: html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
