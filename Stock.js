// Loader element
const pageLoader = document.getElementById("page-loader");

// Sign in
async function initAuth() {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously");
        }
        pageLoader.classList.add("hidden"); // hide loader after auth success
    } catch (err) {
        console.error("Auth error:", err);
        showAlert("Authentication failed", "error");
    }
}

// Utility: Show alerts
function showAlert(message, type = "info") {
    const container = document.getElementById("alert-container");
    const alert = document.createElement("div");
    alert.className = `custom-alert ${type} show`;
    alert.textContent = message;
    container.appendChild(alert);

    setTimeout(() => {
        alert.classList.add("animate-fade-out-down");
        setTimeout(() => alert.remove(), 300);
    }, 3000);
}

// Render products
function renderProducts(products) {
    productListDiv.innerHTML = "";
    if (products.length === 0) {
        productListDiv.innerHTML = `<p class="text-gray-500 text-center py-4">No products found.</p>`;
        return;
    }

    products.forEach(prod => {
        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
            <h3>${prod.name}</h3>
            <p>Code: ${prod.code || "-"}</p>
            <p>Price: Rs ${prod.price}</p>
            <p class="stock-qty ${prod.qty <= prod.lowStock ? "stock-low" : ""}">
                Stock: ${prod.qty}
            </p>
            <div class="actions">
                <button class="btn btn-secondary btn-sm edit-btn">Edit</button>
                <button class="btn btn-danger btn-sm delete-btn">Delete</button>
            </div>
        `;

        // Edit
        card.querySelector(".edit-btn").addEventListener("click", () => {
            productModalTitle.textContent = "Edit Product";
            productIdInput.value = prod.id;
            productNameInput.value = prod.name;
            productCodeInput.value = prod.code || "";
            productQtyInput.value = prod.qty;
            productPriceInput.value = prod.price;
            productCostPriceInput.value = prod.costPrice || "";
            lowStockThresholdInput.value = prod.lowStock || 5;
            addProductModal.classList.add("show");
        });

        // Delete
        card.querySelector(".delete-btn").addEventListener("click", () => {
            confirmMessage.textContent = `Are you sure you want to delete "${prod.name}"?`;
            confirmModal.classList.add("show");
            confirmDeleteBtn.onclick = async () => {
                await deleteDoc(doc(db, productsCollectionPath, prod.id));
                showAlert("Product deleted", "success");
                confirmModal.classList.remove("show");
            };
        });

        productListDiv.appendChild(card);
    });
}

// Listen to Firestore updates
function listenProducts() {
    const q = collection(db, productsCollectionPath);
    onSnapshot(q, snapshot => {
        const products = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));
        renderProducts(products);
    });
}

// Save product
addProductForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = {
        name: productNameInput.value,
        code: productCodeInput.value,
        qty: parseInt(productQtyInput.value),
        price: parseFloat(productPriceInput.value),
        costPrice: productCostPriceInput.value ? parseFloat(productCostPriceInput.value) : null,
        lowStock: parseInt(lowStockThresholdInput.value)
    };

    try {
        if (productIdInput.value) {
            await updateDoc(doc(db, productsCollectionPath, productIdInput.value), data);
            showAlert("Product updated", "success");
        } else {
            await addDoc(collection(db, productsCollectionPath), data);
            showAlert("Product added", "success");
        }
        addProductModal.classList.remove("show");
        addProductForm.reset();
    } catch (err) {
        console.error("Error saving product:", err);
        showAlert("Error saving product", "error");
    }
});

// Modal handling
addProductBtn.addEventListener("click", () => {
    productModalTitle.textContent = "Add New Product";
    productIdInput.value = "";
    addProductForm.reset();
    addProductModal.classList.add("show");
});
closeAddModalBtn.addEventListener("click", () => addProductModal.classList.remove("show"));
closeConfirmModalBtn.addEventListener("click", () => confirmModal.classList.remove("show"));
cancelConfirmBtn.addEventListener("click", () => confirmModal.classList.remove("show"));

// Search
productSearchInput.addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll(".product-card");
    cards.forEach(card => {
        const name = card.querySelector("h3").textContent.toLowerCase();
        const code = card.querySelector("p").textContent.toLowerCase();
        card.style.display = name.includes(term) || code.includes(term) ? "block" : "none";
    });
});

// Init
initAuth().then(listenProducts);
