const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCo_t2pFMtZq5_CgL2i1geFZQSfmYVK2j4",
  authDomain: "sirecoa-pro.firebaseapp.com",
  projectId: "sirecoa-pro"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const colls = ['empleados', 'asistencias', 'users', 'personal'];
    for (const c of colls) {
      console.log(`Checking collection: ${c}...`);
      const q = query(collection(db, c), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`SUCCESS! Found data in '${c}'. Database is ALIVE.`);
        return;
      } else {
        console.log(`Collection '${c}' is empty or doesn't exist.`);
      }
    }
    console.log("No data found in common collections, but database connection succeeded.");
  } catch (error) {
    console.error("ERROR CONNECTING TO DATABASE:", error.message);
  }
}
test();
