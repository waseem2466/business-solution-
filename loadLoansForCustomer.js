async function loadLoansForCustomer(customerId) {
  if (!customerId) {
    loanListDiv.innerHTML = "<p>Please select a customer to see loans.</p>";
    return;
  }
  loanListDiv.innerHTML = "<p>Loading loans...</p>";

  try {
    const loansSnapshot = await loansRef.orderByChild("customerId").equalTo(customerId).once("value");
    loanListDiv.innerHTML = "";

    if (!loansSnapshot.exists()) {
      loanListDiv.innerHTML = "<p>No loans found for this customer.</p>";
    } else {
      const loans = loansSnapshot.val();

      for (const [loanId, loan] of Object.entries(loans)) {
        // Ensure paidAmount and balance are numbers
        loan.paidAmount = Number(loan.paidAmount) || 0;
        loan.balance = Number(loan.balance) || loan.totalAmount;

        // Load payments
        const paymentsSnapshot = await paymentsRef.orderByChild("loanId").equalTo(loanId).once("value");
        const payments = paymentsSnapshot.exists() ? Object.values(paymentsSnapshot.val()) : [];

        const div = document.createElement("div");
        div.className = "loan-card";

        let productsList = "";
        loan.products.forEach(p => {
          productsList += `<li>${p.name} x${p.qty} @ Rs.${p.price.toFixed(2)} each</li>`;
        });

        let paymentsList = payments.length
          ? "<ul>" + payments.map(pay => `<li>Rs. ${pay.amount.toFixed(2)} on ${new Date(pay.paymentDate).toLocaleDateString()}</li>`).join('') + "</ul>"
          : "<p>No payments yet.</p>";

        div.innerHTML = `
          <h5>Loan ID: ${loanId}</h5>
          <ul>${productsList}</ul>
          <p><strong>Total Amount:</strong> Rs. ${loan.totalAmount.toFixed(2)}</p>
          <p><strong>Paid Amount:</strong> Rs. ${loan.paidAmount.toFixed(2)}</p>
          <p><strong>Balance:</strong> Rs. ${loan.balance.toFixed(2)}</p>
          <h6>Payments:</h6>
          ${paymentsList}
          <div class="btn-group">
            <button class="btn btn-primary btn-sm add-payment-btn" data-loan-id="${loanId}" ${loan.balance <= 0 ? 'disabled' : ''}>Add Payment</button>
            <button class="btn btn-secondary btn-sm ms-2" data-loan-id="${loanId}">Export PDF</button>
            <button class="btn btn-success btn-sm ms-2" data-loan-id="${loanId}">Send WhatsApp</button>
          </div>
        `;
        loanListDiv.appendChild(div);

        div.querySelector(".add-payment-btn").addEventListener("click", () => {
          selectedLoanId = loanId;
          selectedLoanData = loan;
          document.getElementById("payment-loan-info").textContent = `Loan ID: ${loanId} | Balance: Rs. ${loan.balance.toFixed(2)}`;
          document.getElementById("payment-amount").value = ""; // Clear input
          const paymentModal = new bootstrap.Modal(document.getElementById("paymentModal"));
          paymentModal.show();
        });

        div.querySelector(".btn-secondary").addEventListener("click", () => {
          exportPdf(loanId, loan, payments);
        });

        div.querySelector(".btn-success").addEventListener("click", () => {
          sendWhatsAppMessage(loanId, loan, payments);
        });
      }
    }

    // Add New Loan Form below loans
    addNewLoanForm(customerId);

  } catch (err) {
    console.error("Error loading loans:", err);
    loanListDiv.innerHTML = "<p>Error loading loans. Please try again later.</p>";
  }
}
<!-- Replace your add loan form with this -->
<div class="loan-card" id="new-loan-form">
  <h5>Add New Loan (Multiple Products)</h5>
  <form id="add-loan-form">
    <div id="products-container">
      <!-- Product row template -->
      <div class="row g-2 mb-2 product-row">
        <div class="col-md-4">
          <input type="text" class="form-control product-name" placeholder="Product Name" required>
        </div>
        <div class="col-md-2">
          <input type="number" class="form-control product-qty" placeholder="Qty" min="1" value="1" required>
        </div>
        <div class="col-md-3">
          <input type="number" class="form-control product-price" placeholder="Price" step="0.01" value="0" required>
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-danger remove-product">×</button>
        </div>
      </div>
    </div>

    <button type="button" class="btn btn-outline-primary mb-3" id="add-product-btn">+ Add Product</button>

    <div class="mb-3">
      <label for="discount" class="form-label">Discount (Rs.)</label>
      <input type="number" id="discount" class="form-control" min="0" step="0.01" value="0" />
    </div>
    <button type=function addNewLoanForm(customerId) {
  const existing = document.getElementById("new-loan-form");
  if (existing) existing.remove();

  const loanFormHTML = document.createElement("div");
  loanFormHTML.className = "loan-card";
  loanFormHTML.id = "new-loan-form";
  loanFormHTML.innerHTML = `<!-- (insert HTML code from STEP 1 above here) -->`;

  loanListDiv.appendChild(loanFormHTML);

  const productsContainer = loanFormHTML.querySelector("#products-container");
  const addProductBtn = loanFormHTML.querySelector("#add-product-btn");

  function createProductRow() {
    const row = document.createElement("div");
    row.className = "row g-2 mb-2 product-row";
    row.innerHTML = `
      <div class="col-md-4"><input type="text" class="form-control product-name" placeholder="Product Name" required></div>
      <div class="col-md-2"><input type="number" class="form-control product-qty" placeholder="Qty" min="1" value="1" required></div>
      <div class="col-md-3"><input type="number" class="form-control product-price" placeholder="Price" step="0.01" value="0" required></div>
      <div class="col-md-2"><button type="button" class="btn btn-danger remove-product">×</button></div>
    `;
    productsContainer.appendChild(row);

    row.querySelector(".remove-product").addEventListener("click", () => row.remove());
  }

  addProductBtn.addEventListener("click", () => createProductRow());

  // Start with one row
  createProductRow();

  loanFormHTML.querySelector("#add-loan-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const discount = parseFloat(document.getElementById("discount").value) || 0;

    const products = Array.from(productsContainer.querySelectorAll(".product-row")).map(row => {
      return {
        name: row.querySelector(".product-name").value.trim(),
        qty: parseInt(row.querySelector(".product-qty").value),
        price: parseFloat(row.querySelector(".product-price").value)
      };
    }).filter(p => p.name && p.qty > 0 && p.price >= 0);

    if (products.length === 0) {
      alert("Add at least one valid product.");
      return;
    }

    const total = products.reduce((sum, p) => sum + p.qty * p.price, 0);
    const totalAmount = total - discount;

    const loanData = {
      customerId,
      loanDate: new Date().toISOString(),
      products,
      discount,
      totalAmount,
      paidAmount: 0,
      balance: totalAmount
    };

    try {
      await loansRef.push(loanData);
      alert("Loan created!");
      loadLoansForCustomer(customerId);
    } catch (err) {
      console.error("Failed to save loan:", err);
      alert("Error saving loan.");
    }
  });
}
"submit" class="btn btn-success">Create Loan</button>
  </form>
</div>
function addNewLoanForm(customerId) {
  const existing = document.getElementById("new-loan-form");
  if (existing) existing.remove();

  const loanFormHTML = document.createElement("div");
  loanFormHTML.className = "loan-card";
  loanFormHTML.id = "new-loan-form";
  loanFormHTML.innerHTML = `<!-- (insert HTML code from STEP 1 above here) -->`;

  loanListDiv.appendChild(loanFormHTML);

  const productsContainer = loanFormHTML.querySelector("#products-container");
  const addProductBtn = loanFormHTML.querySelector("#add-product-btn");

  function createProductRow() {
    const row = document.createElement("div");
    row.className = "row g-2 mb-2 product-row";
    row.innerHTML = `
      <div class="col-md-4"><input type="text" class="form-control product-name" placeholder="Product Name" required></div>
      <div class="col-md-2"><input type="number" class="form-control product-qty" placeholder="Qty" min="1" value="1" required></div>
      <div class="col-md-3"><input type="number" class="form-control product-price" placeholder="Price" step="0.01" value="0" required></div>
      <div class="col-md-2"><button type="button" class="btn btn-danger remove-product">×</button></div>
    `;
    productsContainer.appendChild(row);

    row.querySelector(".remove-product").addEventListener("click", () => row.remove());
  }

  addProductBtn.addEventListener("click", () => createProductRow());

  // Start with one row
  createProductRow();

  loanFormHTML.querySelector("#add-loan-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const discount = parseFloat(document.getElementById("discount").value) || 0;

    const products = Array.from(productsContainer.querySelectorAll(".product-row")).map(row => {
      return {
        name: row.querySelector(".product-name").value.trim(),
        qty: parseInt(row.querySelector(".product-qty").value),
        price: parseFloat(row.querySelector(".product-price").value)
      };
    }).filter(p => p.name && p.qty > 0 && p.price >= 0);

    if (products.length === 0) {
      alert("Add at least one valid product.");
      return;
    }

    const total = products.reduce((sum, p) => sum + p.qty * p.price, 0);
    const totalAmount = total - discount;

    const loanData = {
      customerId,
      loanDate: new Date().toISOString(),
      products,
      discount,
      totalAmount,
      paidAmount: 0,
      balance: totalAmount
    };

    try {
      await loansRef.push(loanData);
      alert("Loan created!");
      loadLoansForCustomer(customerId);
    } catch (err) {
      console.error("Failed to save loan:", err);
      alert("Error saving loan.");
    }
  });
}
