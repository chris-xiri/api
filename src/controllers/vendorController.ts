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
