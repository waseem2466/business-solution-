// This file is loaded by loan.html
// Correct imports for Realtime Database modular SDK
import { ref, query as dbQuery, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// This function is now exported to be used by other scripts
// It accepts loansRef, paymentsRef, and loanListDiv as arguments
async function loadLoansForCustomer(customerPhone, loansRef, paymentsRef, loanListDiv) {
  if (!customerPhone) {
    loanListDiv.innerHTML = "<p class='text-gray-500 text-center py-4'>Please search for a customer to view loans.</p>";
    return;
  }
  loanListDiv.innerHTML = "<p>Loading loans...</p>";

  try {
    // Query loans by customerPhone in Realtime Database using dbQuery and get
    const loansSnapshot = await get(dbQuery(loansRef, orderByChild("customerPhone"), equalTo(customerPhone)));
    loanListDiv.innerHTML = "";

    if (!loansSnapshot.exists()) {
      loanListDiv.innerHTML = "<p class='text-gray-500 text-center py-4'>No loans found for this customer.</p>";
    } else {
      const loans = loansSnapshot.val();
      
      // Iterate through loans and create a card for each
      for (const [loanId, loan] of Object.entries(loans)) {
        // Ensure paidAmount and balance are numbers, default to 0 if undefined/null
        loan.paidAmount = Number(loan.paidAmount) || 0;
        loan.balance = Number(loan.balance) || loan.totalAmount;

        // Fetch payments for this specific loan using dbQuery and get
        const paymentsSnapshot = await get(dbQuery(paymentsRef, orderByChild("loanId"), equalTo(loanId)));
        const payments = paymentsSnapshot.exists() ? Object.values(paymentsSnapshot.val()) : [];

        const div = document.createElement("div");
        div.className = "loan-card"; // Apply existing loan-card styles

        let productsList = "";
        loan.products.forEach(p => {
          productsList += `<li>${p.name} x${p.qty} @ Rs.${p.price.toFixed(2)} each</li>`;
        });

        let paymentsList = payments.length ? "<ul>" + payments.map(pay => `<li>Rs. ${pay.amount.toFixed(2)} on ${new Date(pay.date).toLocaleDateString()} (${pay.note || 'No note'})</li>`).join("") + "</ul>" : "<p>No payments made yet.</p>";

        div.innerHTML = `
          <div class="loan-header">
            <span class="loan-id">Loan #${loanId.substring(0, 8)}</span>
            <div class="status-badge-container">
                <span class="loan-status-badge ${loan.balance <= 0 ? 'paid' : ''}">
                    ${loan.balance <= 0 ? 'PAID' : 'PENDING'}
                </span>
            </div>
          </div>
          <p><strong>Date:</strong> ${new Date(loan.loanDate).toLocaleDateString()}</p>
          <div class="loan-details">
            <p><strong>Products:</strong></p>
            <ul>${productsList}</ul>
          </div>
          <div class="loan-summary">
            <p><strong>Total Amount:</strong> Rs. ${loan.totalAmount.toFixed(2)}</p>
            <p><strong>Paid Amount:</strong> <span class="loan-paid">Rs. ${loan.paidAmount.toFixed(2)}</span></p>
            <p><strong>Balance:</strong> <span class="loan-balance ${loan.balance <= 0 ? 'text-green-500' : 'text-red-500'}">Rs. ${loan.balance.toFixed(2)}</span></p>
          </div>
          <div class="payments-section">
            <button class="toggle-payments-btn btn btn-sm btn-secondary-custom">View Payments</button>
            <div class="payments-list" style="display: none;">
              <h5>Payment History</h5>
              ${paymentsList}
            </div>
          </div>
          <div class="loan-actions">
            <button class="btn btn-sm btn-primary-custom add-payment-btn" data-loan-id="${loanId}" ${loan.balance <= 0 ? 'disabled' : ''}>Add Payment</button>
          </div>
        `;
        loanListDiv.appendChild(div);
      }

      // Add event listeners for new payment buttons
      loanListDiv.querySelectorAll('.add-payment-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const loanId = e.target.dataset.loanId;
          // This logic will be handled by the parent loan.html script to show the modal
        });
      });

      // Add event listeners for toggling payment history visibility
      loanListDiv.querySelectorAll('.toggle-payments-btn').forEach(button => {
        button.addEventListener('click', () => {
          const paymentsList = button.nextElementSibling;
          paymentsList.style.display = paymentsList.style.display === 'none' ? 'block' : 'none';
          button.textContent = paymentsList.style.display === 'none' ? 'View Payments' : 'Hide Payments';
        });
      });

    }
  } catch (error) {
    console.error("Error fetching loans:", error);
    loanListDiv.innerHTML = '<p class="text-danger text-center py-4">Failed to load loans.</p>';
  }
}

// Make sure this function is exported so it can be used by loan.html
export { loadLoansForCustomer };
