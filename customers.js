import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// Correct imports for Realtime Database modular SDK
import { getDatabase, ref, query as dbQuery, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// YOUR FIREBASE CONFIG
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const realtimeDb = getDatabase(app);
const auth = getAuth(app); // Initialize Auth

const customersCollection = collection(db, "customers");
const loansRef = ref(realtimeDb, "loans");
const salesRef = ref(realtimeDb, "sales");

const customersListDiv = document.getElementById("customers-list");
const addCustomerBtn = document.getElementById("add-customer-btn");
const addCustomerModal = document.getElementById("add-customer-modal");
const addCustomerForm = document.getElementById("add-customer-form");
const customerSearchInput = document.getElementById("customer-search");
const pageLoader = document.getElementById("page-loader");

let isAuthenticated = false; // Track authentication state


// Utility functions (copied from other files for consistency)
function showCustomModal(modal) {
    modal.classList.add('show');
    modal.classList.remove('hidden');
}
function hideCustomModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showLoader() {
    pageLoader.classList.remove('hidden');
}

function hideLoader() {
    setTimeout(() => {
        pageLoader.classList.add('hidden');
    }, 300);
}

function showAlert(message, type = 'info', duration = 3000) {
    const alertContainer = document.getElementById('alert-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert ${type} animate-fade-in-up`;
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.remove('animate-fade-in-up');
        alertDiv.classList.add('animate-fade-out-down');
        alertDiv.addEventListener('animationend', () => alertDiv.remove());
    }, duration);
}


// --- Firebase Authentication Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in (anonymously or otherwise)
        isAuthenticated = true;
        console.log("Firebase authenticated as:", user.uid);
        loadCustomers(); // Load customers once authenticated
    } else {
        // User is signed out, try to sign in anonymously
        isAuthenticated = false;
        signInAnonymously(auth).then(() => {
            console.log("Signed in anonymously.");
        }).catch((error) => {
            console.error("Anonymous sign-in failed:", error);
            showAlert("Failed to sign in. Customer data may not be accessible.", "error");
            hideLoader(); // Hide loader if sign-in fails
        });
    }
});


async function renderCustomerCard(customer) {
    const card = document.createElement("div");
    card.className = "customer-card";
    
    // Get total outstanding loans from Realtime Database
    let totalPendingLoan = 0;
    try {
        // Use dbQuery for Realtime Database queries
        const loansSnapshot = await get(dbQuery(loansRef, orderByChild("customerPhone"), equalTo(customer.phone)));
        if (loansSnapshot.exists()) {
            const loans = loansSnapshot.val();
            for (const loan of Object.values(loans)) {
                totalPendingLoan += (Number(loan.balance) || loan.totalAmount);
            }
        }
    } catch (error) {
        console.error("Error fetching loans for customer:", customer.phone, error);
    }
    
    // Get total purchases from Realtime Database
    let totalPurchases = 0;
    try {
        // Use dbQuery for Realtime Database queries
        const salesSnapshot = await get(dbQuery(salesRef, orderByChild("customerPhone"), equalTo(customer.phone)));
        if (salesSnapshot.exists()) {
            const sales = salesSnapshot.val();
            for (const sale of Object.values(sales)) {
                totalPurchases += Number(sale.totalAmount);
            }
        }
    } catch (error) {
        console.error("Error fetching sales for customer:", customer.phone, error);
    }

    card.innerHTML = `
        <h3>${customer.name}</h3>
        <p><strong>Phone:</strong> ${customer.phone}</p>
        <p class="loan-info"><strong>Total Pending Loan:</strong> Rs. ${totalPendingLoan.toFixed(2)}</p>
        <p class="purchase-info"><strong>Total Purchases:</strong> Rs. ${totalPurchases.toFixed(2)}</p>
    `;
    
    card.addEventListener("click", () => {
        // Redirect to loan.html with the customer's phone number
        window.location.href = `loan.html?customerPhone=${customer.phone}`;
    });

    return card;
}

async function loadCustomers() {
    if (!isAuthenticated) {
        customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Waiting for authentication to load customers...</p>';
        return;
    }
    showLoader();
    customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Loading customers...</p>';
    try {
        // Firestore query for customers
        const q = query(customersCollection); // No where clause needed for all customers
        const querySnapshot = await getDocs(q);
        customersListDiv.innerHTML = '';
        if (querySnapshot.empty) {
            customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No customers found.</p>';
        } else {
            const customerPromises = querySnapshot.docs.map(async (doc) => {
                const customerData = { id: doc.id, ...doc.data() };
                return renderCustomerCard(customerData);
            });
            const customerCards = await Promise.all(customerPromises);
            customerCards.forEach(card => customersListDiv.appendChild(card));
        }
    } catch (error) {
        console.error("Error fetching customers: ", error);
        showAlert('Failed to load customers: ' + error.message, "error");
        customersListDiv.innerHTML = '<p class="text-danger">Failed to load customers.</p>';
    } finally {
        hideLoader();
    }
}

addCustomerBtn.addEventListener("click", () => {
    if (!isAuthenticated) {
        showAlert("Please wait for authentication to complete before adding customers.", "warning");
        return;
    }
    showCustomModal(addCustomerModal);
});
document.getElementById("close-add-modal").addEventListener("click", () => hideCustomModal(addCustomerModal));

addCustomerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
        showAlert("Authentication in progress. Please wait and try again.", "warning");
        return;
    }

    const name = document.getElementById("customer-name").value.trim();
    const phone = document.getElementById("customer-phone").value.trim();
    const email = document.getElementById("customer-email").value.trim();

    if (!name || !phone) {
        showAlert("Name and Phone are required.", "warning");
        return;
    }

    showLoader();
    try {
        // Check if phone number already exists
        const q = query(customersCollection, where("phone", "==", phone));
        const existingCustomers = await getDocs(q);
        if (!existingCustomers.empty) {
            showAlert("A customer with this phone number already exists.", "warning");
            return;
        }

        await addDoc(customersCollection, { name, phone, email });
        showAlert("Customer added successfully!", "success");
        hideCustomModal(addCustomerModal);
        addCustomerForm.reset();
        loadCustomers(); // Reload the list
    } catch (error) {
        console.error("Error adding customer: ", error);
        showAlert("Failed to add customer: " + error.message, "error");
    } finally {
        hideLoader();
    }
});

customerSearchInput.addEventListener('input', async (e) => {
    const queryText = e.target.value.toLowerCase();
    const customerCards = customersListDiv.querySelectorAll('.customer-card');
    customerCards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        // Assuming phone is within a <p> tag directly containing "Phone: "
        const phoneElement = card.querySelector('p');
        const phone = phoneElement ? phoneElement.textContent.toLowerCase() : '';

        if (name.includes(queryText) || phone.includes(queryText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    // loadCustomers() is now called by the onAuthStateChanged listener
    // Failsafe to hide loader
    setTimeout(() => {
        if (!pageLoader.classList.contains('hidden')) {
            pageLoader.classList.add('hidden');
            console.warn("Loader hidden by failsafe timeout. Check console for any preceding errors.");
        }
    }, 10000); // Max 10 seconds load time
});
