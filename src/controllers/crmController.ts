import { Request, Response } from 'express';
import { scrapeProspects } from '../services/scraperService';
import { importAccounts, getAccounts } from '../services/crmService';

export const scrapeProspectsHandler = async (req: Request, res: Response) => {
    try {
        const { zipCode, query } = req.body;

        if (!zipCode || !query) {
            return res.status(400).json({ error: 'zipCode and query are required' });
        }

        const prospects = await scrapeProspects(zipCode, query);

        return res.status(200).json({
            message: `Successfully scraped ${prospects.length} prospects`,
            data: prospects
        });

    } catch (error) {
        console.error('Error in scrapeProspectsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const importProspectsHandler = async (req: Request, res: Response) => {
    try {
        const { leads, ownerId } = req.body;

        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array is required' });
        }

        const count = await importAccounts(leads, 'prospect', ownerId);

        return res.status(200).json({
            message: `Successfully imported ${count} prospects`,
            count
        });

    } catch (error) {
        console.error('Error in importProspectsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getProspectsHandler = async (req: Request, res: Response) => {
    try {
        const accounts = await getAccounts('prospect');

        return res.status(200).json({
            message: `Successfully fetched ${accounts.length} prospects`,
            data: accounts
        });
    } catch (error) {
        console.error('Error in getProspectsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
