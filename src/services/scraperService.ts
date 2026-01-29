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

    // Google Maps Scraper Actor ID (official Apify actor)
    const actorId = 'apify/google-maps-scraper';

    const input = {
        searchStrings: [`${trade} in ${zipCode}`],
        maxCrawlerConcurrency: 1,
        maxReviews: 0,
        maxImages: 0,
        maxCrawledPlacesPerSearch: 3, // Reduced for Vercel free tier timeout (10s)
    };

    try {
        console.log(`Starting Apify run for: ${trade} in ${zipCode}`);
        const run = await apifyClient.actor(actorId).call(input);
        const { defaultDatasetId } = run;
        const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

        const newVendors: Vendor[] = [];

        for (const item of items) {
            try {
                if (!item.title) continue;

                const vendorData: Vendor = {
                    companyName: item.title,
                    trades: [trade],
                    status: 'Raw Lead',
                    compliance: {
                        coiExpiry: new Date().toISOString(),
                        w9OnFile: false,
                    },
                };

                const summary = await summarizeVendor({
                    companyName: vendorData.companyName,
                    trades: vendorData.trades,
                    address: item.address,
                    phone: item.phone,
                    rating: item.totalScore,
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
