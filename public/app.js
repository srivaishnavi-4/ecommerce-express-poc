const authScreen = document.getElementById("authScreen");
const storeScreen = document.getElementById("storeScreen");
const productDialog = document.getElementById("productDialog");
const productContainer = document.getElementById("products");
const productCount = document.getElementById("productCount");
const catalogMessage = document.getElementById("catalogMessage");
const categoryFilter = document.getElementById("categoryFilter");
let token = localStorage.getItem("ecommerceToken") || "";
let products = [];
let currentUser = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(path, options);
    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const error = new Error(data.message || data.errors?.join(", ") || "Something went wrong");
        error.status = response.status;
        throw error;
    }

    return data;
}

function setAuthView(viewId) {
    document.querySelectorAll(".auth-view").forEach((view) => {
        view.hidden = view.id !== viewId;
    });
    document.getElementById("loginMessage").textContent = "";
    document.getElementById("registerMessage").textContent = "";
}

function showAuth(message = "") {
    token = "";
    currentUser = null;
    localStorage.removeItem("ecommerceToken");
    storeScreen.hidden = true;
    authScreen.hidden = false;
    productDialog.close();
    setAuthView("loginView");
    document.getElementById("loginMessage").textContent = message;
}

function showStore(user) {
    currentUser = user;
    authScreen.hidden = true;
    storeScreen.hidden = false;
    document.getElementById("accountName").textContent = user.name;
    document.getElementById("accountRole").textContent = user.role === "admin" ? "Admin" : "Member";
    document.getElementById("openProductDialog").hidden = user.role !== "admin";
    loadProducts();
}

async function restoreSession() {
    if (!token) return;

    try {
        const data = await apiRequest("/api/auth/profile", {
            headers: { Authorization: `Bearer ${token}` }
        });
        showStore(data.user);
    } catch {
        showAuth("Your session has ended. Please sign in again.");
    }
}

async function loadProducts() {
    productCount.textContent = "Loading collection...";
    catalogMessage.textContent = "";
    productContainer.replaceChildren();

    try {
        const data = await apiRequest("/api/products");
        products = data.products;
        updateCategoryOptions();
        renderProducts();
    } catch (error) {
        productCount.textContent = "Collection unavailable";
        catalogMessage.textContent = error.message;
    }
}

function updateCategoryOptions() {
    const selectedCategory = categoryFilter.value;
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second));

    categoryFilter.replaceChildren(new Option("All categories", "all"));
    categories.forEach((category) => categoryFilter.add(new Option(category, category)));
    categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "all";
}

function renderProducts() {
    const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;
    const visibleProducts = products.filter((product) => {
        const searchableText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
        return searchableText.includes(searchTerm)
            && (selectedCategory === "all" || product.category === selectedCategory);
    });

    productCount.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "product" : "products"}`;
    productContainer.replaceChildren();

    if (visibleProducts.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        const title = document.createElement("strong");
        title.textContent = products.length === 0 ? "Your collection starts here." : "No products match that search.";
        const detail = document.createElement("span");
        detail.textContent = products.length === 0
            ? "Add a product to give your catalog its first entry."
            : "Try another name or category.";
        emptyState.append(title, detail);
        productContainer.append(emptyState);
        return;
    }

    visibleProducts.forEach((product, index) => {
        productContainer.append(createProductCard(product, index));
    });
}

function createProductCard(product, index) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${Math.min(index * 45, 270)}ms`;

    const media = document.createElement("div");
    media.className = "product-media";
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = (product.name || "?").trim().charAt(0).toUpperCase();
    media.append(fallback);

    if (product.image && isSafeImageUrl(product.image)) {
        const image = document.createElement("img");
        image.className = "product-image";
        image.src = product.image;
        image.alt = product.name;
        image.loading = "lazy";
        image.addEventListener("error", () => image.remove());
        media.append(image);
    }

    const category = document.createElement("span");
    category.className = "category-tag";
    category.textContent = product.category || "Uncategorized";
    media.append(category);

    const info = document.createElement("div");
    info.className = "product-info";
    const titleRow = document.createElement("div");
    titleRow.className = "product-title-row";
    const title = document.createElement("h2");
    title.className = "product-title";
    title.textContent = product.name;
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);
    titleRow.append(title, price);

    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = product.description;

    const footer = document.createElement("div");
    footer.className = "product-foot";
    const stock = Number(product.stock) || 0;
    const stockLabel = document.createElement("span");
    stockLabel.className = "stock-label";
    const stockDot = document.createElement("span");
    stockDot.className = `stock-dot${stock === 0 ? " out" : stock <= 5 ? " low" : ""}`;
    const stockText = document.createElement("span");
    stockText.textContent = stock === 0 ? "Out of stock" : `${stock} in stock`;
    stockLabel.append(stockDot, stockText);
    const inventoryLabel = document.createElement("span");
    inventoryLabel.textContent = "Inventory";
    footer.append(stockLabel, inventoryLabel);

    if (currentUser?.role === "admin" && stock === 0) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "button button-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete out-of-stock product ${product.name}`);
        deleteButton.addEventListener("click", () => deleteProduct(product, deleteButton));
        footer.append(deleteButton);
    }

    info.append(titleRow, description, footer);
    card.append(media, info);
    return card;
}

async function deleteProduct(product, button) {
    if (!window.confirm(`Delete ${product.name}? This product is out of stock.`)) return;

    button.disabled = true;
    catalogMessage.textContent = "";
    catalogMessage.classList.remove("success");

    try {
        await apiRequest(`/api/products/${encodeURIComponent(product._id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        products = products.filter((item) => item._id !== product._id);
        updateCategoryOptions();
        renderProducts();
        catalogMessage.textContent = "Out-of-stock product deleted.";
        catalogMessage.classList.add("success");
    } catch (error) {
        if (error.status === 401) {
            showAuth("Your session has ended. Please sign in again.");
            return;
        }
        catalogMessage.textContent = error.message;
    } finally {
        if (button.isConnected) button.disabled = false;
    }
}

function isSafeImageUrl(value) {
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function formatPrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const message = document.getElementById("loginMessage");
    const fields = new FormData(form);
    button.disabled = true;
    message.textContent = "";

    try {
        const data = await apiRequest("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(fields))
        });
        token = data.token;
        localStorage.setItem("ecommerceToken", token);
        showStore(data.user);
    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

async function register(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const message = document.getElementById("registerMessage");
    const fields = new FormData(form);
    button.disabled = true;
    message.textContent = "";

    try {
        const data = await apiRequest("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(fields))
        });
        document.getElementById("loginEmail").value = fields.get("email");
        document.getElementById("loginPassword").value = "";
        setAuthView("loginView");
        const loginMessage = document.getElementById("loginMessage");
        loginMessage.textContent = data.message || "Account created. Sign in to continue.";
        loginMessage.classList.add("success");
        form.reset();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

async function addProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const message = document.getElementById("productMessage");
    const fields = new FormData(form);
    const product = Object.fromEntries(fields);
    product.price = Number(product.price);
    product.stock = Number(product.stock);
    button.disabled = true;
    message.textContent = "";

    try {
        await apiRequest("/api/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(product)
        });
        form.reset();
        productDialog.close();
        await loadProducts();
        catalogMessage.textContent = "Product added to your collection.";
        catalogMessage.classList.add("success");
    } catch (error) {
        if (error.status === 401) {
            showAuth("Your session has ended. Please sign in again.");
            return;
        }
        message.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

document.getElementById("loginForm").addEventListener("submit", login);
document.getElementById("registerForm").addEventListener("submit", register);
document.getElementById("productForm").addEventListener("submit", addProduct);
document.getElementById("searchInput").addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
document.getElementById("refreshButton").addEventListener("click", loadProducts);
document.getElementById("logoutButton").addEventListener("click", () => showAuth());
document.getElementById("openProductDialog").addEventListener("click", () => {
    document.getElementById("productMessage").textContent = "";
    productDialog.showModal();
});
document.getElementById("closeProductDialog").addEventListener("click", () => productDialog.close());
document.getElementById("cancelProductDialog").addEventListener("click", () => productDialog.close());
productDialog.addEventListener("click", (event) => {
    if (event.target === productDialog) productDialog.close();
});
document.querySelectorAll("[data-show-view]").forEach((button) => {
    button.addEventListener("click", () => setAuthView(button.dataset.showView));
});

restoreSession();
