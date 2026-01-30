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

const templates: Record<string, EmailTemplate> = {
    initial_outreach: {
        subject: (vendor) => `Partnership Opportunity: ${vendor.name} & Xiri Facility Solutions`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <p>Hi ${vendor.name?.split(' ')[0] || 'there'},</p>
                
                <p>My name is [Recruiter Name] from Xiri Facility Solutions. We are expanding our network of independent service providers in your area and identified logic in ${vendor.trades?.[0] || 'your services'} as a potential fit.</p>
                
                <p>We connect vetted contractors directly with single-tenant facility managers, handling the sales and back-office work so you can focus on the job. We are looking for reliable partners for upcoming contracts.</p>
                
                <p>Are you taking on new commercial clients right now?</p>
                
                <p>Best regards,</p>
                <p><strong>Xiri Facility Solutions Recruitment Team</strong><br>${MAIL_FROM_ADDRESS}</p>
                
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                
                <p><strong>Español:</strong></p>
                
                <p>Hola ${vendor.name?.split(' ')[0] || ''},</p>
                
                <p>Mi nombre es [Nombre del Reclutador] de Xiri Facility Solutions. Estamos expandiendo nuestra red de proveedores de servicios independientes en su área e identificamos ${vendor.trades?.[0] || 'sus servicios'} como un candidato potencial.</p>
                
                <p>Conectamos a contratistas verificados directamente con administradores de instalaciones, encargándonos de las ventas y el trabajo administrativo para que usted pueda concentrarse en el trabajo. Buscamos socios confiables para próximos contratos.</p>
                
                <p>¿Está aceptando nuevos clientes comerciales en este momento?</p>
                
                <p>Saludos cordiales,</p>
                <p><strong>Equipo de Reclutamiento de Xiri Facility Solutions</strong></p>

                ${getFooter(vendor)}
            </div>
        `
    },
    follow_up_1: {
        subject: (vendor) => `Re: Partnership Opportunity with Xiri`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <p>Hi ${vendor.name?.split(' ')[0] || 'there'},</p>
                
                <p>I wanted to quickly float this to the top of your inbox. We have demand for ${vendor.trades?.[0] || 'reliable services'} in your territory and would love to verify your credentials to verify you for our platform.</p>
                
                <p>Let me know if you have 5 minutes to chat this week.</p>
                
                <p>Thanks,</p>
                <p><strong>Xiri Facility Solutions Recruitment Team</strong></p>
                
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                
                <p><strong>Español:</strong></p>
                
                <p>Hola de nuevo,</p>
                
                <p>Quería poner esto rápidamente al principio de su bandeja de entrada. Tenemos demanda de servicios de ${vendor.trades?.[0] || 'limpieza/mantenimiento'} en su territorio y nos encantaría verificar sus credenciales para nuestra plataforma.</p>
                
                <p>Avíseme si tiene 5 minutos para conversar esta semana.</p>
                
                <p>Gracias,</p>
                <p><strong>Equipo de Reclutamiento de Xiri Facility Solutions</strong></p>

                ${getFooter(vendor)}
            </div>
        `
    },
    follow_up_2: {
        subject: (vendor) => `Last Call: Xiri Vendor Network`,
        body: (vendor) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <p>Hi ${vendor.name?.split(' ')[0] || 'there'},</p>
                
                <p>I haven't heard back, so I assume you are fully booked at the moment. I will go ahead and close your file for now.</p>
                
                <p>If you have capacity in the future, please feel free to reach out. We are always looking for quality ${vendor.trades?.[0] || 'service'} providers.</p>
                
                <p>All the best,</p>
                <p><strong>Xiri Facility Solutions Recruitment Team</strong></p>
                
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
                
                <p><strong>Español:</strong></p>
                
                <p>Hola,</p>
                
                <p>No he tenido noticias suyas, así que asumo que están completamente ocupados en este momento. Voy a proceder a cerrar su archivo por ahora.</p>
                
                <p>Si tienen capacidad en el futuro, no duden en contactarnos. Siempre estamos buscando proveedores de calidad.</p>
                
                <p>Saludos,</p>
                <p><strong>Equipo de Reclutamiento de Xiri Facility Solutions</strong></p>

                ${getFooter(vendor)}
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
