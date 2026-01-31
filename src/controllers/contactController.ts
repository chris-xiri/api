import { Request, Response } from 'express';
import { db } from '../config/firebase';

export const getContactsHandler = async (req: Request, res: Response) => {
    try {
        const { accountId } = req.query;
        let query: any = db.collection('contacts');

        if (accountId) {
            query = query.where('accountId', '==', accountId);
        }

        const snapshot = await query.get();
        const contacts = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.status(200).json({ data: contacts });
    } catch (error) {
        console.error('Error in getContactsHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createContactHandler = async (req: Request, res: Response) => {
    try {
        const contactData = req.body;

        if (!contactData.accountId || !contactData.firstName) {
            return res.status(400).json({ error: 'AccountId and FirstName are required' });
        }

        const docRef = await db.collection('contacts').add({
            ...contactData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return res.status(201).json({ id: docRef.id, message: 'Contact created successfully' });
    } catch (error) {
        console.error('Error in createContactHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateContactHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }

        await db.collection('contacts').doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });

        return res.status(200).json({ message: 'Contact updated successfully' });
    } catch (error) {
        console.error('Error in updateContactHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteContactHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Contact ID is required' });
        }

        await db.collection('contacts').doc(id).delete();

        return res.status(200).json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error in deleteContactHandler:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
