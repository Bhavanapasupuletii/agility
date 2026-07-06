// Local Database Cache Core
let inventory = JSON.parse(localStorage.getItem('pocket_inventory')) || {
    "890103": { barcode: "890103", name: "Premium Face Cream", mrp: 200, discount: 10, hsn: "3304", gst: 18 },
    "101": { barcode: "101", name: "Apples (Fresh Loose)", mrp: 150, discount: 0, hsn: "0808", gst: 0 }
};

let storeConfig = JSON.parse(localStorage.getItem('store_config')) || {
    name: "Agility", address: "Tirupati, AP", gstin: "37AAAAA0000A1Z1"
};

let cart = [];
let html5QrcodeScanner = null;

// Secure Offline Device Licensing Vault Engine
// Simple fast deterministic hash mapping loop acting as signature check
function generateFingerprint() {
    let activeLicense = localStorage.getItem('agility_secure_token');
    if (activeLicense) {
        verifyDecryptionMath(activeLicense);
    }
    
    // Create an offline machine footprint using browser seed strings
    let seed = (window.navigator.userAgent.length * 7) + storeConfig.name + "MAX20";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    let systemFingerprint = "AGL-" + Math.abs(hash).toString(16).toUpperCase() + "-M20";
    document.getElementById('display-machine-fingerprint').innerText = systemFingerprint;
}

function validateLicenseToken() {
    let userKeyInput = document.getElementById('license-key-entry').value.trim().toUpperCase();
    if(!userKeyInput) return alert("Please enter your assigned deployment key token.");
    
    if (verifyDecryptionMath(userKeyInput)) {
        localStorage.setItem('agility_secure_token', userKeyInput);
        alert("Branch cryptographic sequence valid. Workspace unlocked.");
        unlockWorkspaceUI();
    } else {
        alert("Verification sequence check failed. License invalid for this machine matrix profile.");
    }
}

function verifyDecryptionMath(token) {
    // Math core mirror matching master controller algorithm validation logic
    let footprint = document.getElementById('display-machine-fingerprint').innerText;
    if(!footprint || footprint === "GENERATING...") {
        let seed = (window.navigator.userAgent.length * 7) + storeConfig.name + "MAX20";
        let hash = 0;
        for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
        footprint = "AGL-" + Math.abs(hash).toString(16).toUpperCase() + "-M20";
    }
    
    let expectedChecksum = 0;
    for(let j=0; j<footprint.length; j++) {
        expectedChecksum += footprint.charCodeAt(j) * 3;
    }
    let expectedTokenString = "KEY-" + expectedChecksum.toString(16).toUpperCase() + "-UX";
    
    return (token === expectedTokenString);
}

function unlockWorkspaceUI() {
    document.getElementById('license-gate-screen').classList.add('hidden');
    let container = document.getElementById('main-application-workspace');
    container.classList.remove('opacity-10', 'pointer-events-none');
}

// Global App Initialization Hooks
document.addEventListener("DOMContentLoaded", () => {
    localStorage.setItem('pocket_inventory', JSON.stringify(inventory));
    localStorage.setItem('store_config', JSON.stringify(storeConfig));
    generateFingerprint();
    updateUIBranding();
    renderInventoryTable();
});

// Bulk Spreadsheet Excel/CSV Data Parser
function importBulkCSV() {
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    if (!file) return alert("Select a valid CSV file first.");

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        let itemsAddedCount = 0;

        lines.forEach((line) => {
            const columns = line.split(',');
            if (columns.length >= 6) {
                const barcode = columns[0].trim();
                const name = columns[1].trim();
                const mrp = parseFloat(columns[2]);
                const discount = parseFloat(columns[3]) || 0;
                const hsn = columns[4].trim();
                const gst = parseFloat(columns[5]);

                if (barcode && name && !isNaN(mrp) && !isNaN(gst) && barcode.toLowerCase() !== "barcode") {
                    inventory[barcode] = { barcode, name, mrp, discount, hsn, gst };
                    itemsAddedCount++;
                }
            }
        });

        localStorage.setItem('pocket_inventory', JSON.stringify(inventory));
        renderInventoryTable();
        calculateBill();
        fileInput.value = "";
        alert(`Successfully imported ${itemsAddedCount} items from spreadsheet!`);
    };
    reader.readAsText(file);
}

function switchView(viewName) {
    document.getElementById('view-billing').classList.add('hidden');
    document.getElementById('view-inventory').classList.add('hidden');
    document.getElementById('view-branding').classList.add('hidden');
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    if(viewName !== 'billing') stopCamera();
}

function updateUIBranding() {
    document.getElementById('display-store-name').innerText = storeConfig.name;
    document.getElementById('display-store-sub').innerText = `${storeConfig.address} | GSTIN: ${storeConfig.gstin}`;
    document.getElementById('cfg-name').value = storeConfig.name;
    document.getElementById('cfg-address').value = storeConfig.address;
    document.getElementById('cfg-gstin').value = storeConfig.gstin;
}

function processScan(barcode) {
    barcode = barcode.trim();
    const item = inventory[barcode];
    if (item) {
        const existingItem = cart.find(i => i.barcode === barcode);
        if (existingItem) { existingItem.quantity++; } else { cart.push({ ...item, quantity: 1 }); }
        calculateBill();
        document.getElementById('barcode-input').value = "";
    } else {
        alert(`Barcode/PLU Code "${barcode}" not matching matching records.`);
    }
}

function calculateBill() {
    const container = document.getElementById('cart-container');
    const taxSummaryElement = document.getElementById('tax-matrix-summary');
    
    if (cart.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400">Cart Empty. Ready for incoming transactions.</div>`;
        document.getElementById('grand-total-display').innerText = "₹0.00";
        taxSummaryElement.innerHTML = "";
        document.getElementById('print-btn').disabled = true;
        document.getElementById('print-btn').className = "px-6 py-2.5 bg-slate-200 text-slate-400 font-bold rounded-xl cursor-not-allowed text-sm shadow-sm";
        return;
    }

    let grandTotal = 0;
    let taxSummaryMatrix = {};
    container.innerHTML = "";

    cart.forEach((item, index) => {
        let baseDiscountAmount = item.mrp * (item.discount / 100);
        let actualSellingPrice = item.mrp - baseDiscountAmount;
        let lineTotalPrice = actualSellingPrice * item.quantity;
        let taxableValue = lineTotalPrice / (1 + (item.gst / 100));
        let totalGstAmount = lineTotalPrice - taxableValue;

        grandTotal += lineTotalPrice;

        if (!taxSummaryMatrix[item.gst]) taxSummaryMatrix[item.gst] = { taxable: 0, cgst: 0, sgst: 0 };
        taxSummaryMatrix[item.gst].taxable += taxableValue;
        taxSummaryMatrix[item.gst].cgst += totalGstAmount / 2;
        taxSummaryMatrix[item.gst].sgst += totalGstAmount / 2;

        container.innerHTML += `
            <div class="p-4 flex justify-between items-center bg-white">
                <div>
                    <h4 class="font-bold text-slate-900">${item.name}</h4>
                    <p class="text-xs text-slate-500">MRP: ₹${item.mrp} | Disc: ${item.discount}% | GST: ${item.gst}%</p>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex items-center border rounded-md">
                        <button onclick="updateQty(${index}, -1)" class="px-2 py-1 text-slate-500 hover:bg-slate-100">-</button>
                        <span class="px-3 text-sm font-semibold">${item.quantity}</span>
                        <button onclick="updateQty(${index}, 1)" class="px-2 py-1 text-slate-500 hover:bg-slate-100">+</button>
                    </div>
                    <span class="font-bold text-swift-blue min-w-[70px] text-right">₹${lineTotalPrice.toFixed(2)}</span>
                </div>
            </div>`;
    });

    document.getElementById('grand-total-display').innerText = `₹${grandTotal.toFixed(2)}`;
    taxSummaryElement.innerHTML = `<div class="font-bold text-slate-700 mb-1">TAX MATRIX ENGINE</div>`;
    Object.keys(taxSummaryMatrix).forEach(slab => {
        let data = taxSummaryMatrix[slab];
        taxSummaryElement.innerHTML += `<div>Slab ${slab}% &rarr; Base: ₹${data.taxable.toFixed(2)} | CGST: ₹${data.cgst.toFixed(2)} | SGST: ₹${data.sgst.toFixed(2)}</div>`;
    });

    let printBtn = document.getElementById('print-btn');
    printBtn.disabled = false;
    printBtn.className = "px-6 py-2.5 bg-swift-blue text-white font-bold rounded-xl text-sm shadow-sm cursor-pointer";
}

function updateQty(index, offset) {
    cart[index].quantity += offset;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    calculateBill();
}

function saveProductConfig() {
    let barcode = document.getElementById('inv-barcode').value.trim();
    let name = document.getElementById('inv-name').value.trim();
    let mrp = parseFloat(document.getElementById('inv-mrp').value);
    let discount = parseFloat(document.getElementById('inv-discount').value) || 0;
    let hsn = document.getElementById('inv-hsn').value.trim();
    let gst = parseFloat(document.getElementById('inv-gst').value);

    if(!barcode || !name || isNaN(mrp) || isNaN(gst)) return alert("Fill required fields.");

    inventory[barcode] = { barcode, name, mrp, discount, hsn, gst };
    localStorage.setItem('pocket_inventory', JSON.stringify(inventory));
    renderInventoryTable();
    calculateBill();
    alert("Product saved locally.");
}

function renderInventoryTable() {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = "";
    Object.values(inventory).forEach(item => {
        tbody.innerHTML += `
            <tr class="border-t border-slate-100 text-xs">
                <td class="p-2 font-mono">${item.barcode}</td>
                <td class="p-2 font-semibold">${item.name}</td>
                <td class="p-2">₹${item.mrp}</td>
                <td class="p-2">${item.discount}%</td>
                <td class="p-2">${item.gst}%</td>
                <td class="p-2"><button onclick="deleteProduct('${item.barcode}')" class="text-red-500 font-semibold">Remove</button></td>
            </tr>`;
    });
}

function deleteProduct(barcode) {
    delete inventory[barcode];
    localStorage.setItem('pocket_inventory', JSON.stringify(inventory));
    renderInventoryTable();
}

function saveBrandingConfig() {
    storeConfig.name = document.getElementById('cfg-name').value.trim();
    storeConfig.address = document.getElementById('cfg-address').value.trim();
    storeConfig.gstin = document.getElementById('cfg-gstin').value.trim();
    localStorage.setItem('store_config', JSON.stringify(storeConfig));
    updateUIBranding();
    alert("Branding synced.");
}

function executeTransaction() {
    alert(`Transaction locked under branding: ${storeConfig.name}.\nTotal collected: ${document.getElementById('grand-total-display').innerText}.`);
    cart = [];
    calculateBill();
}

// Optimized Camera Viewfinder Initialization Pipeline
function toggleCamera() {
    let container = document.getElementById('scanner-container');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        
        // Target high capture rate for direct mobile scans
        html5QrcodeScanner = new Html5QrcodeScanner(
            "interactive-reader", 
            { fps: 20, qrbox: { width: 280, height: 160 }, aspectRatio: 1.0 }
        );
        
        html5QrcodeScanner.render((text) => {
            processScan(text);
            stopCamera();
        }, (error) => {});
    } else {
        stopCamera();
    }
}

function stopCamera() {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            document.getElementById('scanner-container').classList.add('hidden');
        }).catch(() => {
            document.getElementById('scanner-container').classList.add('hidden');
        });
    } else {
        document.getElementById('scanner-container').classList.add('hidden');
    }
}