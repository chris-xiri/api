import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { db } from '../config/firebase';
import { Vendor } from '../utils/types';
import { summarizeVendor } from './geminiService';

dotenv.config();

const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

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

        const newVendors: Vendor[] = [];

        for (const item of items) {
            try {
                const name = item.title || item.name || item.companyName;
                const website = item.website || item.url;

                // Skip vendors without a website
                if (!name || !website) {
                    console.log(`Skipping vendor "${name || 'Unknown'}" - no website found`);
                    continue;
                }

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

                // AI summary with a fallback to avoid hanging
                const summary = await summarizeVendor({
                    companyName: vendorData.companyName,
                    trades: vendorData.trades,
                    website: vendorData.website,
                    phone: vendorData.phone,
                    // @ts-ignore - passing extra context for AI
                    address: item.address,
                    // @ts-ignore
                    rating: item.totalScore || item.rating,
                }).catch(() => "Summary generation failed.");

                vendorData.aiContextSummary = summary;
                newVendors.push(vendorData);
            } catch (err) {
                console.error('Error processing item:', err);
            }
        }

        // Batch write to Firestore
        const batch = db.batch();

        newVendors.forEach((vendor) => {
            const docRef = db.collection('vendors').doc(); // Auto-ID
            batch.set(docRef, vendor);
        });

        await batch.commit();

        return newVendors;

    } catch (error) {
        console.error('Error in scrapeVendors:', error);
        throw error;
    }
};
