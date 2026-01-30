import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { RawLead } from '../utils/types';
import { summarizeVendor, generateDeepVendorSummary } from './geminiService';

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
const runGoogleMapsScraper = async (
    searchStrings: string[],
    trade?: string,
    radiusMiles: number = 10,
    locationName?: string
): Promise<RawLead[]> => {
    if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN is missing');
    }

    const actorId = 'compass/crawler-google-places';

    // Base input
    const input: any = {
        searchStringsArray: searchStrings,
        maxCrawledPlacesPerSearch: 10, // Increased for better results
    };

    // If we have a location name, we specify radius if supported by the actor
    // The compass/crawler-google-places actor uses 'radiusMeters'
    // 1 mile ~ 1609 meters
    if (radiusMiles) {
        input.radiusMeters = Math.round(radiusMiles * 1609);
    }

    console.log(`Starting Apify run for: ${searchStrings.join(', ')} with radius ${radiusMiles} miles`);
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
            yearEstablished: item.yearEstablished || item.established,
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
            if (!existing.yearEstablished && yLead.yearEstablished) existing.yearEstablished = yLead.yearEstablished;
        } else {
            yLead.confidenceScore = 1;
            mergedMap.set(key, yLead);
        }
    });

    return Array.from(mergedMap.values());
};

export const scrapeVendors = async (location: string, trade: string, radius: number = 10): Promise<RawLead[]> => {
    console.log(`Scraping vendors for ${trade} in ${location} within ${radius} miles...`);

    // Run scrapers in parallel
    // Yellow Pages is mostly zip-based, so we try to use it if location looks like a zip
    const isZip = /^\d{5}(-\d{4})?$/.test(location.trim());

    const [gMapsLeads, yPagesLeads] = await Promise.all([
        runGoogleMapsScraper([`${trade} near ${location}`], trade, radius, location),
        isZip ? runYellowPagesScraper(location, trade) : Promise.resolve([])
    ]);

    const finalLeads = mergeAndCrossReference(gMapsLeads, yPagesLeads);

    // Add Deep AI Summaries for merged leads
    const enrichedLeads = await Promise.all(finalLeads.map(async (lead) => {
        try {
            const searchLocation = lead.address || location;
            const { summary, priorityScore } = await generateDeepVendorSummary(lead.companyName, searchLocation);

            lead.aiSummary = summary;
            lead.confidenceScore = (lead.confidenceScore || 1) + (priorityScore / 10);
        } catch (err) {
            console.error('Deep Enrichment failed for:', lead.companyName, err);
            if (!lead.aiSummary) {
                lead.aiSummary = await summarizeVendor({
                    name: lead.companyName,
                    trades: lead.trades,
                    website: lead.website,
                    phone: lead.phone,
                    address: { fullNumber: lead.address },
                    rating: lead.rating
                } as any).catch(() => "Summary generation failed.");
            }
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

/**
 * Calculates local market saturation based on vendor count
 */
export const getMarketSaturation = async (zipCode: string, trade: string) => {
    const actorId = 'trudax/yellow-pages-us-scraper';
    const input = {
        search: trade,
        location: zipCode,
        maxItems: 50, // Higher sample for density calc
    };

    try {
        const run = await apifyClient.actor(actorId).call(input);
        const { defaultDatasetId } = run;
        const { items } = await apifyClient.dataset(defaultDatasetId).listItems();

        const count = items.length;
        let density: 'Low' | 'Medium' | 'High' = 'Low';
        let difficulty: 'Easy' | 'Moderate' | 'Hard' = 'Easy';

        if (count > 30) {
            density = 'High';
            difficulty = 'Easy';
        } else if (count > 10) {
            density = 'Medium';
            difficulty = 'Moderate';
        } else {
            density = 'Low';
            difficulty = 'Hard';
        }

        return { count, density, difficulty, zipCode, trade };
    } catch (err) {
        console.error('Saturation check failed:', err);
        return null;
    }
};
