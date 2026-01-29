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
        maxCrawlerConcurrency: 1, // Be polite
        maxReviews: 0,
        maxImages: 0,
        maxCrawledPlacesPerSearch: 10, // Limit for demo
    };

    try {
        // Run the actor
        const run = await apifyClient.actor(actorId).call(input);
        const { defaultDatasetId } = run;
        const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

        const newVendors: Vendor[] = [];

        // Process items
        // Using for...of loop to handle async Gemini calls sequentially to avoid rate limits if needed, 
        // or Promise.all for speed. sticking to Promise.all with some mapped logic.

        const processingPromises = items.map(async (item: any) => {
            // Filter for basic validity
            if (!item.title) return;

            const vendorData: Vendor = {
                companyName: item.title,
                trades: [trade],
                status: 'Raw Lead',
                compliance: {
                    coiExpiry: new Date(0), // Placeholder
                    w9OnFile: false,
                },
                // We can extract address etc if needed, but schema didn't explicitly ask for address in Vendor, 
                // though it's useful. "vendors" collection schema: companyName, trades, status, compliance, aiContextSummary.
                // I will add address to the summary or check if I should add it to doc. 
                // The schema in prompt implies distinct Locations for clients, but Vendors might just need basic info.
            };

            // Generate AI Summary
            const summary = await summarizeVendor({
                companyName: vendorData.companyName,
                trades: vendorData.trades,
                // Add more context for AI if available in scraped data like phone, address, rating
                // @ts-ignore - temporary for extra data passing to AI
                address: item.address,
                phone: item.phone,
                rating: item.totalScore,
            });

            vendorData.aiContextSummary = summary;
            newVendors.push(vendorData);
        });

        await Promise.all(processingPromises);

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
