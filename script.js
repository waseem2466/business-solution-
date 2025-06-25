async function generateReport(startDate, endDate) {
  const snapshot = await firebase.database().ref('sales').once('value');
  const sales = [];
  snapshot.forEach(child => {
    const sale = child.val();
    const saleDate = new Date(sale.date);
    if (saleDate >= startDate && saleDate <= endDate) {
      sales.push(sale);
    }
  });

  let totalSales = 0;
  let totalCost = 0;

  sales.forEach(sale => {
    sale.items.forEach(item => {
      totalSales += item.price * item.qty;
      totalCost += item.costPrice * item.qty;
    });
  });

  const profit = totalSales - totalCost;

  console.log(`Report from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  console.log(`Total Sales: Rs. ${totalSales.toFixed(2)}`);
  console.log(`Total Cost: Rs. ${totalCost.toFixed(2)}`);
  console.log(`Profit: Rs. ${profit.toFixed(2)}`);

  return { totalSales, totalCost, profit };
  // --- Utility Functions ---
 function formatLKR(amount) {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
 }

 function showAlert(message, type = 'info', duration = 3000) {
    const alertContainer = document.getElementById('alert-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-message ${type}`;
    alertDiv.textContent = message;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.classList.add('show');
    }, 10);
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertContainer.removeChild(alertDiv);
        }, 300);
    }, duration);
 }

 function renderCartItems() {
    cartItemsDiv.innerHTML = '';
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-gray-500 text-center py-4">No items in cart yet. Add some products!</p>';
        return;
    }
    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-details">
                <span>${item.name}</span>
                <p class="text-sm text-gray-600">Rs. ${item.price} x ${item.quantity}</p>
            </div>
            <div class="cart-item-actions">
                <input type="number" class="qty-input" value="${item.quantity}" min="1">
                <button class="btn-danger-custom small remove-item-btn" data-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h12a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 01-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 002 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        cartItemsDiv.appendChild(cartItem);
    });

    // Re-attach event listeners for quantity changes and remove buttons
    attachCartItemListeners();
}

function calculateTotals() {
    const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseFloat(discountInput.value) || 0;
    const total = subTotal - discount;
    const cashPaid = parseFloat(cashPaidInput.value) || 0;
    const loanAmount = total - cashPaid;

    subTotalAmountSpan.textContent = formatLKR(subTotal);
    totalAmountSpan.textContent = formatLKR(total);
    loanAmountInput.value = parseFloat(loanAmount.toFixed(2)); // Store as number

    // Provide real-time feedback on loan amount
    if (loanAmount < 0) {
        loanAmountInput.classList.add('text-green-600', 'font-semibold');
        loanAmountInput.classList.remove('text-gray-700');
    } else {
        loanAmountInput.classList.remove('text-green-600', 'font-semibold');
        loanAmountInput.classList.add('text-gray-700');
    }
}

function attachCartItemListeners() {
    cartItemsDiv.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const productId = e.target.closest('.cart-item').querySelector('.remove-item-btn').dataset.id;
            const newQuantity = parseInt(e.target.value);
            if (newQuantity > 0) {
                const itemIndex = cart.findIndex(item => item.id === productId);
                if (itemIndex !== -1) {
                    cart.splice(itemIndex, 1, {...cartItemsDiv, quantity: newQuantity });
                    renderCartItems();
                    calculateTotals();
                }
            } else {
                e.target.value = cart.find(item => item.id === productId).quantity; // Revert to valid qty
                showAlert('Quantity must be at least 1', 'error');
            }
        });
    });

    cartItemsDiv.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.id || e.target.closest('button').dataset.id;
            cart = cart.filter(item => item.id !== productId);
            renderCartItems();
            calculateTotals();
            showAlert('Item removed from cart', 'info');
        });
    });
}

function clearCart() {
    cart = [];
    renderCartItems();
    calculateTotals();
    showAlert('Cart cleared', 'info');
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    showLoader();
    try {
        const productsSnapshot = await getDocs(productsCollectionRef);
        allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        hideLoader();
    } catch (error) {
        console.error("Error fetching products:", error);
        showAlert('Failed to load products', 'error');
        hideLoader();
    }
    invoiceNumberSpan.textContent = invoiceNumber;
    renderCartItems();
    calculateTotals();

    // Customer Search
    searchCustomerBtn.addEventListener('click', async () => {
        const phone = customerPhoneInput.value.trim();
        if (phone) {
            showLoader();
            try {
                const q = query(customersCollectionRef, where("phone", "==", phone));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    customerData = { id: querySnapshot.docs. [0].id, ...querySnapshot.docs. [0].data() };
                    customerNameInput.value = customerData.name || '';
                    selectedCustomerId = customerData.id;
                    // Fetch and display pending loan for the customer
                    const loansQuery = query(loansCollectionRef, where("customerId", "==", customerData.id), where("status", "==", "pending"));
                    const loansSnapshot = await getDocs(loansQuery);
                    let loanInfo = '';
                    loansSnapshot.forEach(doc => {
                        const loan = doc.data();
                        loanInfo += `Pending Loan: ${formatLKR(loan.loanAmount)}, Date: ${new Date(loan.date.toMillis()).toLocaleDateString()}<br>`;
                    });
                    pendingLoanInfoDiv.innerHTML = loanInfo;
                    showAlert(`Customer found: ${customerData.name}`, 'success');
                } else {
                    customerData = null;
                    customerNameInput.value = '';
                    selectedCustomerId = null;
                    pendingLoanInfoDiv.innerHTML = '';
                    // Prompt to add new customer
                    customerPhoneInModal.value = phone;
                    addCustomerModal.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Error searching customer:", error);
                showAlert('Error searching for customer', 'error');
            } finally {
                hideLoader();
            }
        } else {
            showAlert('Please enter a customer phone number', 'info');
        }
    });

    // Add New Customer Form Submission
    addCustomerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = customerPhoneInModal.value;
        const name = customerNameInModal.value.trim();
        if (name) {
            showLoader();
            try {
                const newCustomer = { phone, name, createdDate: new Date() };
                const docRef = await addDoc(customersCollectionRef, newCustomer);
                customerData = { id: docRef.id, ...newCustomer };
                customerNameInput.value = name;
                selectedCustomerId = docRef.id;
                showAlert(`Customer "${name}" added successfully!`, 'success');
                addCustomerModal.classList.add('hidden');
                customerNameInModal.value = ''; // Reset modal form
            } catch (error) {
                console.error("Error adding new customer:", error);
                showAlert('Error adding new customer', 'error');
            } finally {
                hideLoader();
            }
        } else {
            showAlert('Please enter the customer name', 'warning');
        }
    });

    // Close Add Customer Modal
    document.getElementById('cancelAddCustomerModal').addEventListener('click', () => {
        addCustomerModal.classList.add('hidden');
        customerNameInModal.value = ''; // Reset modal form
    });
    document.getElementById('closeAddCustomerModal').addEventListener('click', () => {
        addCustomerModal.classList.add('hidden');
        customerNameInModal.value = ''; // Reset modal form
    });

    // Product Search
    productSearchInput.addEventListener('input', () => {
        const searchTerm = productSearchInput.value.toLowerCase().trim();
        const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
        searchResultsList.innerHTML = '';
        if (searchTerm && filteredProducts.length > 0) {
            filteredProducts.forEach(product => {
                const li = document.createElement('li');
                li.textContent = `${product.name} (Rs. ${product.price})`;
                li.addEventListener('click', () => {
                    addProductToCart(product);
                    productSearchInput.value = '';
                    searchResultsList.classList.add('hidden');
                });
                searchResultsList.appendChild(li);
            });
            searchResultsList.classList.remove('hidden');
        } else {
            searchResultsList.classList.add('hidden');
        }
    });

    function addProductToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            cart = cart.map(item =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        } else {
            cart = [...cart, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
        }
        renderCartItems();
        calculateTotals();
        showAlert(`${product.name} added to cart`, 'success');
    }

    discountInput.addEventListener('input', calculateTotals);
    cashPaidInput.addEventListener('input', calculateTotals);

    saveBillBtn.addEventListener('click', async () => {
        if (!customerData) {
            showAlert('Please select a customer', 'warning');
            return;
        }
        if (cart.length === 0) {
            showAlert('Cart is empty', 'warning');
            return;
        }

        const totalAmount = parseFloat(totalAmountSpan.textContent.replace('LKR\xa0', '').replace(',', '')); // Extract number
        const cashPaid = parseFloat(cashPaidInput.value) || 0;
        const loanAmount = parseFloat(loanAmountInput.value);
        const loanNote = loanNoteTextarea.value.trim();
        const billDate = new Date();
        const items = cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }));

        const billData = {
            invoiceNumber,
            customerId: selectedCustomerId,
            customerName: customerData.name,
            date: billDate,
            items,
            subTotal: parseFloat(subTotalAmountSpan.textContent.replace('LKR\xa0', '').replace(',', '')),
            discount: parseFloat(discountInput.value) || 0,
            totalAmount,
            cashPaid,
            loanAmount,
            loanNote: loanAmount > 0 ? loanNote : '',
            status: 'paid' // Default status
        };

        if (loanAmount > 0) {
            billData.status = 'pending_loan';
        }

        showLoader();
        try {
            const invoiceRef = await addDoc(invoicesCollectionRef, billData);
            showAlert(`Bill saved successfully! Invoice: ${invoiceNumber}`, 'success');

            // If there's a loan, save it to the loans collection
            if (loanAmount > 0) {
                await addDoc(loansCollectionRef, {
                    invoiceId: invoiceRef.id,
                    customerId: selectedCustomerId,
                    customerName: customerData.name,
                    date: billDate,
                    loanAmount,
                    note: loanNote,
                    status: 'pending'
                });
                showAlert('Loan recorded.', 'info');
            }

            // Optionally update product stock (needs implementation)
            console.log("Bill saved with ID: ", invoiceRef.id);
            newBill(); // Prepare for the next bill
        } catch (error) {
            console.error("Error saving bill:", error);
            showAlert('Error saving bill', 'error');
        } finally {
            hideLoader();
        }
    });

    printBillBtn.addEventListener('click', () => {
        // Basic print functionality - you might want to generate a more detailed PDF
        window.print();
    });

    whatsappBillBtn.addEventListener('click', () => {
        if (!customerData || cart.length === 0) {
            showAlert('Please select a customer and add items to the cart first', 'warning');
            return;
        }

        let message = `WR Smile - Invoice ${invoiceNumber}\nCustomer: ${customerData.name}\n\nItems:\n`;
        cart.forEach(item => {
            message += `${item.name} x ${item.quantity} - ${formatLKR(item.price * item.quantity)}\n`;
        });
        message += `\nSubtotal: ${formatLKR(parseFloat(subTotalAmountSpan.textContent.replace('LKR\xa0', '').replace(',', '')))}`;
        const discountVal = parseFloat(discountInput.value) || 0;
        if (discountVal > 0) {
            message += `\nDiscount: ${formatLKR(discountVal)}`;
        }
        message += `\nTotal: ${formatLKR(parseFloat(totalAmountSpan.textContent.replace('LKR\xa0', '').replace(',', '')))}`;
        const cashPaidVal = parseFloat(cashPaidInput.value) || 0;
        if (cashPaidVal > 0) {
            message += `\nCash Paid: ${formatLKR(cashPaidVal)}`;
        }
        const loanAmountVal = parseFloat(loanAmountInput.value);
        if (loanAmountVal > 0) {
            message += `\nLoan Amount: ${formatLKR(loanAmountVal)}`;
            if (loanNoteTextarea.value.trim()) {
                message += ` (Note: ${loanNoteTextarea.value.trim()})`;
            }
        }

        const whatsappNumber = customerData.phone.startsWith('0') ? '+94' + customerData.phone.substring(1) : '+94' + customerData.phone; // Sri Lankan number format
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    });

    newBillBtn.addEventListener('click', confirmNewBill);

    function confirmNewBill() {
        if (cart.length > 0) {
            confirmModal.classList.remove('hidden');
            document.getElementById('confirmMessage').textContent = 'Are you sure you want to start a new bill? Unsaved changes will be lost.';
            document.getElementById('confirmProceed').onclick = () => {
                newBill();
                confirmModal.classList.add('hidden');
            };
            document.getElementById('cancelConfirm').onclick = () => {
                confirmModal.classList.add('hidden');
            };
            document.getElementById('closeConfirmModal').onclick = () => {
                confirmModal.classList.add('hidden');
            };
        } else {
            newBill();
        }
    }

    function newBill() {
        cart = [];
        customerData = null;
        selectedCustomerId = null;
        customerPhoneInput.value = '';
        customerNameInput.value = '';
        pendingLoanInfoDiv.innerHTML = '';
        productSearchInput.value = '';
        searchResultsList.classList.add('hidden');
        discountInput.value = '0';
        cashPaidInput.value = '0';
        loanAmountInput.value = '0';
        loanNoteTextarea.value = '';
        invoiceNumber = 'INV-' + Date.now();
        invoiceNumberSpan.textContent = invoiceNumber;
        renderCartItems();
        calculateTotals();
        showAlert('New bill started', 'info');
    }

    function showLoader() {
        pageLoader.classList.remove('hidden');
    }

    function hideLoader() {
        setTimeout(() => {
            pageLoader.classList.add('hidden');
        }, 300); // Small delay for smoother transition
    }
});
}

// Example usage:
// let now = new Date();
// let weekAgo = new Date();
// weekAgo.setDate(now.getDate() - 7);
// generateReport(weekAgo, now);
