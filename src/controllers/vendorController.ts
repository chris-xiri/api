import { Request, Response } from 'express';
import { scrapeVendors } from '../services/scraperService';
import { performAutomatedVetting } from '../services/vettingService';

export const scrapeVendorsHandler = async (req: Request, res: Response) => {
    try {
        const { zipCode, location, trade, radius } = req.body;
        const searchLocation = location || zipCode;

        if (!searchLocation || !trade) {
            return res.status(400).json({ error: 'location (or zipCode) and trade are required' });
        }

        const [scrapedVendors, existingAccounts] = await Promise.all([
            scrapeVendors(searchLocation, trade, radius || 10),
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

        // Trigger automated vetting if status is changing to 'Vetting'
        if (updates.status === 'Vetting') {
            const vendorRef = db.collection('accounts').doc(id);
            const doc = await vendorRef.get();
            if (doc.exists) {
                const vendorData = doc.data();
                // Run in background to avoid blocking the response
                performAutomatedVetting(id, vendorData?.name, vendorData?.address?.fullNumber || '');
            }
        }

        await db.collection('accounts').doc(id).update(updates);

        return res.status(200).json({ message: 'Vendor updated successfully' });
    } catch (error) {
        console.error('Error in updateVendorHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createVendorHandler = async (req: Request, res: Response) => {
    try {
        const vendorData = req.body;

        if (!vendorData.name) {
            return res.status(400).json({ error: 'Vendor name is required' });
        }

        // Add metadata
        const newVendor = {
            ...vendorData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: 'vendor', // enforce type
            outreach: {
                status: 'idle',
                step: 0
            }
        };

        const docRef = await db.collection('accounts').add(newVendor);

        return res.status(201).json({
            message: 'Vendor created successfully',
            id: docRef.id,
            ...newVendor
        });

    } catch (error) {
        console.error('Error in createVendorHandler:', error);
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

import { GoogleGenerativeAI } from '@google/generative-ai';

export const getLocationSuggestionsHandler = async (req: Request, res: Response) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use faster model for autocomplete

        const prompt = `
            Act as a location autocomplete engine. Given the partial user input "${query}", 
            return exactly 5 real-world location suggestions (City, State, or notable addresses/zip codes).
            Focus on US commercial hubs.
            Return ONLY a JSON array of strings, no other text.
            Example: ["New York, NY", "Newark, NJ", "New Haven, CT"]
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Cleanup markdown if AI wraps it
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return res.status(200).json({ data: suggestions });
    } catch (error) {
        console.error('Error in getLocationSuggestionsHandler:', error);
        return res.status(200).json({ data: [] }); // Fail silently for autocomplete
    }
};

export const deleteVendorHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Vendor ID is required' });
        }

        console.log(`Deleting vendor ${id}...`);

        // 1. Delete associated activities (optional but recommended)
        const activitiesSnapshot = await db.collection('activities').where('accountId', '==', id).get();
        const batch = db.batch();

        activitiesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 2. Delete the vendor document
        batch.delete(db.collection('accounts').doc(id));

        await batch.commit();

        return res.status(200).json({ message: 'Vendor and associated activities deleted successfully' });
    } catch (error) {
        console.error('Error in deleteVendorHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
