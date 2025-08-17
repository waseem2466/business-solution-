import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref, orderByChild, equalTo, once } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
    // Paste your firebase config here
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

function showCustomModal(modal) {
    modal.classList.remove('hidden');
}
function hideCustomModal(modal) {
    modal.classList.add('hidden');
}

async function renderCustomerCard(customer) {
    const card = document.createElement("div");
    card.className = "customer-card";
    
    // Get total outstanding loans from Realtime Database
    let totalPendingLoan = 0;
    const loansSnapshot = await once(query(loansRef, orderByChild("customerPhone"), equalTo(customer.phone)));
    if (loansSnapshot.exists()) {
        const loans = loansSnapshot.val();
        for (const loan of Object.values(loans)) {
            totalPendingLoan += (Number(loan.balance) || loan.totalAmount);
        }
    }
    
    // Get total purchases from Realtime Database
    let totalPurchases = 0;
    const salesSnapshot = await once(query(salesRef, orderByChild("customerPhone"), equalTo(customer.phone)));
    if (salesSnapshot.exists()) {
        const sales = salesSnapshot.val();
        for (const sale of Object.values(sales)) {
            totalPurchases += Number(sale.totalAmount);
        }
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
    customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Loading customers...</p>';
    try {
        const querySnapshot = await getDocs(customersCollection);
        customersListDiv.innerHTML = '';
        if (querySnapshot.empty) {
            customersListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No customers found.</p>';
        } else {
            querySnapshot.forEach(async (doc) => {
                const customerData = { id: doc.id, ...doc.data() };
                const card = await renderCustomerCard(customerData);
                customersListDiv.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Error fetching customers: ", error);
        customersListDiv.innerHTML = '<p class="text-danger">Failed to load customers.</p>';
    }
}

addCustomerBtn.addEventListener("click", () => showCustomModal(addCustomerModal));
document.getElementById("close-add-modal").addEventListener("click", () => hideCustomModal(addCustomerModal));

addCustomerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("customer-name").value;
    const phone = document.getElementById("customer-phone").value;
    const email = document.getElementById("customer-email").value;

    try {
        await addDoc(customersCollection, { name, phone, email });
        alert("Customer added successfully!");
        hideCustomModal(addCustomerModal);
        addCustomerForm.reset();
        loadCustomers();
    } catch (error) {
        console.error("Error adding customer: ", error);
        alert("Failed to add customer.");
    }
});

customerSearchInput.addEventListener('input', async (e) => {
    const queryText = e.target.value.toLowerCase();
    const customerCards = customersListDiv.querySelectorAll('.customer-card');
    customerCards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        const phone = card.querySelector('p').textContent.toLowerCase();
        if (name.includes(queryText) || phone.includes(queryText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
});

document.addEventListener("DOMContentLoaded", loadCustomers);