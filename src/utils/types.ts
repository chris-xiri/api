export interface Vendor {
    id?: string;
    companyName: string;
    trades: string[];
    status: 'Raw Lead' | 'Active';
    compliance: {
        coiExpiry: Date | string; // Firestore timestamp or string date
        w9OnFile: boolean;
    };
    aiContextSummary?: string;
    ownerId?: string;
    website?: string;
    phone?: string;
    email?: string;
}

export interface Client {
    id?: string;
    clientName: string;
    paymentTerms: 'Net30' | 'Net15';
    billingContact: string;
    assignedPodId?: string;
}

export interface Location {
    id?: string;
    clientId: string;
    address: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
    accessCodes: string;
    healthScore: number;
    preferredVendorId: string;
    territory: string;
}

export interface Job {
    id?: string;
    locationId: string;
    vendorId: string;
    date: Date | string;
    status: 'Scheduled' | 'Verified' | 'Complaint' | 'Complete';
    type: 'Recurring' | 'Project';
    financials: {
        clientPrice: number;
        vendorPay: number;
        margin: number;
        calculatedMargin?: number;
    };
    quality?: {
        auditScore: number;
        auditNotes: string;
        auditedBy: string;
    };
}

export interface Schedule {
    id?: string;
    locationId: string;
    frequency: string[]; // ["Mon", "Wed", "Fri"]
    active: boolean;
    financials: {
        clientPrice: number;
        vendorPay: number;
    };
}
