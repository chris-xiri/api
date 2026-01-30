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

/**
 * Run the Yellow Pages Scraper and format as RawLead
 */
const runYellowPagesScraper = async (zipCode: string, trade: string): Promise<RawLead[]> => {
    if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN is missing');
    }

    const actorId = 'trudax/yellow-pages-us-scraper';
    const input = {
        search: trade,
        location: zipCode,
        maxItems: 3,
    };

    console.log(`Starting Yellow Pages run for: ${trade} in ${zipCode}`);
    try {
        const run = await apifyClient.actor(actorId).call(input);
        const { defaultDatasetId } = run;
        const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

        return (items as any[]).map(item => ({
            companyName: item.name || item.title,
            website: item.website,
            phone: item.phone,
            email: item.email,
            address: item.address,
            source: 'yellow_pages' as const,
            scrapedAt: new Date().toISOString(),
            trades: [trade],
        })).filter(l => l.companyName && (l.website || l.phone));
    } catch (err) {
        console.error('Yellow Pages scraper failed:', err);
        return [];
    }
};

/**
 * Normalizes a URL for comparison (removes protocol, www, and trailing slash)
 */
const normalizeUrl = (url?: string): string => {
    if (!url) return '';
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
};

/**
 * Normalizes a phone number for comparison (keeps only digits)
 */
const normalizePhone = (phone?: string): string => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

/**
 * Merges leads from multiple sources and cross-references them
 */
const mergeAndCrossReference = (gMapsLeads: RawLead[], yPagesLeads: RawLead[]): RawLead[] => {
    const mergedMap = new Map<string, RawLead>();

    // Process Google Maps leads first (baseline)
    gMapsLeads.forEach(lead => {
        const key = normalizeUrl(lead.website) || normalizePhone(lead.phone);
        if (key) {
            lead.confidenceScore = 1;
            mergedMap.set(key, lead);
        }
    });

    // Merge Yellow Pages leads
    yPagesLeads.forEach(yLead => {
        const key = normalizeUrl(yLead.website) || normalizePhone(yLead.phone);
        if (!key) return;

        if (mergedMap.has(key)) {
            const existing = mergedMap.get(key)!;
            // Update confidence
            existing.confidenceScore = 2;
            existing.source = 'multi_source' as const;

            // Enrich details
            if (!existing.email && yLead.email) existing.email = yLead.email;
            if (!existing.phone && yLead.phone) existing.phone = yLead.phone;
            if (!existing.website && yLead.website) existing.website = yLead.website;
        } else {
            yLead.confidenceScore = 1;
            mergedMap.set(key, yLead);
        }
    });

    return Array.from(mergedMap.values());
};

export const scrapeVendors = async (zipCode: string, trade: string): Promise<RawLead[]> => {
    console.log(`Scraping vendors for ${trade} in ${zipCode}...`);

    // Run scrapers in parallel
    const [gMapsLeads, yPagesLeads] = await Promise.all([
        runGoogleMapsScraper([`${trade} in ${zipCode}`], trade),
        runYellowPagesScraper(zipCode, trade)
    ]);

    const finalLeads = mergeAndCrossReference(gMapsLeads, yPagesLeads);

    // Add AI Summaries for merged leads that don't have one 
    // (Note: runGoogleMapsScraper already does it for its leads, but merged YP leads might need it)
    const enrichedLeads = await Promise.all(finalLeads.map(async (lead) => {
        if (!lead.aiSummary) {
            lead.aiSummary = await summarizeVendor({
                companyName: lead.companyName,
                trades: lead.trades,
                website: lead.website,
                phone: lead.phone,
                address: lead.address,
                rating: lead.rating
            } as any).catch(() => "Summary generation failed.");
        }
        return lead;
    }));

    return enrichedLeads;
};

export const scrapeProspects = async (zipCode: string, query: string): Promise<RawLead[]> => {
    // Prospects still use Google Maps primarily
    const leads = await runGoogleMapsScraper([`${query} in ${zipCode}`]);
    return leads.map(l => ({ ...l, confidenceScore: 1 }));
};
