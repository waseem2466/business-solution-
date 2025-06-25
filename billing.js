<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WR Smile - Billing</title>

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">

  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- jsPDF for PDF generation -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

  <!-- Firebase v9 SDK -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import {
      getFirestore,
      collection,
      query,
      where,
      getDocs,
      doc,
      getDoc,
      addDoc,
      updateDoc,
      onSnapshot
    } from "https://www.gstatic.com firebasejs/10.12.2/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "AIzaSyACehOi7n-dbdN00D4tJr2kD_-AVR6S-Vo",
      authDomain: "wr-smile-shop.firebaseapp.com",
      databaseURL: "https://wr-smile-shop.firebaseio.com",
      projectId: "wr-smile-shop",
      storageBucket: "wr-smile-shop.appspot.com",
      messagingSenderId: "299864260187",
      appId: "1:299864260187:web:fa6af65ef95674aff1097e"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    let cart = [];
    let allProducts = [];
    let invoiceNumber = 'INV-' + Date.now();

    // DOM Elements
    const pageLoader = document.getElementById("page-loader");
    const customerPhoneInput = document.getElementById('customer-phone');
    const customerNameInput = document.getElementById('customer-name');
    const pendingLoanInfoDiv = document.getElementById('pending-loan-info');
    const productSearchInput = document.getElementById('product-search');
    const searchResultsList = document.getElementById('search-results');
    const cartItemsDiv = document.getElementById('cart-items');
    const subTotalAmountSpan = document.getElementById('sub-total-amount');
    const discountInput = document.getElementById('discount');
    const totalAmountSpan = document.getElementById('total-amount');
    const cashPaidInput = document.getElementById('cash-paid');
    const loanAmountInput = document.getElementById('loan-amount');
    const loanNoteTextarea = document.getElementById('loan-note');
    const invoiceNumberSpan = document.getElementById('invoice-number');

    const saveBillBtn = document.getElementById('save-bill-btn');
    const printBillBtn = document.getElementById('print-bill-btn');
    const whatsappBillBtn = document.getElementById('whatsapp-bill-btn');
    const newBillBtn = document.getElementById('new-bill-btn');
    const confirmModal = document.getElementById('confirmModal');

    // Load All Products
    async function loadAllProducts() {
      try {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        allProducts = [];
        snapshot.forEach(doc => {
          allProducts.push({ id: doc.id, ...doc.data() });
        });
        console.log("Loaded", allProducts.length, "products");
      } catch (error) {
        console.error("Error loading products:", error);
        showMessage("Failed to load products.", "error");
      }
    }

    // Customer Search
    async function searchCustomer() {
      const phone = customerPhoneInput.value.trim();
      if (!phone) return;

      try {
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("phone", "==", phone));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          selectedCustomerId = snapshot.docs[0].id;
          customerNameInput.value = data.name;
          showMessage("Customer found!", "success");

          // Load Pending Loans
          const loansRef = collection(db, "loans");
          const lq = query(loansRef, where("customerId", "==", selectedCustomerId), where("balance", ">", 0));
          const loansSnap = await getDocs(lq);
          let pending = 0;
          loansSnap.forEach(child => {
            pending += child.data().balance || 0;
          });

          pendingLoanInfoDiv.textContent = pending > 0 ? `Pending Loan: Rs. ${pending.toFixed(2)}` : "No pending loan.";
        } else {
          const confirmed = await showConfirmModal("Customer not found. Add now?");
          if (confirmed) {
            const name = prompt("Enter customer name:");
            if (!name) return;

            const docRef = await addDoc(collection(db, "customers"), {
              name,
              phone
            });
            customerNameInput.value = name;
            showMessage("Customer added successfully!", "success");
          }
        }
      } catch (err) {
        console.error("Error searching customer:", err);
        showMessage("Customer search failed.", "error");
      }
    }

    // Product Search Suggestions
    function handleProductSearch() {
      const query = productSearchInput.value.toLowerCase();
      searchResultsList.innerHTML = "";

      if (!query) {
        searchResultsList.classList.add("hidden");
        return;
      }

      const results = allProducts.filter(p => p.name?.toLowerCase().includes(query));
      if (results.length === 0) {
        const noItem = document.createElement("li");
        noItem.className = "list-group-item text-muted";
        noItem.textContent = "No products found";
        searchResultsList.appendChild(noItem);
        searchResultsList.classList.remove("hidden");
        return;
      }

      results.slice(0, 5).forEach(product => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.textContent = `${product.name} - Rs.${product.price} | Stock: ${product.stock}`;
        li.onclick = () => addToCart(product);
        searchResultsList.appendChild(li);
      });

      searchResultsList.classList.remove("hidden");
    }

    // Add to Cart
    function addToCart(product) {
      const existing = cart.find(i => i.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          alert(`Only ${product.stock} left.`);
          return;
        }
        existing.qty++;
      } else {
        cart.push({ ...product, qty: 1 });
      }
      renderCart();
      updateCart();
      productSearchInput.value = "";
      searchResultsList.classList.add("hidden");
    }

    // Render Cart Items
    function renderCart() {
      cartItemsDiv.innerHTML = "";
      if (cart.length === 0) {
        cartItemsDiv.innerHTML = "<p>No items in cart.</p>";
        return;
      }

      cart.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
          <div class="cart-item-details">${item.name}</div>
          <div class="cart-item-actions">
            <input type="number" value="${item.qty}" min="1" onchange="updateQty(${index}, this.value)">
            <button onclick="removeFromCart(${index})" class="btn btn-sm btn-danger">x</button>
          </div>
        `;
        cartItemsDiv.appendChild(div);
      });
    }

    function updateQty(index, newQty) {
      const item = cart[index];
      const stock = item.stock;
      const qty = parseInt(newQty);
      if (qty <= 0 || qty > stock) {
        alert(`Invalid quantity or out of stock`);
        return;
      }
      cart[index].qty = qty;
      updateCart();
    }

    function removeFromCart(index) {
      cart.splice(index, 1);
      renderCart();
      updateCart();
    }

    // Update Total
    function updateCart() {
      let subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      subTotalAmountSpan.textContent = subTotal.toFixed(2);
      let discount = parseFloat(discountInput.value) || 0;
      let total = subTotal - discount;
      totalAmountSpan.textContent = total.toFixed(2);
    }

    // Save Bill
    async function saveBill() {
      const customerName = customerNameInput.value;
      const customerPhone = customerPhoneInput.value;
      const discount = parseFloat(discountInput.value) || 0;
      const cashPaid = parseFloat(cashPaidInput.value) || 0;
      const total = parseFloat(totalAmountSpan.textContent);
      const loanAmount = total - cashPaid;

      if (!customerName || !customerPhone || cart.length === 0) {
        showMessage("Please fill customer info and cart.", "error");
        return;
      }

      const billData = {
        invoiceNumber,
        customerName,
        customerPhone,
        products: cart.map(item => ({
          name: item.name,
          price: item.price,
          qty: item.qty
        })),
        discount,
        totalAmount: total,
        paidAmount: cashPaid,
        balance: loanAmount,
        date: new Date().toISOString()
      };

      if (loanAmount > 0) {
        await addDoc(collection(db, "loans"), billData);
        alert("✅ Loan saved!");
      } else {
        await addDoc(collection(db, "sales"), billData);
        alert("✅ Sale saved!");
      }

      location.reload();
    }

    // Print Bill as PDF
    function printBill() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(14);
      doc.text("WR Smile & Supplies", 105, y, null, null, "center"); y += 10;
      doc.setFontSize(12);
      doc.text("411/7, Kandy Road, Mollipothana", 105, y, null, null, "center"); y += 10;
      doc.text("Tel: 076-495-0844", 105, y, null, null, "center"); y += 10;
      doc.line(10, y, 200, y); y += 10;

      doc.text("🧾 Invoice: " + invoiceNumber, 10, y); y += 10;
      doc.text("Customer: " + customerNameInput.value, 10, y); y += 10;
      doc.text("Phone: " + customerPhoneInput.value, 10, y); y += 10;

      doc.setFont("helvetica", "bold");
      doc.text("Items:", 10, y); y += 5;
      doc.line(10, y, 200, y); y += 10;

      cart.forEach(item => {
        doc.text(`${item.name} x${item.qty} = Rs.${(item.qty * item.price).toFixed(2)}`, 10, y);
        y += 10;
      });

      y += 10;
      doc.text(`Subtotal: Rs.${subTotalAmountSpan.textContent}`, 10, y); y += 10;
      doc.text(`Discount: Rs.${discountInput.value}`, 10, y); y += 10;
      doc.text(`Total: Rs.${totalAmountSpan.textContent}`, 10, y); y += 10;
      doc.text(`Cash Paid: Rs.${cashPaidInput.value}`, 10, y); y += 10;
      doc.text(`Balance: Rs.${loanAmountInput.value}`, 10, y); y += 10;

      doc.save("bill.pdf");
    }

    // Send via WhatsApp
    function sendWhatsAppBill() {
      const phone = customerPhoneInput.value;
      let msg = "*WR Smile & Supplies*\n";
      msg += `Invoice: ${invoiceNumber}\n`;
      msg += `Customer: ${customerNameInput.value}\n\n`;
      msg += `*Items:*%0A`;

      cart.forEach(item => {
        msg += `• ${item.name} x${item.qty} = Rs.${(item.qty * item.price).toFixed(2)}%0A`;
      });

      msg += `%0ADiscount: Rs.${discountInput.value}%0A`;
      msg += `Total: Rs.${totalAmountSpan.textContent}%0A`;
      msg += `Cash Paid: Rs.${cashPaidInput.value}%0A`;
      msg += `Balance: Rs.${loanAmountInput.value}%0A`;
      msg += `Thank you for shopping with us!`;

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    }

    // Show Messages
    function showMessage(message, type = "info") {
      const container = document.getElementById("alert-container");
      const div = document.createElement("div");
      div.className = `alert-message ${type}`;
      div.textContent = message;
      container.appendChild(div);

      setTimeout(() => div.classList.add("show"), 100);
      setTimeout(() => {
        div.classList.remove("show");
        div.remove();
      }, 3000);
    }

    // Confirm Modal
    function showConfirmModal(message) {
      return new Promise(resolve => {
        const modal = document.getElementById("confirmModal");
        const messageEl = modal.querySelector("#confirmMessage"); 
        const confirmBtn = modal.querySelector("#confirmDelete");
        const cancelBtn = modal.querySelector("#cancelConfirm");

        messageEl.textContent = message;
        showModal(modal);

        const handleConfirm = () => {
          resolve(true);
          hideModal(modal);
          confirmBtn.removeEventListener("click", handleConfirm);
          cancelBtn.removeEventListener("click", handleCancel);
        };

        const handleCancel = () => {
          resolve(false);
          hideModal(modal);
          confirmBtn.removeEventListener("click", handleConfirm);
          cancelBtn.removeEventListener("click", handleCancel);
        };

        confirmBtn.addEventListener("click", handleConfirm);
        cancelBtn.addEventListener("click", handleCancel);
      });
    }

    function showModal(modal) {
      modal.classList.remove("hidden");
      void modal.offsetWidth;
      const content = modal.querySelector(".modal-custom-content");
      content.style.transform = "translateY(-20px)";
      content.style.opacity = "0";
      setTimeout(() => {
        content.style.transform = "translateY(0)";
        content.style.opacity = "1";
      }, 100);
    }

    function hideModal(modal) {
      const content = modal.querySelector(".modal-custom-content");
      content.style.transform = "translateY(-20px)";
      content.style.opacity = "0";
      setTimeout(() => {
        modal.classList.add("hidden");
      }, 300);
    }

    // Event Listeners
    document.getElementById("search-customer-btn").addEventListener("click", searchCustomer);
    document.getElementById("customer-phone").addEventListener("keypress", e => {
      if (e.key === "Enter") searchCustomer();
    });

    document.getElementById("product-search").addEventListener("input", handleProductSearch);
    document.getElementById("product-search").addEventListener("focus", handleProductSearch);
    document.getElementById("product-search").addEventListener("blur", () => {
      setTimeout(() => searchResultsList.classList.add("hidden"), 200);
    });

    document.getElementById("save-bill-btn").addEventListener("click", saveBill);
    document.getElementById("print-bill-btn").addEventListener("click", printBill);
    document.getElementById("whatsapp-bill-btn").addEventListener("click", sendWhatsAppBill);
    document.getElementById("new-bill-btn").addEventListener("click", () => {
      if (confirm("Start new bill?")) startNewBill();
    });

    // Start New Bill
    function startNewBill() {
      cart = [];
      customerPhoneInput.value = "";
      customerNameInput.value = "";
      discountInput.value = "0";
      cashPaidInput.value = "0";
      loanAmountInput.value = "0";
      loanNoteTextarea.value = "";
      invoiceNumber = 'INV-' + Date.now();
      invoiceNumberSpan.textContent = invoiceNumber;
      renderCart();
      updateCart();
    }

    // Load products when page loads
    document.addEventListener("DOMContentLoaded", async () => {
      await loadAllProducts();
      document.getElementById("page-loader").classList.add("hidden");
      renderCart();
      updateCart();
    });
  </script>
</head>
<body>

<!-- Loader -->
<div id="page-loader" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; display: flex; align-items: center; justify-content: center;">
  <div class="spinner-border text-primary" role="status">Loading...</div>
</div>

<!-- Back Button -->
<a href="index.html" class="back-button">
  ← Back to Dashboard
</a>

<!-- Main Container -->
<div class="main-container">
  <div class="left-panel">
    <div class="section-box">
      <h3 class="section-title">Customer Information</h3>
      <div class="form-group">
        <label class="form-label">Customer Phone</label>
        <input type="text" id="customer-phone" class="form-input" placeholder="Enter phone number" />
        <button id="search-customer-btn" class="btn-primary-custom mt-2 w-100">🔍 Search Customer</button>
      </div>
      <div class="form-group">
        <label class="form-label">Customer Name</label>
        <input type="text" id="customer-name" class="form-input" readonly />
      </div>
      <div id="pending-loan-info" class="text-sm text-gray-600 mt-2"></div>
    </div>

    <div class="section-box">
      <h3 class="section-title">Product Search</h3>
      <div class="form-group">
        <input type="text" id="product-search" class="form-input" placeholder="Search product by name..." />
        <ul id="search-results" class="search-results-list hidden"></ul>
      </div>
    </div>

    <div class="section-box">
      <h3 class="section-title">Shopping Cart</h3>
      <div id="cart-items"></div>
    </div>
  </div>

  <div class="right-panel">
    <div class="section-box">
      <h3 class="section-title">Bill Summary</h3>
      <p class="invoice-info">Invoice: <span id="invoice-number">INV-XXXX</span></p>
      <div class="cart-summary-line">
        <span>Subtotal:</span>
        <strong>Rs. <span id="sub-total-amount">0.00</span></strong>
      </div>
      <div class="form-group mt-2">
        <label class="form-label">Discount (Rs.)</label>
        <input type="number" id="discount" class="form-input" value="0" min="0" step="0.01" />
      </div>
      <div class="cart-summary-line total-amount-line">
        <span>Total:</span>
        <strong>Rs. <span id="total-amount">0.00</span></strong>
      </div>
    </div>

    <div class="section-box">
      <h3 class="section-title">Payment & Loan</h3>
      <div class="form-group">
        <label class="form-label">Cash Paid (Rs.)</label>
        <input type="number" id="cash-paid" class="form-input" value="0" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label">Loan Amount (Rs.)</label>
        <input type="number" id="loan-amount" class="form-input" value="0" readonly />
      </div>
      <div class="form-group">
        <label class="form-label">Loan Note</label>
        <textarea id="loan-note" class="form-input" rows="2" placeholder="e.g., 'Due next week'"></textarea>
      </div>
    </div>

    <div class="section-box text-center">
      <h3 class="section-title">Bill Actions</h3>
      <button class="btn-primary-custom w-full mb-3" id="save-bill-btn">✅ Save Bill</button>
      <button class="btn-secondary-custom w-full mb-3" id="print-bill-btn">🖨️ Print Bill</button>
      <button class="btn-secondary-custom w-full mb-3" id="whatsapp-bill-btn">📲 WhatsApp Bill</button>
      <button class="btn-danger-custom w-full" id="new-bill-btn">➕ New Bill</button>
    </div>
  </div>
</div>

<!-- Receipt Modal -->
<div class="modal fade" id="receiptModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-body" id="receipt-content">
        <div class="text-center mb-3">
          <h4>WR Smile and Supplies</h4>
          <p>411/7, Kandy Road, Mollipothana</p>
          <p>Tel: 076-495-0844</p>
          <hr>
        </div>
        <div id="receipt-items"></div>
        <hr>
        <div class="d-flex justify-content-between">
          <strong>Date:</strong>
          <span id="receipt-date"></span>
        </div>
        <div class="d-flex justify-content-between">
          <strong>Total:</strong>
          <span id="receipt-total">Rs. 0</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="window.print()">Print</button>
      </div>
    </div>
  </div>
</div>

<!-- Custom Alert Container -->
<div id="alert-container"></div>

<!-- Confirmation Modal -->
<div id="confirmModal" class="modal-custom hidden">
  <div class="modal-custom-content">
    <h5 class="modal-custom-title">Confirm Action</h5>
    <p id="confirmMessage">Are you sure?</p>
    <div class="modal-custom-footer">
      <button class="btn-secondary-custom" id="cancelConfirm">Cancel</button>
      <button class="btn-danger-custom" id="confirmDelete">Proceed</button>
    </div>
  </div>
</div>

<!-- Firebase Setup -->
<script type="module">
  // Firebase initialization logic already included above
</script>

</body>
</html>