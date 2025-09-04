import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyACehOi7n-dbdN00D4tJr2kD_-AVR6S-Vo",
  authDomain: "wr-smile-shop.firebaseapp.com",
  databaseURL: "https://wr-smile-shop-default-rtdb.firebaseio.com",
  projectId: "wr-smile-shop",
  storageBucket: "wr-smile-shop.firebasestorage.app",
  messagingSenderId: "299864260187",
  appId: "1:299864260187:web:fa6af65ef95674aff1097e",
  measurementId: "G-3Z38G6MCYJ"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
let db = getFirestore(app);
let auth = getAuth(app);

let userId = "anonymous";
let currentCustomer = null;
let billItems = [];
let stockItems = [];

// ✅ Sign in anonymously
signInAnonymously(auth).then(() => {
  console.log("Signed in anonymously");
}).catch((error) => {
  console.error("Auth error:", error);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    console.log("User signed in:", userId);
    fetchStockItems();
  }
});
