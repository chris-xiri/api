import { Request, Response } from 'express';
import { scrapeVendors } from '../services/scraperService';

export const scrapeVendorsHandler = async (req: Request, res: Response) => {
    try {
        const { zipCode, trade } = req.body;

        if (!zipCode || !trade) {
            return res.status(400).json({ error: 'zipCode and trade are required' });
        }

        const vendors = await scrapeVendors(zipCode, trade);

        return res.status(200).json({
            message: `Successfully scraped ${vendors.length} vendors`,
            data: vendors
        });

    } catch (error) {
        console.error('Error in scrapeVendorsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

import { db } from '../config/firebase';
import { importAccounts } from '../services/crmService';

export const updateVendorHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Vendor ID is required' });
        }

        await db.collection('vendors').doc(id).update(updates);

        return res.status(200).json({ message: 'Vendor updated successfully' });
    } catch (error) {
        console.error('Error in updateVendorHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const importLeadsHandler = async (req: Request, res: Response) => {
    try {
        const { leads, type, ownerId } = req.body; // type: 'vendor' | 'prospect'

        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array is required' });
        }

        if (!type || !['vendor', 'prospect'].includes(type)) {
            return res.status(400).json({ error: 'valid type (vendor/prospect) is required' });
        }

        const count = await importAccounts(leads, type, ownerId);

        return res.status(200).json({
            message: `Successfully imported ${count} accounts`,
            count
        });

    } catch (error) {
        console.error('Error in importLeadsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
