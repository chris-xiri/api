import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { RawLead } from '../utils/types';
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

/**
 * Shared helper to run the Google Maps Scraper and format as RawLead
 */
const runGoogleMapsScraper = async (searchStrings: string[], trade?: string): Promise<RawLead[]> => {
    if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN is missing');
    }

    const actorId = 'compass/crawler-google-places';

    const input = {
        searchStringsArray: searchStrings,
        maxCrawledPlacesPerSearch: 3,
    };

    console.log(`Starting Apify run for: ${searchStrings.join(', ')}`);
    const run = await apifyClient.actor(actorId).call(input);
    const { defaultDatasetId } = run;
    const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

    // 1. Filter valid items
    const validItems = (items as unknown as ApifyPlaceItem[]).filter(item => {
        const name = item.title || item.name || item.companyName;
        const website = item.website || item.url;
        if (!name || !website) {
            return false;
        }
        return true;
    });

    // 2. Map directly to RawLead in parallel (generating summaries)
    const leadPromises = validItems.map(async (item) => {
        try {
            const name = item.title || item.name || item.companyName;
            const website = item.website || item.url;

            const lead: RawLead = {
                companyName: String(name),
                website: website,
                phone: item.phone,
                email: item.email,
                address: item.address,
                rating: item.totalScore || item.rating,
                source: 'google_maps',
                scrapedAt: new Date().toISOString(),
                trades: trade ? [trade] : [],
            };

            // Generate AI Summary
            const summary = await summarizeVendor({
                companyName: lead.companyName,
                trades: lead.trades,
                website: lead.website,
                phone: lead.phone,
                address: lead.address,
                rating: lead.rating
            } as any).catch(() => "Summary generation failed.");

            lead.aiSummary = summary;
            return lead;

        } catch (err) {
            console.error('Error processing item:', err);
            return null;
        }
    });

    const results = await Promise.all(leadPromises);
    return results.filter((l): l is RawLead => l !== null);
};

export const scrapeVendors = async (zipCode: string, trade: string): Promise<RawLead[]> => {
    return runGoogleMapsScraper([`${trade} in ${zipCode}`], trade);
};

export const scrapeProspects = async (zipCode: string, query: string): Promise<RawLead[]> => {
    // e.g. "Property Management companies in 90210"
    return runGoogleMapsScraper([`${query} in ${zipCode}`]);
};
