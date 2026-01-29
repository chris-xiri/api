import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { db } from '../config/firebase';
import { Vendor } from '../utils/types';
import { summarizeVendor } from './geminiService';

dotenv.config();

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

interface ApifyPlaceItem {
    title?: string;
    name?: string;
    companyName?: string;
    website?: string;
    url?: string;
    phone?: string;
    email?: string;
    address?: string;
    totalScore?: number;
    rating?: number;
    [key: string]: any;
}

export const scrapeVendors = async (zipCode: string, trade: string) => {
    if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN is missing');
    }

    // Google Maps Scraper Actor ID
    const actorId = 'compass/crawler-google-places';

    const input = {
        searchStringsArray: [`${trade} in ${zipCode}`],
        maxCrawledPlacesPerSearch: 3,
    };

    try {
        console.log(`Starting Apify run for: ${trade} in ${zipCode}`);
        const run = await apifyClient.actor(actorId).call(input);
        const { defaultDatasetId } = run;
        const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

        // 1. Filter valid items first
        const validItems = (items as unknown as ApifyPlaceItem[]).filter(item => {
            const name = item.title || item.name || item.companyName;
            const website = item.website || item.url;
            if (!name || !website) {
                console.log(`Skipping vendor "${name || 'Unknown'}" - no website found`);
                return false;
            }
            return true;
        });

        // 2. Process vendors in parallel with Promise.all
        const vendorPromises = validItems.map(async (item) => {
            try {
                const name = item.title || item.name || item.companyName;
                const website = item.website || item.url;

                const vendorData: Vendor = {
                    companyName: String(name),
                    trades: [trade],
                    status: 'Raw Lead',
                    compliance: {
                        coiExpiry: new Date().toISOString(),
                        w9OnFile: false,
                    },
                    website: website,
                    phone: item.phone || undefined,
                    email: item.email || undefined,
                };

                // AI summary with fallback
                const summary = await summarizeVendor({
                    companyName: vendorData.companyName,
                    trades: vendorData.trades,
                    website: vendorData.website,
                    phone: vendorData.phone,
                    // Use new typed fields for context
                    ...(item.address ? { address: item.address } : {}),
                    ...(item.totalScore || item.rating ? { rating: item.totalScore || item.rating } : {}),
                } as any).catch(() => "Summary generation failed.");

                vendorData.aiContextSummary = summary;
                return vendorData;
            } catch (err) {
                console.error('Error processing individual item:', err);
                return null;
            }
        });

        const results = await Promise.all(vendorPromises);
        const newVendors = results.filter((v): v is Vendor => v !== null);

        // 3. Batch write to Firestore
        if (newVendors.length > 0) {
            const batch = db.batch();
            newVendors.forEach((vendor) => {
                const docRef = db.collection('vendors').doc(); // Auto-ID
                batch.set(docRef, vendor);
            });
            await batch.commit();
        }

        return newVendors;

    } catch (error) {
        console.error('Error in scrapeVendors:', error);
        throw error;
    }
};
