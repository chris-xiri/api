// --- CRM Core Types ---

export interface Account {
    id?: string;
    name: string;
    type: 'prospect' | 'vendor';
    industry?: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        fullNumber?: string; // e.g. "123 Main St"
    };
    sqFt?: number; // Only for prospects
    status: 'Active' | 'Inactive' | 'Lead' | 'Churned';
    rating: number; // 0-5

    // Vendor specific
    trades?: string[];
    compliance?: {
        coiExpiry: Date | string;
        w9OnFile: boolean;
    };

    // Metadata
    ownerId?: string;
    aiContextSummary?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface Contact {
    id?: string;
    accountId: string;
    firstName: string;
    lastName: string;
    title?: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
}

export interface Activity {
    id?: string;
    accountId: string;
    type: 'call' | 'email' | 'meeting' | 'note';
    content: string;
    createdBy: string;
    createdAt: Date | string;
}

// --- Scraper Types ---

export interface RawLead {
    companyName: string;
    website?: string;
    phone?: string;
    email?: string;
    address?: string;
    rating?: number;
    trades?: string[]; // For vendors
    aiSummary?: string;
    source: 'google_maps';
    scrapedAt: string;
}

// Keep legacy types for now if needed, or alias them to new structures
export type Vendor = Account; // Alias for backward compatibility if needed temporarily

export interface Job {
    id?: string;
    vendorId: string;
    territoryId: string;
    status: 'assigned' | 'completed' | 'audited';
    date: string;
    vendorName?: string;
    trade?: string;
}

export interface Territory {
    id: string;
    name: string;
    zipCodes: string[];
}
