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
    status: 'New' | 'Contacted' | 'Vetting' | 'Active' | 'Inactive' | 'Lead' | 'Churned' | 'Rejected' | 'Outreach' | 'Onboarding' | 'Unresponsive';
    rating: number; // 0-5

    // Vendor specific
    trades?: string[];
    compliance?: {
        coiExpiry: Date | string;
        insuranceExpiry?: Date | string;
        w9OnFile: boolean;
        w9Signed?: boolean;
        insuranceVerified?: boolean;
        isLLC?: boolean;
    };
    outreach?: {
        step: number;
        lastEmailSentAt?: Date | string;
        nextEmailAt?: Date | string;
        campaignId?: string;
        status: 'idle' | 'active' | 'paused' | 'completed';
    };

    // Metadata
    ownerId?: string;
    aiContextSummary?: string;
    confidenceScore?: number;
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
    source: 'google_maps' | 'yellow_pages' | 'multi_source';
    confidenceScore?: number;
    scrapedAt: string;
}

// Keep legacy types for now if needed, or alias them to new structures
export type Vendor = Account; // Alias for backward compatibility if needed temporarily

export interface Location {
    id: string;
    preferredVendorId: string;
    healthScore?: number;
}

export interface Schedule {
    locationId: string;
    active: boolean;
    frequency: string[];
    financials?: {
        clientPrice: number;
        vendorPay: number;
    };
}

export interface Job {
    id?: string;
    vendorId: string;
    locationId?: string; // made optional to match previous if needed, but likely required
    territoryId?: string; // made optional
    status: 'assigned' | 'completed' | 'audited';
    date: string;
    vendorName?: string;
    trade?: string;
    type?: string;
    financials?: {
        clientPrice: number;
        vendorPay: number;
        margin: number;
        calculatedMargin: number;
    };
    quality?: {
        auditScore?: number;
        auditNotes?: string;
        auditedBy?: string;
    };
}

export interface Territory {
    id: string;
    name: string;
    zipCodes: string[];
}
