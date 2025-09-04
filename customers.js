import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref, orderByChild, equalTo, once } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const customersCollection = collection(db, "customers");
const loansRef = ref(realtimeDb, "loans");
const salesRef = ref(realtimeDb, "sales");

const customersListDiv = document.getElementById("customers-list");
const addCustomerBtn = document.getElementById("add-customer-btn");
const addCustomerModal = document.getElementById("add-customer-modal");
const addCustomerForm = document.getElementById("add-customer-form");
const customerSearchInput = document.getElementById("customer-search");
const pageLoader = document.getElementById("page-loader");


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


async function renderCustomerCard(customer) {
    const card = document.createElement("div");
    card.className = "customer-card";
    
    // Get total outstanding loans from Realtime Database
    let totalPendingLoan = 0;
    try {
        const loansSnapshot = await once(query(loansRef, orderByChild("customerPhone"), equalTo(customer.phone)));
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
        const salesSnapshot = await once(query(salesRef, orderByChild("customerPhone"), equalTo(customer.phone)));
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
    showLoader();
    customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Loading customers...</p>';
    try {
        const querySnapshot = await getDocs(customersCollection);
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
        customersListDiv.innerHTML = '<p class="text-danger">Failed to load customers.</p>';
    } finally {
        hideLoader();
    }
}

addCustomerBtn.addEventListener("click", () => showCustomModal(addCustomerModal));
document.getElementById("close-add-modal").addEventListener("click", () => hideCustomModal(addCustomerModal));

addCustomerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("customer-name").value.trim();
    const phone = document.getElementById("customer-phone").value.trim();
    const email = document.getElementById("customer-email").value.trim();

    if (!name || !phone) {
        alert("Name and Phone are required.");
        return;
    }

    showLoader();
    try {
        // Check if phone number already exists
        const q = query(customersCollection, where("phone", "==", phone));
        const existingCustomers = await getDocs(q);
        if (!existingCustomers.empty) {
            alert("A customer with this phone number already exists.");
            return;
        }

        await addDoc(customersCollection, { name, phone, email });
        alert("Customer added successfully!");
        hideCustomModal(addCustomerModal);
        addCustomerForm.reset();
        loadCustomers(); // Reload the list
    } catch (error) {
        console.error("Error adding customer: ", error);
        alert("Failed to add customer.");
    } finally {
        hideLoader();
    }
});

customerSearchInput.addEventListener('input', async (e) => {
    const queryText = e.target.value.toLowerCase();
    const customerCards = customersListDiv.querySelectorAll('.customer-card');
    customerCards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        const phone = card.querySelector('p').textContent.toLowerCase(); // Assuming phone is in a <p> tag
        if (name.includes(queryText) || phone.includes(queryText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    loadCustomers();
    // Failsafe to hide loader
    setTimeout(() => {
        if (!pageLoader.classList.contains('hidden')) {
            pageLoader.classList.add('hidden');
            console.warn("Loader hidden by failsafe timeout. Check console for any preceding errors.");
        }
    }, 10000); // Max 10 seconds load time
});
