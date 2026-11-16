import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ========================================
// FIREBASE AUTH PERSISTENCE
// ========================================

setPersistence(auth, browserLocalPersistence)
    .catch(function(error) {
        console.error("Persistence error:", error);
    });


// ========================================
// HELPER FUNCTIONS
// ========================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showMessage(message, type = "success") {
    let toastContainer = document.querySelector("#toastContainer");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toastContainer";
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `toast-card toast-${type}`;
    
    let icon = "✓";
    if (type === "error") icon = "✗";
    if (type === "info") icon = "ℹ";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHTML(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(function() {
        toast.classList.add("toast-show");
    }, 10);

    setTimeout(function() {
        toast.classList.remove("toast-show");
        setTimeout(function() {
            toast.remove();
        }, 400);
    }, 3500);
}


function showConfirm(message, title = "Confirm") {
    return new Promise(function(resolve) {
        let existingModal = document.querySelector("#customConfirmModal");
        if (existingModal) {
            existingModal.remove();
        }

        const modalOverlay = document.createElement("div");
        modalOverlay.id = "customConfirmModal";
        modalOverlay.className = "confirm-modal-overlay";

        modalOverlay.innerHTML = `
            <div class="confirm-modal-card">
                <div class="confirm-modal-icon">🌿</div>
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(message)}</p>
                <div class="confirm-modal-actions">
                    <button type="button" class="confirm-cancel-btn">Cancel</button>
                    <button type="button" class="confirm-ok-btn">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        setTimeout(function() {
            modalOverlay.classList.add("modal-show");
        }, 10);

        function closeModal(result) {
            modalOverlay.classList.remove("modal-show");
            setTimeout(function() {
                modalOverlay.remove();
                resolve(result);
            }, 250);
        }

        modalOverlay.querySelector(".confirm-cancel-btn").onclick = function() {
            closeModal(false);
        };

        modalOverlay.querySelector(".confirm-ok-btn").onclick = function() {
            closeModal(true);
        };

        modalOverlay.onclick = function(e) {
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        };
    });
}


function getPageName() {
    return window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();
}


// ========================================
// NAVBAR AUTH STATE
// ========================================

function updateNavbar(user) {

    const loginButtons =
        document.querySelectorAll(".login-btn");

    loginButtons.forEach(function(button) {

        if (user) {

            let displayName =
                user.displayName ||
                localStorage.getItem("userName") ||
                user.email.split("@")[0];

            button.textContent =
                "👤 " + displayName;

            button.href = "#";
            button.classList.add("logged-in-user");

            button.onclick = async function(event) {

                event.preventDefault();

                const shouldLogout =
                    await showConfirm("Do you want to logout?", "Sign Out");

                if (!shouldLogout) {
                    return;
                }

                signOut(auth)
                    .then(function() {

                        localStorage.removeItem("userName");

                        showMessage("Logged out successfully!", "success");

                        window.location.href = "index.html";

                    })
                    .catch(function(error) {

                        console.error(
                            "Logout error:",
                            error
                        );

                        showMessage(
                            "Logout failed. Please try again."
                        );

                    });
            };

        } else {

            button.textContent = "Login";

            button.href = "login.html";

            button.onclick = null;
            button.classList.remove("logged-in-user");

        }

    });


    // Fix navigation links
    const browseLinks =
        document.querySelectorAll(
            'nav a[href="#"]'
        );

    browseLinks.forEach(function(link) {

        const text =
            link.textContent.trim().toLowerCase();

        if (text.includes("browse")) {
            link.href = "browse.html";
        }

        if (text.includes("my reports")) {
            link.href = "my-reports.html";
        }

    });
}


// ========================================
// AUTH STATE LISTENER
// ========================================

onAuthStateChanged(auth, async function(user) {

    updateNavbar(user);

    if (user) {

        try {

            const userRef =
                doc(db, "users", user.uid);

            const userSnap =
                await getDoc(userRef);

            if (userSnap.exists()) {

                const userData =
                    userSnap.data();

                if (userData.name) {

                    localStorage.setItem(
                        "userName",
                        userData.name
                    );

                }

            }

        } catch (error) {

            console.error(
                "Profile fetch error:",
                error
            );

        }

    }

});


// ========================================
// SIGNUP
// ========================================

const signupForm =
    document.querySelector(".signup-form");

if (signupForm) {

    signupForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const name =
                document
                    .querySelector("#signupName")
                    .value
                    .trim();

            const email =
                document
                    .querySelector("#signupEmail")
                    .value
                    .trim();

            const phone =
                document
                    .querySelector("#signupPhone")
                    .value
                    .trim();

            const password =
                document
                    .querySelector("#signupPassword")
                    .value;

            const confirmPassword =
                document
                    .querySelector("#signupConfirmPassword")
                    .value;


            if (
                !name ||
                !email ||
                !password
            ) {

                showMessage(
                    "Please fill all required fields."
                );

                return;
            }


            if (password !== confirmPassword) {

                showMessage(
                    "Passwords do not match!"
                );

                return;
            }


            if (password.length < 6) {

                showMessage(
                    "Password must be at least 6 characters."
                );

                return;
            }


            const submitButton =
                signupForm.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent =
                    "Creating Account...";
            }


            try {

                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user =
                    userCredential.user;


                await setDoc(
                    doc(db, "users", user.uid),
                    {
                        name: name,
                        email: email,
                        phone: phone,
                        createdAt: serverTimestamp()
                    }
                );


                localStorage.setItem(
                    "userName",
                    name
                );


                showMessage(
                    "Account created successfully!"
                );


                window.location.href =
                    "index.html";


            } catch (error) {

                console.error(
                    "Signup error:",
                    error
                );


                if (
                    error.code ===
                    "auth/email-already-in-use"
                ) {

                    showMessage(
                        "An account with this email already exists."
                    );

                } else if (
                    error.code ===
                    "auth/invalid-email"
                ) {

                    showMessage(
                        "Please enter a valid email address."
                    );

                } else if (
                    error.code ===
                    "auth/weak-password"
                ) {

                    showMessage(
                        "Password should be at least 6 characters."
                    );

                } else {

                    showMessage(
                        "Signup failed: " +
                        error.message
                    );

                }


                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        "Create Account";
                }

            }

        }
    );

}


// ========================================
// LOGIN
// ========================================

const loginForm =
    document.querySelector(".login-form");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const email =
                document
                    .querySelector("#loginEmail")
                    .value
                    .trim();

            const password =
                document
                    .querySelector("#loginPassword")
                    .value;


            if (!email || !password) {

                showMessage(
                    "Please enter email and password."
                );

                return;
            }


            const submitButton =
                loginForm.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled = true;

                submitButton.textContent =
                    "Logging in...";

            }


            try {

                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;


                // Login successful.
                // Firebase keeps the login state.

                showMessage(
                    "Login successful!"
                );


                window.location.href =
                    "index.html";


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                if (
                    error.code ===
                    "auth/invalid-credential"
                ) {

                    showMessage(
                        "Invalid email or password."
                    );

                } else if (
                    error.code ===
                    "auth/user-not-found"
                ) {

                    showMessage(
                        "No account found with this email."
                    );

                } else if (
                    error.code ===
                    "auth/wrong-password"
                ) {

                    showMessage(
                        "Incorrect password."
                    );

                } else if (
                    error.code ===
                    "auth/too-many-requests"
                ) {

                    showMessage(
                        "Too many attempts. Please try again later."
                    );

                } else {

                    showMessage(
                        "Login failed: " +
                        error.message
                    );

                }


                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        "Login";

                }

            }

        }
    );

}


// ========================================
// GET CURRENT USER
// ========================================

function requireLogin() {

    return new Promise(function(resolve) {

        const unsubscribe =
            onAuthStateChanged(
                auth,
                function(user) {

                    unsubscribe();

                    resolve(user);

                }
            );

    });

}


// ========================================
// LOST ITEM REPORT
// ========================================

const lostForm =
    document.querySelector(".lost-form");

if (lostForm) {

    lostForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const user =
                await requireLogin();


            if (!user) {

                showMessage(
                    "Please login before submitting a lost report."
                );

                window.location.href =
                    "login.html";

                return;
            }


            const itemName =
                document
                    .querySelector("#itemName")
                    .value
                    .trim();

            const category =
                document
                    .querySelector("#category")
                    .value;

            const color =
                document
                    .querySelector("#color")
                    .value
                    .trim();

            const description =
                document
                    .querySelector("#description")
                    .value
                    .trim();

            const location =
                document
                    .querySelector("#location")
                    .value
                    .trim();

            const date =
                document
                    .querySelector("#date")
                    .value;

            const time =
                document
                    .querySelector("#time")
                    .value;

            const privateClue =
                document
                    .querySelector("#privateClue")
                    .value
                    .trim();

            const photoInput =
                document.querySelector("#photo");


            if (
                !itemName ||
                !category ||
                !description ||
                !location ||
                !date
            ) {

                showMessage(
                    "Please fill all required fields."
                );

                return;
            }


            const submitButton =
                lostForm.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled = true;

                submitButton.textContent =
                    "Submitting...";

            }


            try {

                await addDoc(
                    collection(db, "lostItems"),
                    {
                        type: "lost",

                        userId: user.uid,

                        itemName: itemName,

                        category: category,

                        color: color,

                        description: description,

                        location: location,

                        date: date,

                        time: time,

                        verificationClue:
                            privateClue,

                        photoName:
                            photoInput &&
                            photoInput.files.length > 0
                            ? photoInput.files[0].name
                            : "",

                        status: "Lost",

                        createdAt:
                            serverTimestamp()
                    }
                );


                showMessage(
                    "Lost item report submitted successfully!"
                );


                lostForm.reset();


                window.location.href =
                    "my-reports.html";


            } catch (error) {

                console.error(
                    "Lost report error:",
                    error
                );


                showMessage(
                    "Could not submit report.\n\n" +
                    error.message
                );


                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        "Submit Lost Report";

                }

            }

        }
    );

}


// ========================================
// FOUND ITEM REPORT
// ========================================

const foundForm =
    document.querySelector(".found-form");

if (foundForm) {

    foundForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const user =
                await requireLogin();


            if (!user) {

                showMessage(
                    "Please login before submitting a found report."
                );

                window.location.href =
                    "login.html";

                return;
            }


            const itemName =
                document
                    .querySelector("#itemName")
                    .value
                    .trim();

            const category =
                document
                    .querySelector("#category")
                    .value;

            const color =
                document
                    .querySelector("#color")
                    .value
                    .trim();

            const description =
                document
                    .querySelector("#description")
                    .value
                    .trim();

            const location =
                document
                    .querySelector("#location")
                    .value
                    .trim();

            const date =
                document
                    .querySelector("#date")
                    .value;

            const time =
                document
                    .querySelector("#time")
                    .value;

            const privateClue =
                document
                    .querySelector("#privateClue")
                    .value
                    .trim();

            const photoInput =
                document.querySelector("#photo");


            if (
                !itemName ||
                !category ||
                !description ||
                !location ||
                !date
            ) {

                showMessage(
                    "Please fill all required fields."
                );

                return;
            }


            const submitButton =
                foundForm.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled = true;

                submitButton.textContent =
                    "Submitting...";

            }


            try {

                await addDoc(
                    collection(db, "foundItems"),
                    {
                        type: "found",

                        userId: user.uid,

                        itemName: itemName,

                        category: category,

                        color: color,

                        description: description,

                        location: location,

                        date: date,

                        time: time,

                        verificationClue:
                            privateClue,

                        photoName:
                            photoInput &&
                            photoInput.files.length > 0
                            ? photoInput.files[0].name
                            : "",

                        status: "Found",

                        createdAt:
                            serverTimestamp()
                    }
                );


                showMessage(
                    "Found item report submitted successfully!"
                );


                foundForm.reset();


                window.location.href =
                    "my-reports.html";


            } catch (error) {

                console.error(
                    "Found report error:",
                    error
                );


                showMessage(
                    "Could not submit report.\n\n" +
                    error.message
                );


                if (submitButton) {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        "Submit Found Report";

                }

            }

        }
    );

}


// ========================================
// BROWSE ITEMS
// ========================================

const reportsList =
    document.querySelector("#reportsContainer") ||
    document.querySelector("#itemsContainer");

if (reportsList) {

    loadBrowseItems();

}


let allBrowseItems = [];

function setupBrowseFilters(items) {
    allBrowseItems = items;

    const searchInput = document.querySelector("#searchInput");
    const locationFilter = document.querySelector("#locationFilter");
    const typeFilter = document.querySelector("#typeFilter");
    const categoryFilter = document.querySelector("#categoryFilter");

    if (!searchInput && !locationFilter && !typeFilter && !categoryFilter) {
        return;
    }

    function applyFilters() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const locationTerm = locationFilter ? locationFilter.value.toLowerCase().trim() : "";
        const typeValue = typeFilter ? typeFilter.value.toLowerCase() : "all";
        const categoryValue = categoryFilter ? categoryFilter.value.toLowerCase() : "all";

        const filtered = allBrowseItems.filter(function(item) {
            // Type filter
            if (typeValue !== "all" && item.type !== typeValue) {
                return false;
            }

            // Category filter
            if (categoryValue !== "all" && normalizeText(item.category) !== normalizeText(categoryValue)) {
                return false;
            }

            // Location filter
            if (locationTerm && !normalizeText(item.location).includes(locationTerm)) {
                return false;
            }

            // Keyword search (Name, Description, Location, Color)
            if (searchTerm) {
                const combined = (
                    (item.itemName || "") + " " +
                    (item.description || "") + " " +
                    (item.location || "") + " " +
                    (item.color || "") + " " +
                    (item.category || "")
                ).toLowerCase();

                if (!combined.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        displayBrowseItems(filtered);
    }

    if (searchInput) searchInput.oninput = applyFilters;
    if (locationFilter) locationFilter.oninput = applyFilters;
    if (typeFilter) typeFilter.onchange = applyFilters;
    if (categoryFilter) categoryFilter.onchange = applyFilters;
}


async function loadBrowseItems() {

    try {

        const lostSnapshot =
            await getDocs(
                collection(db, "lostItems")
            );

        const foundSnapshot =
            await getDocs(
                collection(db, "foundItems")
            );


        const items = [];


        lostSnapshot.forEach(function(documentSnapshot) {

            items.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data(),
                type: "lost"
            });

        });


        foundSnapshot.forEach(function(documentSnapshot) {

            items.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data(),
                type: "found"
            });

        });


        displayBrowseItems(items);
        setupBrowseFilters(items);


    } catch (error) {

        console.error(
            "Browse error:",
            error
        );

        reportsList.innerHTML = `
            <div class="no-reports">
                <h2>Unable to load reports</h2>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

    }

}


function displayBrowseItems(items) {

    if (!reportsList) {
        return;
    }


    reportsList.innerHTML = "";


    if (items.length === 0) {

        reportsList.innerHTML = `
            <div class="no-reports">
                <h2>No Reports Yet</h2>
                <p>No lost or found items have been reported.</p>
            </div>
        `;

        return;
    }


    items.reverse().forEach(function(item) {

        const card =
            document.createElement("div");

        card.className =
            "report-card";


        card.innerHTML = `

            <span class="report-type ${escapeHTML(item.type)}">
                ${escapeHTML(item.type.toUpperCase())}
            </span>

            <h3>
                ${escapeHTML(item.itemName)}
            </h3>

            <p class="report-info">
                <strong>Category:</strong>
                ${escapeHTML(item.category)}
            </p>

            <p class="report-info">
                <strong>Location:</strong>
                ${escapeHTML(item.location)}
            </p>

            <p class="report-info">
                <strong>Date:</strong>
                ${escapeHTML(item.date || "Not specified")}
            </p>

            <span class="report-status">
                ${item.type === "lost"
                    ? "Still Lost"
                    : "Found"}
            </span>

            <div class="report-actions">

                <a
                    href="item.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}"
                    class="report-view-btn"
                >
                    View Details
                </a>

            </div>

        `;


        reportsList.appendChild(card);

    });

}


// ========================================
// ITEM DETAILS
// ========================================

const itemDetailsContainer =
    document.querySelector("#itemDetailsContainer");

if (itemDetailsContainer) {

    loadItemDetails();

}


async function loadItemDetails() {

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const itemId =
        urlParams.get("id");

    const itemType =
        urlParams.get("type");


    if (!itemId || !itemType) {

        itemDetailsContainer.innerHTML = `
            <div class="details-card">
                <h2>Item Not Found</h2>
                <p>Invalid item information.</p>
            </div>
        `;

        return;
    }


    try {

        const collectionName =
            itemType === "found"
            ? "foundItems"
            : "lostItems";


        const itemReference =
            doc(
                db,
                collectionName,
                itemId
            );


        const itemSnapshot =
            await getDoc(itemReference);


        if (!itemSnapshot.exists()) {

            itemDetailsContainer.innerHTML = `
                <div class="details-card">
                    <h2>Item Not Found</h2>
                    <p>This report may have been removed.</p>
                </div>
            `;

            return;
        }


        const item = {
            id: itemSnapshot.id,
            ...itemSnapshot.data(),
            type: itemType
        };


        itemDetailsContainer.innerHTML = `

            <div class="details-card">

                <span class="details-type ${escapeHTML(item.type)}">
                    ${escapeHTML(item.type.toUpperCase())}
                </span>

                <h1>
                    ${escapeHTML(item.itemName)}
                </h1>

                <div class="detail-row">
                    <strong>Category</strong>
                    <span>
                        ${escapeHTML(item.category)}
                    </span>
                </div>

                <div class="detail-row">
                    <strong>Color</strong>
                    <span>
                        ${escapeHTML(item.color || "Not specified")}
                    </span>
                </div>

                <div class="detail-row">
                    <strong>Description</strong>
                    <span>
                        ${escapeHTML(item.description)}
                    </span>
                </div>

                <div class="detail-row">
                    <strong>Location</strong>
                    <span>
                        ${escapeHTML(item.location)}
                    </span>
                </div>

                <div class="detail-row">
                    <strong>Date</strong>
                    <span>
                        ${escapeHTML(item.date || "Not specified")}
                    </span>
                </div>

                <div class="detail-row">
                    <strong>Approximate Time</strong>
                    <span>
                        ${escapeHTML(item.time || "Not specified")}
                    </span>
                </div>
<div class="details-actions">

    <a
        href="browse.html"
        class="back-btn"
    >
        Back to Browse
    </a>

    <a
        href="claim.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}"
        class="claim-btn"
    >
        🔐 Claim / Verify Ownership
    </a>
<a
    href="matches.html"
    class="claim-btn"
    data-item-id="${item.id}"
    data-item-type="${item.type}"
>
    🔍 Find Possible Matches
</a>

</div>

            </div>

        `;


    } catch (error) {

        console.error(
            "Item details error:",
            error
        );

        itemDetailsContainer.innerHTML = `
            <div class="details-card">
                <h2>Error</h2>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

    }

}


// ========================================
// MY REPORTS
// ========================================

const myReportsContainer =
    document.querySelector("#reportsContainer");

if (
    myReportsContainer &&
    getPageName() === "my-reports.html"
) {

    loadMyReports();

}


async function loadMyReports() {

    const user =
        await requireLogin();


    if (!user) {

        myReportsContainer.innerHTML = `

            <div class="no-reports">

                <h2>Login Required</h2>

                <p>
                    Please login to view your reports.
                </p>

                <div class="report-actions">

                    <a
                        href="login.html"
                        class="report-view-btn"
                    >
                        Login
                    </a>

                </div>

            </div>

        `;

        return;
    }


    try {

        const lostQuery =
            query(
                collection(db, "lostItems"),
                where("userId", "==", user.uid)
            );

        const foundQuery =
            query(
                collection(db, "foundItems"),
                where("userId", "==", user.uid)
            );


        const [
            lostSnapshot,
            foundSnapshot
        ] = await Promise.all([
            getDocs(lostQuery),
            getDocs(foundQuery)
        ]);


        const reports = [];


        lostSnapshot.forEach(function(snapshot) {

            reports.push({
                id: snapshot.id,
                ...snapshot.data(),
                type: "lost"
            });

        });


        foundSnapshot.forEach(function(snapshot) {

            reports.push({
                id: snapshot.id,
                ...snapshot.data(),
                type: "found"
            });

        });


        myReportsContainer.innerHTML = "";


        if (reports.length === 0) {

            myReportsContainer.innerHTML = `

                <div class="no-reports">

                    <h2>No Reports Yet</h2>

                    <p>
                        You have not reported any lost
                        or found items yet.
                    </p>

                </div>

            `;

            return;
        }


        reports.reverse().forEach(function(item) {

            const card =
                document.createElement("div");

            card.className =
                "report-card";


            card.innerHTML = `

                <span class="report-type ${escapeHTML(item.type)}">
                    ${escapeHTML(item.type.toUpperCase())}
                </span>

                <h3>
                    ${escapeHTML(item.itemName)}
                </h3>

                <p class="report-info">
                    <strong>Category:</strong>
                    ${escapeHTML(item.category)}
                </p>

                <p class="report-info">
                    <strong>Location:</strong>
                    ${escapeHTML(item.location)}
                </p>

                <p class="report-info">
                    <strong>Date:</strong>
                    ${escapeHTML(item.date || "Not specified")}
                </p>

                <span class="report-status">
                    ${
                        item.type === "lost"
                        ? "Still Lost"
                        : "Found"
                    }
                </span>

                <div class="report-actions">

                    <a
                        href="item.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}"
                        class="report-view-btn"
                    >
                        View Details
                    </a>

                    <button
                        class="report-delete-btn"
                        data-id="${escapeHTML(item.id)}"
                        data-type="${escapeHTML(item.type)}"
                    >
                        Delete
                    </button>

                </div>

            `;


            myReportsContainer.appendChild(card);

        });


        document
            .querySelectorAll(".report-delete-btn")
            .forEach(function(button) {

                button.addEventListener(
                    "click",
                    async function() {

                        const reportId =
                            button.dataset.id;

                        const reportType =
                            button.dataset.type;

                        const confirmed =
                            await showConfirm(
                                "Are you sure you want to delete this report?",
                                "Delete Report"
                            );

                        if (!confirmed) {
                            return;
                        }


                        try {

                            const collectionName =
                                reportType === "found"
                                ? "foundItems"
                                : "lostItems";


                            await deleteDoc(
                                doc(
                                    db,
                                    collectionName,
                                    reportId
                                )
                            );


                            showMessage(
                                "Report deleted successfully."
                            );


                            loadMyReports();


                        } catch (error) {

                            console.error(
                                "Delete error:",
                                error
                            );

                            showMessage(
                                "Could not delete report."
                            );

                        }

                    }
                );

            });


    } catch (error) {

        console.error(
            "My Reports error:",
            error
        );


        myReportsContainer.innerHTML = `

            <div class="no-reports">

                <h2>Unable to load reports</h2>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>

        `;

    }

}


// ========================================
// LOGOUT LINK SUPPORT
// ========================================

document
    .querySelectorAll("[data-logout]")
    .forEach(function(button) {

        button.addEventListener(
            "click",
            async function(event) {

                event.preventDefault();

                try {

                    await signOut(auth);

                    localStorage.removeItem(
                        "userName"
                    );

                    window.location.href =
                        "index.html";

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    showMessage(
                        "Logout failed."
                    );

                }

            }
        );

    });


console.log(
    "Lost & Found Firebase system loaded successfully."
);
// ========================================
// SMART MATCHING
// ========================================

async function findSmartMatches() {

    const matchesContainer =
        document.querySelector("#matchesContainer");

    if (!matchesContainer) {
        return;
    }

    const urlParams =
        new URLSearchParams(window.location.search);

    const itemId = urlParams.get("id");
    const itemType = urlParams.get("type");

    try {

        const user = await requireLogin();

        if (!user) {
            matchesContainer.innerHTML = `
                <div class="no-reports">
                    <h2>Login Required</h2>
                    <p>Please login to view possible matches for your items.</p>
                    <div class="report-actions" style="margin-top: 15px;">
                        <a href="login.html" class="report-view-btn">
                            Login
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        if (!itemId || !itemType) {
            // General Smart Match for logged-in user's reported items
            const lostQuery = query(
                collection(db, "lostItems"),
                where("userId", "==", user.uid)
            );

            const foundQuery = query(
                collection(db, "foundItems"),
                where("userId", "==", user.uid)
            );

            const [userLostSnap, userFoundSnap] = await Promise.all([
                getDocs(lostQuery),
                getDocs(foundQuery)
            ]);

            const userItems = [];

            userLostSnap.forEach(function(snapshot) {
                userItems.push({
                    id: snapshot.id,
                    ...snapshot.data(),
                    type: "lost"
                });
            });

            userFoundSnap.forEach(function(snapshot) {
                userItems.push({
                    id: snapshot.id,
                    ...snapshot.data(),
                    type: "found"
                });
            });

            if (userItems.length === 0) {
                matchesContainer.innerHTML = `
                    <div class="no-reports">
                        <h2>No Reported Items</h2>
                        <p>You haven't reported any lost or found items yet. Submit a report to find matches!</p>
                        <div class="report-actions" style="margin-top: 15px;">
                            <a href="lost.html" class="report-view-btn">Report Lost Item</a>
                            <a href="found.html" class="report-view-btn" style="margin-left: 10px;">Report Found Item</a>
                        </div>
                    </div>
                `;
                return;
            }

            const [allLostSnap, allFoundSnap] = await Promise.all([
                getDocs(collection(db, "lostItems")),
                getDocs(collection(db, "foundItems"))
            ]);

            const allLost = [];
            const allFound = [];

            allLostSnap.forEach(function(snapshot) {
                allLost.push({ id: snapshot.id, ...snapshot.data() });
            });

            allFoundSnap.forEach(function(snapshot) {
                allFound.push({ id: snapshot.id, ...snapshot.data() });
            });

            const userMatches = [];

            userItems.forEach(function(uItem) {
                const oppositeItems =
                    uItem.type === "lost"
                        ? allFound
                        : allLost;

                const oppositeType =
                    uItem.type === "lost"
                        ? "found"
                        : "lost";

                oppositeItems.forEach(function(oItem) {
                    if (oItem.id === uItem.id) {
                        return;
                    }

                    const score = calculateMatchScore(uItem, oItem);

                    if (score >= 30) {
                        userMatches.push({
                            id: oItem.id,
                            ...oItem,
                            type: oppositeType,
                            score: score,
                            matchedFor: uItem.itemName
                        });
                    }
                });
            });

            userMatches.sort(function(a, b) {
                return b.score - a.score;
            });

            displaySmartMatches(userMatches, "all");
            return;
        }

        const currentCollection =
            itemType === "lost"
                ? "lostItems"
                : "foundItems";

        const oppositeCollection =
            itemType === "lost"
                ? "foundItems"
                : "lostItems";

        const currentRef =
            doc(db, currentCollection, itemId);

        const currentSnapshot =
            await getDoc(currentRef);

        if (!currentSnapshot.exists()) {
            matchesContainer.innerHTML = `
                <div class="no-reports">
                    <h2>Item Not Found</h2>
                    <p>This report may have been removed.</p>
                </div>
            `;
            return;
        }

        const currentItem =
            currentSnapshot.data();

        const oppositeSnapshot =
            await getDocs(
                collection(db, oppositeCollection)
            );

        const possibleMatches = [];

        oppositeSnapshot.forEach(function(snapshot) {

            const otherItem = snapshot.data();

            const score =
                calculateMatchScore(
                    currentItem,
                    otherItem
                );

            if (score >= 30) {

                possibleMatches.push({
                    id: snapshot.id,
                    ...otherItem,
                    type:
                        itemType === "lost"
                            ? "found"
                            : "lost",
                    score: score
                });

            }

        });

        possibleMatches.sort(function(a, b) {
            return b.score - a.score;
        });

        displaySmartMatches(
            possibleMatches,
            itemType
        );

    } catch (error) {

        console.error(
            "Smart matching error:",
            error
        );

        matchesContainer.innerHTML = `
            <div class="no-reports">
                <h2>Unable to find matches</h2>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// ========================================
// MATCH SCORE
// ========================================

function calculateMatchScore(item1, item2) {

    let score = 0;

    const name1 =
        normalizeText(item1.itemName);

    const name2 =
        normalizeText(item2.itemName);

    const category1 =
        normalizeText(item1.category);

    const category2 =
        normalizeText(item2.category);

    const color1 =
        normalizeText(item1.color);

    const color2 =
        normalizeText(item2.color);

    const location1 =
        normalizeText(item1.location);

    const location2 =
        normalizeText(item2.location);

    const description1 =
        normalizeText(item1.description);

    const description2 =
        normalizeText(item2.description);


    // Category = 25 points
    if (
        category1 &&
        category2 &&
        category1 === category2
    ) {
        score += 25;
    }


    // Item name = 25 points
    if (
        name1 &&
        name2 &&
        (
            name1 === name2 ||
            name1.includes(name2) ||
            name2.includes(name1)
        )
    ) {
        score += 25;
    }


    // Color = 15 points
    if (
        color1 &&
        color2 &&
        color1 === color2
    ) {
        score += 15;
    }


    // Location = 20 points
    if (
        location1 &&
        location2 &&
        (
            location1 === location2 ||
            location1.includes(location2) ||
            location2.includes(location1)
        )
    ) {
        score += 20;
    }


    // Description similarity = 15 points
    const descriptionSimilarity =
        calculateTextSimilarity(
            description1,
            description2
        );

    score += Math.round(
        descriptionSimilarity * 15
    );


    // Date similarity bonus
    if (
        item1.date &&
        item2.date &&
        item1.date === item2.date
    ) {
        score += 5;
    }


    // Maximum score = 105
    // Convert to percentage
    return Math.min(
        100,
        Math.round(
            (score / 105) * 100
        )
    );
}


// ========================================
// TEXT HELPERS
// ========================================

function normalizeText(text) {

    if (!text) {
        return "";
    }

    return String(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


function calculateTextSimilarity(text1, text2) {

    if (!text1 || !text2) {
        return 0;
    }

    const words1 =
        new Set(
            text1
                .split(" ")
                .filter(function(word) {
                    return word.length > 2;
                })
        );

    const words2 =
        new Set(
            text2
                .split(" ")
                .filter(function(word) {
                    return word.length > 2;
                })
        );

    if (
        words1.size === 0 ||
        words2.size === 0
    ) {
        return 0;
    }

    let commonWords = 0;

    words1.forEach(function(word) {

        if (words2.has(word)) {
            commonWords++;
        }

    });

    const totalUniqueWords =
        new Set([
            ...words1,
            ...words2
        ]).size;

    if (totalUniqueWords === 0) {
        return 0;
    }

    return commonWords / totalUniqueWords;
}


// ========================================
// DISPLAY MATCHES
// ========================================

function displaySmartMatches(
    matches,
    currentType
) {

    const matchesContainer =
        document.querySelector("#matchesContainer");

    if (!matchesContainer) {
        return;
    }

    matchesContainer.innerHTML = "";


    if (matches.length === 0) {

        matchesContainer.innerHTML = `
            <div class="no-reports">
                <h2>No Possible Matches Yet</h2>
                <p>
                    We could not find a strong match right now.
                    New reports may create a match later.
                </p>
            </div>
        `;

        return;
    }


    const heading =
        document.createElement("div");

    heading.className =
        "matches-header";

    let subtitle =
        currentType === "all"
            ? `possible match${matches.length === 1 ? "" : "es"} for your reported items.`
            : `possible ${currentType === "lost" ? "found" : "lost"} report${matches.length === 1 ? "" : "s"}.`;

    heading.innerHTML = `
        <h2>Possible Matches</h2>
        <p>
            We found ${matches.length} ${subtitle}
        </p>
    `;

    matchesContainer.appendChild(heading);


    matches.forEach(function(item) {

        const card =
            document.createElement("div");

        card.className =
            "report-card";


        let scoreText =
            "Possible Match";

        if (item.score >= 80) {
            scoreText = "Strong Match";
        } else if (item.score >= 60) {
            scoreText = "Good Match";
        }


        card.innerHTML = `

            <span class="report-type ${escapeHTML(item.type)}">
                ${escapeHTML(item.type.toUpperCase())}
            </span>

            <h3>
                ${escapeHTML(item.itemName)}
            </h3>

            ${item.matchedFor ? `
            <p class="report-info">
                <strong>Matched With Your:</strong>
                ${escapeHTML(item.matchedFor)}
            </p>
            ` : ""}

            <p class="report-info">
                <strong>Match Score:</strong>
                ${item.score}%
            </p>

            <p class="report-info">
                <strong>Category:</strong>
                ${escapeHTML(item.category)}
            </p>

            <p class="report-info">
                <strong>Color:</strong>
                ${escapeHTML(item.color || "Not specified")}
            </p>

            <p class="report-info">
                <strong>Location:</strong>
                ${escapeHTML(item.location)}
            </p>

            <p class="report-info">
                <strong>Date:</strong>
                ${escapeHTML(item.date || "Not specified")}
            </p>

            <span class="report-status">
                ${scoreText}
            </span>

            <div class="report-actions">

                <a
                    href="item.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}"
                    class="report-view-btn"
                >
                    View Details
                </a>

            </div>

        `;

        matchesContainer.appendChild(card);

    });
}


// ========================================
// START SMART MATCHING
// ========================================

if (
    getPageName() === "matches.html"
) {
    findSmartMatches();
}
// ========================================
// OPEN SMART MATCHES
// ========================================

window.openSmartMatches = function(itemId, itemType) {

    if (!itemId || !itemType) {
        showMessage("Item information is missing.", "error");
        return;
    }

    window.location.href =
        "matches.html?id=" +
        encodeURIComponent(itemId) +
        "&type=" +
        encodeURIComponent(itemType);
};

document.addEventListener("click", function(event) {

    const matchButton =
        event.target.closest("[data-item-id][data-item-type]");

    if (!matchButton) {
        return;
    }

    event.preventDefault();

    const itemId =
        matchButton.dataset.itemId;

    const itemType =
        matchButton.dataset.itemType;

    window.location.href =
        "matches.html?id=" +
        encodeURIComponent(itemId) +
        "&type=" +
        encodeURIComponent(itemType);
});


// ========================================
// OWNERSHIP VERIFICATION (CLAIM ITEM)
// ========================================

async function loadClaimPage() {
    const claimItemInfo = document.querySelector("#claimItemInfo");
    const claimForm = document.querySelector(".claim-form");

    if (!claimForm && !claimItemInfo) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get("id");
    const itemType = urlParams.get("type") || "found";

    if (!itemId) {
        if (claimItemInfo) {
            claimItemInfo.innerHTML = `
                <div class="no-reports">
                    <h2>Invalid Request</h2>
                    <p>Item information is missing.</p>
                </div>
            `;
        }
        return;
    }

    try {
        const collectionName = itemType === "found" ? "foundItems" : "lostItems";
        const itemSnap = await getDoc(doc(db, collectionName, itemId));

        if (!itemSnap.exists()) {
            if (claimItemInfo) {
                claimItemInfo.innerHTML = `
                    <div class="no-reports">
                        <h2>Item Not Found</h2>
                        <p>This report may have been removed.</p>
                    </div>
                `;
            }
            return;
        }

        const itemData = itemSnap.data();

        if (claimItemInfo) {
            claimItemInfo.innerHTML = `
                <div style="background:#f0f4f8; padding:15px; border-radius:8px; margin-bottom:20px; border-left:4px solid #172033;">
                    <h3 style="margin:0 0 8px 0; font-size:18px;">${escapeHTML(itemData.itemName)}</h3>
                    <p style="margin:4px 0; font-size:14px; color:#444;">
                        <strong>Category:</strong> ${escapeHTML(itemData.category)} | 
                        <strong>Location:</strong> ${escapeHTML(itemData.location)}
                    </p>
                    <p style="margin:4px 0; font-size:14px; color:#666;">${escapeHTML(itemData.description)}</p>
                </div>
            `;
        }

        if (claimForm) {
            claimForm.addEventListener("submit", async function(event) {
                event.preventDefault();

                const user = await requireLogin();
                if (!user) {
                    showMessage("Please login before submitting an ownership claim.");
                    window.location.href = "login.html";
                    return;
                }

                const claimDescription = document.querySelector("#claimDescription").value.trim();
                const claimProof = document.querySelector("#claimProof").value.trim();

                if (!claimDescription || !claimProof) {
                    showMessage("Please fill all verification fields.");
                    return;
                }

                const submitBtn = claimForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Submitting Verification...";
                }

                try {
                    await addDoc(collection(db, "claims"), {
                        itemId: itemId,
                        itemType: itemType,
                        itemTitle: itemData.itemName,
                        finderId: itemData.userId || user.uid,
                        claimantId: user.uid,
                        claimantName: user.displayName || localStorage.getItem("userName") || user.email.split("@")[0],
                        claimantEmail: user.email,
                        claimDescription: claimDescription,
                        claimProof: claimProof,
                        verificationClue: itemData.verificationClue || "",
                        status: "Pending",
                        createdAt: serverTimestamp()
                    });

                    showMessage("Ownership verification submitted successfully! Check Claim Review to see its status.");
                    window.location.href = "claim-review.html";
                } catch (err) {
                    console.error("Claim submit error:", err);
                    showMessage("Could not submit claim: " + err.message);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Submit Ownership Verification";
                    }
                }
            });
        }
    } catch (err) {
        console.error("Load claim page error:", err);
    }
}


// ========================================
// CLAIM REVIEW (FINDER/OWNER REVIEW)
// ========================================

async function loadClaimReviewPage() {
    const claimsContainer = document.querySelector("#claimsContainer");
    if (!claimsContainer) {
        return;
    }

    const user = await requireLogin();
    if (!user) {
        claimsContainer.innerHTML = `
            <div class="no-reports">
                <h2>Login Required</h2>
                <p>Please login to review ownership claims.</p>
                <div class="report-actions" style="margin-top:15px;">
                    <a href="login.html" class="report-view-btn">Login</a>
                </div>
            </div>
        `;
        return;
    }

    try {
        const receivedQuery = query(
            collection(db, "claims"),
            where("finderId", "==", user.uid)
        );

        const submittedQuery = query(
            collection(db, "claims"),
            where("claimantId", "==", user.uid)
        );

        const [receivedSnap, submittedSnap] = await Promise.all([
            getDocs(receivedQuery),
            getDocs(submittedQuery)
        ]);

        const claimsMap = new Map();

        receivedSnap.forEach(function(snapshot) {
            const data = snapshot.data();
            const localStatus = localStorage.getItem("claim_status_" + snapshot.id);
            claimsMap.set(snapshot.id, {
                ...data,
                id: snapshot.id,
                status: localStatus || data.status || "Pending",
                role: "finder"
            });
        });

        submittedSnap.forEach(function(snapshot) {
            if (!claimsMap.has(snapshot.id)) {
                const data = snapshot.data();
                const localStatus = localStorage.getItem("claim_status_" + snapshot.id);
                claimsMap.set(snapshot.id, {
                    ...data,
                    id: snapshot.id,
                    status: localStatus || data.status || "Pending",
                    role: "claimant"
                });
            }
        });

        const claims = Array.from(claimsMap.values());

        claimsContainer.innerHTML = "";

        if (claims.length === 0) {
            claimsContainer.innerHTML = `
                <div class="no-reports">
                    <h2>No Claims Found</h2>
                    <p>No ownership claims have been submitted or received yet.</p>
                </div>
            `;
            return;
        }

        claims.reverse().forEach(function(claim) {
            const card = document.createElement("div");
            card.className = "report-card";
            card.style.marginBottom = "20px";

            let statusBg = "#f39c12";
            if (claim.status === "Approved") statusBg = "#27ae60";
            if (claim.status === "Rejected") statusBg = "#e74c3c";

            const isFinder = claim.finderId === user.uid;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span class="report-type" style="background-color: ${statusBg}; color: white;">
                        ${escapeHTML(claim.status.toUpperCase())}
                    </span>
                    <span style="font-size: 13px; color: #666; background: #eef2f7; padding: 4px 10px; border-radius: 12px;">
                        ${isFinder ? "📥 Received Claim" : "📤 Submitted Claim"}
                    </span>
                </div>

                <h3>Claim for: ${escapeHTML(claim.itemTitle)}</h3>

                <p class="report-info">
                    <strong>Claimant:</strong> ${escapeHTML(claim.claimantName)} (${escapeHTML(claim.claimantEmail)})
                </p>

                <p class="report-info">
                    <strong>Unmentioned Detail:</strong> ${escapeHTML(claim.claimDescription)}
                </p>

                <p class="report-info">
                    <strong>Ownership Proof:</strong> ${escapeHTML(claim.claimProof)}
                </p>

                <div style="background: #fff8e7; padding: 12px; border-radius: 6px; margin: 12px 0; border-left: 4px solid #f39c12;">
                    <strong style="color: #d35400;">🔐 Private Verification Note:</strong>
                    <p style="margin: 6px 0 0 0; color: #444; font-style: italic;">
                        ${escapeHTML(claim.verificationClue || "No private clue set on original report.")}
                    </p>
                </div>

                ${isFinder && claim.status === "Pending" ? `
                    <div class="report-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="primary-btn approve-btn" data-claim-id="${claim.id}" data-item-id="${claim.itemId}" data-item-type="${claim.itemType}" style="background-color: #27ae60; cursor: pointer;">
                            ✓ Approve Claim
                        </button>
                        <button class="primary-btn reject-btn" data-claim-id="${claim.id}" style="background-color: #e74c3c; cursor: pointer;">
                            ✗ Reject Claim
                        </button>
                    </div>
                ` : ""}
            `;

            claimsContainer.appendChild(card);
        });

        claimsContainer.querySelectorAll(".approve-btn").forEach(function(btn) {
            btn.onclick = async function(event) {
                if (event) event.preventDefault();

                const claimId = btn.dataset.claimId;
                const itemId = btn.dataset.itemId;
                const itemType = btn.dataset.itemType;
                const card = btn.closest(".report-card");

                btn.disabled = true;
                btn.textContent = "Approving...";

                // Cache status locally so it never reverts on reload
                localStorage.setItem("claim_status_" + claimId, "Approved");

                // Immediately update DOM card
                if (card) {
                    const badge = card.querySelector(".report-type");
                    if (badge) {
                        badge.textContent = "APPROVED";
                        badge.style.backgroundColor = "var(--sage-bg, #E8EFE8)";
                        badge.style.color = "var(--sage-text, #2D5A34)";
                    }
                    const actionRow = card.querySelector(".report-actions");
                    if (actionRow) {
                        actionRow.remove();
                    }
                }

                // Show prominent clean green popup immediately
                showMessage("✓ Ownership claim approved and confirmed!", "success");

                // Sync with Firestore
                try {
                    await setDoc(doc(db, "claims", claimId), { status: "Approved" }, { merge: true });

                    if (itemId) {
                        try {
                            const coll = itemType === "lost" ? "lostItems" : "foundItems";
                            await setDoc(doc(db, coll, itemId), { status: "Claimed & Returned" }, { merge: true });
                        } catch (itemErr) {
                            console.warn("Item status update warning:", itemErr);
                        }
                    }
                } catch (err) {
                    console.error("Firestore sync notice:", err);
                }
            };
        });

        claimsContainer.querySelectorAll(".reject-btn").forEach(function(btn) {
            btn.onclick = async function(event) {
                if (event) event.preventDefault();

                const claimId = btn.dataset.claimId;
                const card = btn.closest(".report-card");

                btn.disabled = true;
                btn.textContent = "Rejecting...";

                // Cache status locally so it never reverts on reload
                localStorage.setItem("claim_status_" + claimId, "Rejected");

                // Immediately update DOM card
                if (card) {
                    const badge = card.querySelector(".report-type");
                    if (badge) {
                        badge.textContent = "REJECTED";
                        badge.style.backgroundColor = "var(--blush-bg, #FFE4E1)";
                        badge.style.color = "var(--blush-text, #9F2D2D)";
                    }
                    const actionRow = card.querySelector(".report-actions");
                    if (actionRow) {
                        actionRow.remove();
                    }
                }

                // Show prominent clean red popup immediately
                showMessage("✗ Ownership claim rejected.", "error");

                // Sync with Firestore
                try {
                    await setDoc(doc(db, "claims", claimId), { status: "Rejected" }, { merge: true });
                } catch (err) {
                    console.error("Firestore sync notice:", err);
                }
            };
        });

    } catch (err) {
        console.error("Load claim review error:", err);

        const isPermissionError =
            err.code === "permission-denied" ||
            (err.message && err.message.toLowerCase().includes("permission"));

        if (isPermissionError) {
            claimsContainer.innerHTML = `
                <div class="no-reports" style="text-align: left; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 10px;">
                    <h2 style="color: #c53030; margin-top: 0;">🔥 Action Required: Firebase Firestore Rules</h2>
                    <p style="color: #2d3748; line-height: 1.6;">
                        Firebase Firestore requires database security rules to allow access to the <strong>claims</strong> collection.
                    </p>
                    <ol style="color: #2d3748; line-height: 1.7; padding-left: 20px;">
                        <li>Open <a href="https://console.firebase.google.com/" target="_blank" style="color: #3182ce;">Firebase Console</a> and select project <strong>lost-and-found-644e8</strong>.</li>
                        <li>Go to <strong>Firestore Database</strong> &rarr; <strong>Rules</strong> tab.</li>
                        <li>Add the following block inside your rules:
                            <pre style="background: #edf2f7; padding: 10px; border-radius: 6px; font-size: 13px; overflow-x: auto; margin-top: 8px;">match /claims/{claimId} {
  allow read, write: if request.auth != null;
}</pre>
                        </li>
                        <li>Click <strong>Publish</strong> and refresh this page.</li>
                    </ol>
                </div>
            `;
        } else {
            claimsContainer.innerHTML = `
                <div class="no-reports">
                    <h2>Unable to load claims</h2>
                    <p>${escapeHTML(err.message)}</p>
                </div>
            `;
        }
    }
}


// Trigger claim functions on page load
if (getPageName() === "claim.html" || document.querySelector(".claim-form")) {
    loadClaimPage();
}

if (getPageName() === "claim-review.html" || document.querySelector("#claimsContainer")) {
    loadClaimReviewPage();
}
