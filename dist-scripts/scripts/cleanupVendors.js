var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
console.log('Script loaded.');
import { db } from '../src/config/firebase';
function cleanupVendors() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting chunked vendor cleanup...');
        try {
            const snapshot = yield db.collection('accounts')
                .where('type', '==', 'vendor')
                .get();
            if (snapshot.empty) {
                console.log('No vendors found to delete.');
                return;
            }
            console.log(`Found ${snapshot.size} vendors. Deleting in chunks of 500...`);
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
                const chunk = docs.slice(i, i + 500);
                const batch = db.batch();
                chunk.forEach(doc => batch.delete(doc.ref));
                yield batch.commit();
                console.log(`Deleted chunk ${Math.floor(i / 500) + 1}`);
            }
            console.log('Cleaning up activities...');
            const activitiesSnapshot = yield db.collection('activities').get();
            console.log(`Found ${activitiesSnapshot.size} total activities. Deleting those related to vendors...`);
            // This is a bit more expensive but ensures a clean slate
            const activityDocs = activitiesSnapshot.docs;
            for (let i = 0; i < activityDocs.length; i += 500) {
                const chunk = activityDocs.slice(i, i + 500);
                const batch = db.batch();
                chunk.forEach(doc => batch.delete(doc.ref));
                yield batch.commit();
                console.log(`Deleted activity chunk ${Math.floor(i / 500) + 1}`);
            }
            console.log(`Successfully cleared vendor data.`);
        }
        catch (error) {
            console.error('Cleanup failed:', error);
        }
    });
}
cleanupVendors().then(() => process.exit(0));
