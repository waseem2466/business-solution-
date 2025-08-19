// billing.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref, push, set, serverTimestamp, get, orderByChild, equalTo, limitToFirst } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG)
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

// Firestore collections and Realtime Database references
const productsCollection = collection(db, "products"); // Using Firestore for products
const customersCollection = collection(db, "customers"); // Using Firestore for customers
const salesRef = ref(realtimeDb, "sales"); // Realtime DB for sales
const loansRef = ref(realtimeDb, "loans"); // Realtime DB for loans
const paymentsRef = ref(realtimeDb, "payments"); // Realtime DB for payments

// DOM Elements
const customerPhoneInput = document.getElementById('customer-phone');
const searchCustomerBtn = document.getElementById('search-customer-btn');
const customerNameDisplay = document.getElementById('customer-name-display');
const pendingLoanInfoDiv = document.getElementById('pending-loan-info');
const addCustomerFromBillingBtn = document.getElementById('add-customer-from-billing-btn');

const productSearchInput = document.getElementById('product-search');
const searchResultsList = document.getElementById('search-results');
const cartItemsContainer = document.getElementById('cart-items');
const emptyCartMessage = document.getElementById('empty-cart-message');

const subtotalSpan = document.getElementById('subtotal');
const discountInput = document.getElementById('discount-input');
const totalAmountSpan = document.getElementById('total-amount');
const cashPaidInput = document.getElementById('cash-paid-input');
const balanceDueSpan = document.getElementById('balance-due');
const loanSection = document.getElementById('loan-section');
const loanAmountInput = document.getElementById('loan-amount-input');
const loanNoteTextarea = document.getElementById('loan-note-textarea');

const clearCartBtn = document.getElementById('clear-cart-btn');
const processSaleBtn = document.getElementById('process-sale-btn');
const newBillBtn = document.getElementById('new-bill-btn');

const receiptModal = document.getElementById('receiptModal');
const closeReceiptModal = document.getElementById('closeReceiptModal');
const downloadReceiptBtn = document.getElementById('download-receipt-btn');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const cancelConfirm = document.getElementById('cancelConfirm');
const confirmProceed = document.getElementById('confirmProceed');
const closeConfirmModal = document.getElementById('closeConfirmModal');

const pageLoader = document.getElementById("page-loader");

let cart = [];
let customerData = null; // Stores selected customer's Firestore document data
let selectedCustomerId = null; // Firestore ID of the selected customer
let invoiceNumber = 'INV-' + Date.now(); // Initial invoice number

// --- Utility Functions ---

function showLoader() {
    pageLoader.classList.remove('hidden');
}

function hideLoader() {
    setTimeout(() => { // Small delay for smoother transition
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

function showCustomModal(modal) {
    modal.classList.add('show');
    modal.classList.remove('hidden');
}

function hideCustomModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => { // Give time for transition to complete before hiding
        modal.classList.add('hidden');
    }, 300); 
}

function formatLKR(amount) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// --- Customer Management ---

searchCustomerBtn.addEventListener('click', async () => {
    const phone = customerPhoneInput.value.trim();
    if (phone === '') {
        customerNameDisplay.textContent = 'Enter a phone number to search.';
        pendingLoanInfoDiv.textContent = '';
        customerData = null;
        selectedCustomerId = null;
        addCustomerFromBillingBtn.classList.add('hidden');
        return;
    }

    showLoader();
    try {
        const q = query(customersCollection, where("phone", "==", phone), limitToFirst(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            customerData = querySnapshot.docs[0].data();
            selectedCustomerId = querySnapshot.docs[0].id; // Store Firestore document ID
            customerNameDisplay.textContent = `Customer: ${customerData.name}`;
            addCustomerFromBillingBtn.classList.add('hidden');
            await loadPendingLoansForCustomer(customerData.phone);
        } else {
            customerNameDisplay.textContent = 'Customer not found.';
            pendingLoanInfoDiv.textContent = '';
            customerData = null;
            selectedCustomerId = null;
            addCustomerFromBillingBtn.classList.remove('hidden'); // Show add customer button
        }
    } catch (error) {
        console.error("Error searching customer:", error);
        showAlert("Failed to search customer.", "error");
        customerNameDisplay.textContent = 'Error searching customer.';
        pendingLoanInfoDiv.textContent = '';
        customerData = null;
        selectedCustomerId = null;
    } finally {
        hideLoader();
    }
});

addCustomerFromBillingBtn.addEventListener('click', () => {
    // Redirect to customers.html or open a modal to add customer
    // For simplicity, let's redirect to customers.html for now
    window.location.href = 'customers.html'; 
    showAlert("Redirecting to Customer Management page to add new customer.", "info");
});

async function loadPendingLoansForCustomer(phone) {
    pendingLoanInfoDiv.textContent = 'Checking pending loans...';
    try {
        let totalPending = 0;
        const loansSnapshot = await get(query(loansRef, orderByChild("customerPhone"), equalTo(phone)));
        if (loansSnapshot.exists()) {
            loansSnapshot.forEach(loanChild => {
                const loan = loanChild.val();
                if (loan.balance > 0) {
                    totalPending += loan.balance;
                }
            });
        }
        pendingLoanInfoDiv.textContent = `Pending Loan: ${formatLKR(totalPending)}`;
        pendingLoanInfoDiv.style.color = totalPending > 0 ? '#dc2626' : '#28a745'; // Red if pending, green if none
    } catch (error) {
        console.error("Error loading pending loans:", error);
        pendingLoanInfoDiv.textContent = 'Failed to load pending loan info.';
        pendingLoanInfoDiv.style.color = '#dc2626';
    }
}

// --- Product Search ---

productSearchInput.addEventListener('input', async () => {
    const queryText = productSearchInput.value.trim().toLowerCase();
    searchResultsList.innerHTML = '';

    if (queryText.length < 2) {
        searchResultsList.classList.add('hidden');
        return;
    }

    try {
        // Fetch all products and filter locally for fuzzy search
        const productsSnapshot = await getDocs(productsCollection);
        const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const filteredProducts = products.filter(p => 
            p.name.toLowerCase().includes(queryText) || 
            (p.code && p.code.toLowerCase().includes(queryText))
        );

        if (filteredProducts.length > 0) {
            filteredProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `${product.name} (Rs. ${product.price.toFixed(2)}) - Stock: ${product.qty}`;
                li.dataset.productId = product.id;
                li.dataset.productName = product.name;
                li.dataset.productPrice = product.price;
                li.dataset.productCostPrice = product.costPrice || 0; // Assuming costPrice exists
                li.dataset.productQty = product.qty; // Current stock
                li.addEventListener('click', () => addProductToCart(product));
                searchResultsList.appendChild(li);
            });
            searchResultsList.classList.remove('hidden');
        } else {
            const li = document.createElement('li');
            li.textContent = 'No products found.';
            li.style.cursor = 'default';
            searchResultsList.appendChild(li);
            searchResultsList.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error searching products:", error);
        showAlert("Failed to search products.", "error");
        searchResultsList.classList.add('hidden');
    }
});

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!productSearchInput.contains(e.target) && !searchResultsList.contains(e.target)) {
        searchResultsList.classList.add('hidden');
    }
});

// --- Cart Management ---

function addProductToCart(product) {
    // Check if product is already in cart
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        // Check if adding another unit exceeds current stock
        if (existingItem.qtyInCart < product.qty) { // product.qty is current stock available
            existingItem.qtyInCart++;
            showAlert(`${product.name} quantity updated in cart.`, 'info');
        } else {
            showAlert(`Cannot add more ${product.name}. Max stock reached.`, 'warning');
            return;
        }
    } else {
        // Check if there is stock available before adding
        if (product.qty > 0) {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                costPrice: product.costPrice || 0,
                qtyInCart: 1,
                maxQty: product.qty // Max quantity available in stock
            });
            showAlert(`${product.name} added to cart.`, 'success');
        } else {
            showAlert(`${product.name} is out of stock.`, 'error');
            return;
        }
    }
    productSearchInput.value = ''; // Clear search input
    searchResultsList.classList.add('hidden'); // Hide search results
    renderCartItems();
    calculateTotals();
}

function updateCartItemQuantity(productId, newQty) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        const parsedQty = parseInt(newQty);
        if (isNaN(parsedQty) || parsedQty < 1) {
            // If quantity becomes invalid, remove it or set to 1
            item.qtyInCart = 1; // Default to 1 to prevent invalid state
            showAlert("Quantity must be at least 1.", "warning");
        } else if (parsedQty > item.maxQty) {
            item.qtyInCart = item.maxQty;
            showAlert(`Cannot add more than available stock for ${item.name}.`, 'warning');
        } else {
            item.qtyInCart = parsedQty;
        }
    }
    renderCartItems();
    calculateTotals();
}

function removeCartItem(productId) {
    cart = cart.filter(item => item.id !== productId);
    showAlert("Product removed from cart.", "info");
    renderCartItems();
    calculateTotals();
}

function renderCartItems() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        return;
    } else {
        emptyCartMessage.style.display = 'none';
    }

    cart.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <span class="cart-item-name">${item.name}</span>
            <input type="number" class="qty-input" value="${item.qtyInCart}" min="1" max="${item.maxQty}" data-product-id="${item.id}">
            <span class="cart-item-price">${formatLKR(item.price * item.qtyInCart)}</span>
            <div class="cart-item-actions">
                <button class="remove-item-btn" data-product-id="${item.id}">&times;</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemDiv);
    });

    // Add event listeners for quantity inputs
    cartItemsContainer.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            updateCartItemQuantity(e.target.dataset.productId, e.target.value);
        });
    });

    // Add event listeners for remove buttons
    cartItemsContainer.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            removeCartItem(e.target.dataset.productId);
        });
    });
}

// --- Calculation Logic ---

function calculateTotals() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qtyInCart), 0);
    const discount = parseFloat(discountInput.value) || 0;
    let totalAmount = subtotal - discount;
    let cashPaid = parseFloat(cashPaidInput.value) || 0;
    let balanceDue = totalAmount - cashPaid;

    subtotalSpan.textContent = formatLKR(subtotal);
    totalAmountSpan.textContent = formatLKR(totalAmount);
    balanceDueSpan.textContent = formatLKR(balanceDue);

    // Show loan section if there's a balance due and a customer is selected
    if (balanceDue > 0 && customerData) {
        loanSection.classList.remove('hidden');
        loanAmountInput.value = balanceDue.toFixed(2);
    } else {
        loanSection.classList.add('hidden');
        loanAmountInput.value = '0';
        loanNoteTextarea.value = '';
    }
}

discountInput.addEventListener('input', calculateTotals);
cashPaidInput.addEventListener('input', calculateTotals);

// --- Process Sale ---

processSaleBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        showAlert("Cart is empty. Add products to proceed.", "warning");
        return;
    }

    confirmMessage.textContent = "Are you sure you want to process this sale?";
    showCustomModal(confirmModal);

    // Set up confirm action
    confirmProceed.onclick = async () => {
        hideCustomModal(confirmModal);
        await finalizeSale();
    };
});

async function finalizeSale() {
    showLoader();
    try {
        const saleData = {
            invoiceNumber: invoiceNumber,
            date: new Date().toISOString(),
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.qtyInCart,
                price: item.price,
                costPrice: item.costPrice // Include cost price for reporting
            })),
            subtotal: parseFloat(subtotalSpan.textContent.replace('Rs. ', '').replace(/,/g, '')),
            discount: parseFloat(discountInput.value) || 0,
            totalAmount: parseFloat(totalAmountSpan.textContent.replace('Rs. ', '').replace(/,/g, '')),
            cashPaid: parseFloat(cashPaidInput.value) || 0,
            balanceDue: parseFloat(balanceDueSpan.textContent.replace('Rs. ', '').replace(/,/g, '')),
            customerPhone: customerData ? customerData.phone : 'N/A', // Store customer phone
            customerName: customerData ? customerData.name : 'Walk-in Customer' // Store customer name
        };

        // If there's a balance due and a customer is selected, create a loan
        if (saleData.balanceDue > 0 && customerData) {
            const newLoanRef = push(loansRef); // Generate unique ID for loan
            await set(newLoanRef, {
                loanId: newLoanRef.key, // Store the generated key as loanId
                customerId: selectedCustomerId, // Firestore customer ID
                customerPhone: customerData.phone, // Customer phone for easier lookup
                loanDate: new Date().toISOString(),
                products: saleData.items, // List of products for the loan
                discount: saleData.discount,
                totalAmount: saleData.totalAmount,
                paidAmount: saleData.cashPaid, // Initial payment on loan
                balance: saleData.balanceDue,
                note: loanNoteTextarea.value.trim()
            });
            showAlert("Loan created successfully!", "success");
        }

        // Save sale to Realtime Database
        const newSaleRef = push(salesRef);
        await set(newSaleRef, saleData);
        showAlert("Sale processed successfully!", "success");

        // Update product quantities in Firestore
        for (const item of cart) {
            const productDocRef = doc(db, "products", item.id);
            const productDoc = await getDoc(productDocRef);
            if (productDoc.exists()) {
                const currentQty = productDoc.data().qty;
                const newQty = currentQty - item.qtyInCart;
                await updateDoc(productDocRef, { qty: newQty >= 0 ? newQty : 0 }); // Ensure quantity doesn't go negative
            }
        }
        showAlert("Product quantities updated in stock.", "info");

        // Display receipt
        displayReceipt(saleData);

    } catch (error) {
        console.error("Error processing sale:", error);
        showAlert("Failed to process sale. Please try again.", "error");
    } finally {
        hideLoader();
    }
}

// --- Receipt Display ---

function displayReceipt(saleData) {
    document.getElementById('receipt-invoice-number').textContent = saleData.invoiceNumber;
    document.getElementById('receipt-date').textContent = new Date(saleData.date).toLocaleString();
    document.getElementById('receipt-subtotal').textContent = formatLKR(saleData.subtotal);
    document.getElementById('receipt-discount').textContent = formatLKR(saleData.discount);
    document.getElementById('receipt-total').textContent = formatLKR(saleData.totalAmount);
    document.getElementById('receipt-cash-paid').textContent = formatLKR(saleData.cashPaid);
    document.getElementById('receipt-balance-due').textContent = formatLKR(saleData.balanceDue);

    const receiptItemsContainer = document.getElementById('receipt-items');
    receiptItemsContainer.innerHTML = '';
    saleData.items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        itemRow.innerHTML = `
            <span class="name">${item.name}</span>
            <span class="qty">${item.qty} x</span>
            <span class="price">${formatLKR(item.price)}</span>
            <span class="total">${formatLKR(item.qty * item.price)}</span>
        `;
        receiptItemsContainer.appendChild(itemRow);
    });

    if (saleData.balanceDue > 0 && customerData) {
        document.getElementById('receipt-loan-details').classList.remove('hidden');
        document.getElementById('receipt-loan-amount').textContent = formatLKR(saleData.balanceDue);
        document.getElementById('receipt-loan-note').textContent = saleData.loanNote || 'N/A';
    } else {
        document.getElementById('receipt-loan-details').classList.add('hidden');
    }

    showCustomModal(receiptModal);
}

closeReceiptModal.addEventListener('click', () => {
    hideCustomModal(receiptModal);
    newBill(); // Start a new bill after closing receipt
});

downloadReceiptBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const receiptContent = document.getElementById('receipt-content'); // Get the entire receipt content

    // Use html2canvas to render the HTML to a canvas, then add to PDF
    html2canvas(receiptContent, {
        scale: 2 // Increase scale for better quality
    }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 200; 
        const pageHeight = doc.internal.pageSize.height;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        doc.save(`Invoice_${invoiceNumber}.pdf`);
        showAlert("Receipt downloaded successfully!", "success");
    }).catch(error => {
        console.error("Error generating PDF:", error);
        showAlert("Failed to generate PDF receipt.", "error");
    });
});


// --- New Bill ---

newBillBtn.addEventListener('click', () => {
    if (cart.length > 0 || customerPhoneInput.value !== '' || discountInput.value !== '0' || cashPaidInput.value !== '0') {
        confirmMessage.textContent = "Current bill has unsaved changes. Start a new bill?";
        showCustomModal(confirmModal);
        confirmProceed.onclick = () => {
            newBill();
            hideCustomModal(confirmModal);
        };
        cancelConfirm.onclick = () => {
            hideCustomModal(confirmModal);
        };
        closeConfirmModal.onclick = () => {
            hideCustomModal(confirmModal);
        };
    } else {
        newBill();
    }
});

function newBill() {
    cart = [];
    customerData = null; // Clear customer data
    selectedCustomerId = null; // Clear selected customer ID
    customerPhoneInput.value = '';
    customerNameDisplay.textContent = ''; // Clear customer name display
    pendingLoanInfoDiv.innerHTML = '';
    productSearchInput.value = '';
    searchResultsList.classList.add('hidden');
    discountInput.value = '0';
    cashPaidInput.value = '0';
    loanAmountInput.value = '0';
    loanNoteTextarea.value = '';
    invoiceNumber = 'INV-' + Date.now(); // Generate new invoice number
    // invoiceNumberSpan.textContent = invoiceNumber; // Uncomment if you have an invoice number display on the main page
    renderCartItems();
    calculateTotals(); // Recalculate totals and balance for a fresh start
    showAlert('New bill started', 'info');
}

// --- Clear Cart ---
clearCartBtn.addEventListener('click', () => {
    if (cart.length > 0) {
        confirmMessage.textContent = "Are you sure you want to clear the cart?";
        showCustomModal(confirmModal);
        confirmProceed.onclick = () => {
            cart = [];
            renderCartItems();
            calculateTotals();
            showAlert("Cart cleared.", "info");
            hideCustomModal(confirmModal);
        };
        cancelConfirm.onclick = () => {
            hideCustomModal(confirmModal);
        };
        closeConfirmModal.onclick = () => {
            hideCustomModal(confirmModal);
        };
    } else {
        showAlert("Cart is already empty.", "info");
    }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    renderCartItems(); // Render empty cart initially
    calculateTotals(); // Calculate initial totals
    hideLoader(); // Hide initial page loader
    // Load html2canvas dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => console.log('html2canvas loaded');
    document.head.appendChild(script);
});

// Failsafe to hide loader
setTimeout(() => {
    if (!pageLoader.classList.contains('hidden')) {
        pageLoader.classList.add('hidden');
        console.warn("Loader hidden by failsafe timeout. Check console for any preceding errors.");
    }
}, 20000); // Max 20 seconds load time
