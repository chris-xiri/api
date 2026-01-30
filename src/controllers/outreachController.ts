import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { sendEmail } from '../services/emailService';
import { Vendor } from '../utils/types';

export const startOutreachSequenceHandler = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const vendorDoc = await db.collection('accounts').doc(id).get();

        if (!vendorDoc.exists) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        const vendor = { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;

        if (!vendor.email) {
            return res.status(400).json({ error: 'Vendor has no email address' });
        }

        // Send Initial Email
        await sendEmail(vendor, 'initial_outreach');

        // Update Vendor Record
        const now = new Date();
        const nextEmailDate = new Date();
        nextEmailDate.setDate(now.getDate() + 3); // Follow up in 3 days

        const updates: Partial<Vendor> = {
            status: 'Outreach',
            outreach: {
                step: 1,
                lastEmailSentAt: now.toISOString(),
                nextEmailAt: nextEmailDate.toISOString(),
                campaignId: 'default_bilingual',
                status: 'active'
            },
            updatedAt: now.toISOString()
        };

        await db.collection('accounts').doc(id).update(updates);

        // Log Activity
        await db.collection('activities').add({
            accountId: id,
            type: 'email',
            content: 'Initial Outreach Sequence Started (Email 1 Sent)',
            createdBy: 'system', // or req.user.uid if auth middleware is there
            createdAt: now.toISOString()
        });

        return res.status(200).json({
            message: 'Outreach sequence started successfully',
            outreachState: updates.outreach
        });

    } catch (error) {
        console.error('Error starting outreach sequence:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const unsubscribeVendorHandler = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const vendorRef = db.collection('accounts').doc(id);
        const doc = await vendorRef.get();
        if (!doc.exists) return res.status(404).send('Vendor not found');

        const now = new Date();
        await vendorRef.update({
            status: 'Rejected',
            'outreach.status': 'completed',
            updatedAt: now.toISOString()
        });

        await db.collection('activities').add({
            accountId: id,
            type: 'note',
            content: 'User unsubscribed from outreach.',
            createdBy: 'system',
            createdAt: now.toISOString()
        });

        res.send('<h1>Unsubscribed</h1><p>You have been removed from our mailing list.</p>');
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).send('Error processing unsubscribe request.');
    }
};
