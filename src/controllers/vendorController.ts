import { Request, Response } from 'express';
import { scrapeVendors } from '../services/scraperService';

export const scrapeVendorsHandler = async (req: Request, res: Response) => {
    try {
        const { zipCode, trade } = req.body;

        if (!zipCode || !trade) {
            return res.status(400).json({ error: 'zipCode and trade are required' });
        }

        const [scrapedVendors, existingAccounts] = await Promise.all([
            scrapeVendors(zipCode, trade),
            getAccounts('vendor')
        ]);

        // Create a set of existing identifiers for O(1) lookup
        const existingNames = new Set(existingAccounts.map(a => a.name.toLowerCase()));
        const existingWebsites = new Set(existingAccounts.filter(a => a.website).map(a => a.website!.toLowerCase()));

        // Filter out duplicates
        const newLeads = scrapedVendors.filter(lead => {
            const nameExists = existingNames.has(lead.companyName.toLowerCase());
            const websiteExists = lead.website && existingWebsites.has(lead.website.toLowerCase());
            return !nameExists && !websiteExists;
        });

        return res.status(200).json({
            message: `Found ${newLeads.length} new vendors (filtered ${scrapedVendors.length - newLeads.length} existing)`,
            data: newLeads
        });

    } catch (error) {
        console.error('Error in scrapeVendorsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

import { db } from '../config/firebase';
import { importAccounts, getAccounts } from '../services/crmService';

export const updateVendorHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Vendor ID is required' });
        }

        await db.collection('accounts').doc(id).update(updates);

        return res.status(200).json({ message: 'Vendor updated successfully' });
    } catch (error) {
        console.error('Error in updateVendorHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const importLeadsHandler = async (req: Request, res: Response) => {
    try {
        const { leads, type, ownerId, status } = req.body; // type: 'vendor' | 'prospect'

        if (!leads || !Array.isArray(leads)) {
            return res.status(400).json({ error: 'leads array is required' });
        }

        if (!type || !['vendor', 'prospect'].includes(type)) {
            return res.status(400).json({ error: 'valid type (vendor/prospect) is required' });
        }

        const count = await importAccounts(leads, type, ownerId, status);

        return res.status(200).json({
            message: `Successfully imported ${count} accounts`,
            count
        });

    } catch (error) {
        console.error('Error in importLeadsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getVendorsHandler = async (req: Request, res: Response) => {
    try {
        const type = req.query.type as 'vendor' | 'prospect' | undefined;
        // Default to 'vendor' if we are in vendor controller, but allow override or "all" logic if we want
        // For now, let's just fetch 'vendor' types if accessed via /vendors endpoint usually
        const filterType = type || 'vendor';

        const accounts = await getAccounts(filterType);

        return res.status(200).json({
            message: `Successfully fetched ${accounts.length} accounts`,
            data: accounts
        });
    } catch (error) {
        console.error('Error in getVendorsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
