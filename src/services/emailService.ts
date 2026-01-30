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
        <p>Xiri Facility Solutions | Vendor Management Team</p>
        <p><a href="${process.env.VITE_API_URL || 'http://localhost:3000/api'}/vendors/${vendor.id}/unsubscribe" style="color: #999;">Unsubscribe</a></p>
    </div>
`;

import { draftOutreachEmail, draftResponseEmail } from './geminiService';

/**
 * Sends an AI-generated outreach email (Initial or Follow-up)
 */
export const sendOutreachEmail = async (vendor: Vendor, type: 'initial' | 'follow_up') => {
    try {
        console.log(`[AI Agent] Drafting ${type} email for ${vendor.name}...`);
        const draft = await draftOutreachEmail(vendor, type);

        const fullHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                ${draft.body}
                ${getFooter(vendor)}
            </div>
        `;

        return await sendRawEmail(vendor, draft.subject, fullHtml);
    } catch (error) {
        console.error('Failed to send outreach email:', error);
        throw error;
    }
};

/**
 * Sends an AI-generated reply to an incoming vendor message
 */
export const sendAiReply = async (vendor: Vendor, incomingMessage: string) => {
    try {
        console.log(`[AI Agent] Analyzing reply from ${vendor.name}...`);
        const draft = await draftResponseEmail(vendor, incomingMessage);

        const fullHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
                ${draft.body}
                ${getFooter(vendor)}
            </div>
        `;

        return await sendRawEmail(vendor, draft.subject, fullHtml);
    } catch (error) {
        console.error('Failed to send AI reply:', error);
        throw error;
    }
};

/**
 * Compatibility wrapper for existing services (Legacy)
 */
export const sendEmail = async (vendor: Vendor, templateKey: string) => {
    const type = templateKey === 'initial_outreach' ? 'initial' : 'follow_up';
    return sendOutreachEmail(vendor, type);
};

/**
 * Internal helper to handle the actual SMTP transport
 */
const sendRawEmail = async (vendor: Vendor, subject: string, html: string) => {
    const recipient = FORCE_TEST_MODE ? TEST_RECIPIENT : (vendor.email || TEST_RECIPIENT);
    const finalSubject = subject + (FORCE_TEST_MODE ? ` [TEST: ${vendor.name}]` : '');

    try {
        const info = await transporter.sendMail({
            from: `"Xiri Vendor Team" <${MAIL_FROM_ADDRESS}>`,
            replyTo: MAIL_FROM_ADDRESS,
            to: recipient,
            subject: finalSubject,
            html: html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Transporter Error:', error);
        throw error;
    }
};
