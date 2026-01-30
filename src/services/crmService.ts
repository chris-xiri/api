import { db } from '../config/firebase';
import { Account, RawLead } from '../utils/types';

/**
 * Batch imports raw leads as Accounts (Prospects or Vendors)
 */
export const importAccounts = async (leads: RawLead[], type: 'prospect' | 'vendor', ownerId?: string, initialStatus?: Account['status']): Promise<number> => {
    if (leads.length === 0) return 0;

    const batch = db.batch();
    const collectionRef = db.collection('accounts'); // Renamed from 'vendors' to 'accounts' for CRM model

    leads.forEach((lead) => {
        const docRef = collectionRef.doc(); // Auto-ID

        const newAccount: Account = {
            id: docRef.id,
            name: lead.companyName,
            type: type,
            status: initialStatus || (type === 'prospect' ? 'Lead' : 'New'),
            rating: lead.rating || 0,
            website: lead.website,
            phone: lead.phone,
            email: lead.email,
            address: {
                fullNumber: lead.address,
            },
            aiContextSummary: lead.aiSummary,
            confidenceScore: lead.confidenceScore,
            ownerId: ownerId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Vendor specific
            ...(type === 'vendor' ? {
                trades: lead.trades,
                compliance: {
                    coiExpiry: new Date().toISOString(),
                    w9OnFile: false
                },
                outreach: {
                    status: 'idle',
                    step: 0
                }
            } : {})
        };

        batch.set(docRef, newAccount);
    });

    await batch.commit();
    return leads.length;
};

/**
 * Fetches Account details + basic Activity feed stub
 */
export const getAccountDetails = async (accountId: string) => {
    const accountDoc = await db.collection('accounts').doc(accountId).get();

    if (!accountDoc.exists) {
        throw new Error('Account not found');
    }

    const account = accountDoc.data() as Account;

    // In a real app, we'd fetch sub-collections here (e.g. activities, contacts)
    // const contactsSnapshot = await accountDoc.ref.collection('contacts').get();
    // const activitiesSnapshot = await accountDoc.ref.collection('activities').get();

    return {
        account,
        contacts: [], // Stub for now
        activities: [], // Stub for now
    };
};

/**
 * Fetches multiple accounts with optional filtering
 */
export const getAccounts = async (type?: 'prospect' | 'vendor') => {
    let query: FirebaseFirestore.Query = db.collection('accounts');

    if (type) {
        query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as Account);
};
