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

import { draftOutreachEmail, draftResponseEmail } from './geminiService';

export const sendEmail = async (vendor: Vendor, templateKey: string) => {
    // Map existing template keys to AI drafting types
    const type = templateKey === 'initial_outreach' ? 'initial' : 'follow_up';

    console.log(`Drafting AI email (${type}) for ${vendor.name}...`);
    const { subject, body } = await draftOutreachEmail(vendor, type);

    const recipient = FORCE_TEST_MODE ? TEST_RECIPIENT : (vendor.email || TEST_RECIPIENT);
    const finalSubject = subject + (FORCE_TEST_MODE ? ` [TEST to: ${vendor.email}]` : '');

    console.log(`Sending AI-drafted email to ${recipient}...`);

    try {
        const info = await transporter.sendMail({
            from: SENDER_IDENTITY,
            replyTo: MAIL_FROM_ADDRESS,
            to: recipient,
            subject: finalSubject,
            html: body,
        });
        console.log(`Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

/**
 * Sends an interactive AI-generated response to an incoming vendor message.
 */
export const sendResponseEmail = async (vendor: Vendor, incomingMessage: string) => {
    console.log(`Drafting AI response for ${vendor.name}...`);
    const { subject, body } = await draftResponseEmail(vendor, incomingMessage);

    const recipient = FORCE_TEST_MODE ? TEST_RECIPIENT : (vendor.email || TEST_RECIPIENT);

    try {
        const info = await transporter.sendMail({
            from: SENDER_IDENTITY,
            replyTo: MAIL_FROM_ADDRESS,
            to: recipient,
            subject: subject,
            html: body,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending response email:', error);
        throw error;
    }
};
