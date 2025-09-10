/* ============ CONFIG ============ */
// API_BASE นี้จะต้องเปลี่ยนเป็น URL ของ Google Apps Script ที่คุณสร้าง
const API_BASE = "https://script.google.com/macros/s/AKfycbxqEGlc9HNOQY6zX4-j_221-U7RkBsczez26UgWlbzXL6oRJycMItP14NLdpY58gipJHA/exec";
const API_KEY = "MEDREQ-KEY-2025-1234567890-ABC-NAREERATROUNGRONG-DEFG";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- Global Variables & Helpers ---------- */
let ALL_REQUESTS = [];
const currentFilters = {};

function msg(t, isErr = false, good = false) {
    const el = $('#msg');
    el.textContent = t;
    el.className = isErr ? 'err' : good ? 'ok' : 'muted';
}

function disableForm(b) {
    $('#btnSubmit').disabled = b;
}

/* ---------- Tab Switching & Initialization ---------- */
$$('.tab').forEach(b => {
    b.onclick = () => {
        $$('.tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const tab = b.dataset.tab;
        $('#panel-borrow').hidden = tab !== 'borrow';
        $('#panel-check').hidden = tab !== 'check';
        $('#panel-return').hidden = tab !== 'return';

        if (tab === 'check') loadRequests();
        if (tab === 'return') setupReturnPage();
    };
});

/* ---------- Borrow Tab ---------- */
const qtyEl = $('#qty');
const hnBox = $('#hnFields');
const rtypeRadios = $$('input[name="rtype"]');
const hnWrap = $('#hnWrap');
const btnSubmit = $('#btnSubmit');
const equipSelect = $('#equip');
const equipImageContainer = $('.equipment-image-container');
const equipmentImage = $('#equipmentImage');
const borrowForm = $('#borrowForm');

const EQUIPMENT_IMAGES = {
    "Infusion Pump": "https://drive.google.com/thumbnail?id=1E93642evvUDJp_1czd3bFDRbbcTqmvyK",
    "Syringe Pump": "https://drive.google.com/thumbnail?id=1H2r0wLEyKVyWFeTojgAfz0XNT40aiekm",
    "Feeding Pump": "https://drive.google.com/thumbnail?id=1xR4wxBipflP-pHv5cnZsGiAo0VSZRbFB",
    "Pneumatic Pump (SCD)": "https://drive.google.com/thumbnail?id=13URr2D-AET4FwaMl5iRbU4leE6zy3pp0",
    "Vacuum Dressing : Curasys": "https://drive.google.com/thumbnail?id=1z3ykHrO5AcJgD7sdwmVJ3UkOiQZewBxV",
    "Vacuum Dressing : Renasys": "https://drive.google.com/thumbnail?id=1jQPo08ziKdEb7QiZsgVZT-G6kA5Gz6WT",
    "Versajet": "https://drive.google.com/thumbnail?id=1FFok4iZ5suPtukXO9uii7HSIvyvs6zsy",
    "Alternating Pressure Mattress": "https://drive.google.com/thumbnail?id=1L-mFHJ1wAVHsZ2Tdxii2gtPXKFtVtFzo",
    "Telemetry Monitor": "https://drive.google.com/thumbnail?id=1x0j5yPi-DoaYSRZ9o7SqIuU7nZm52sIn"
};

function updateEquipmentImage() {
    const selectedEquip = equipSelect.value;
    const imageUrl = EQUIPMENT_IMAGES[selectedEquip];


    if (imageUrl) {
        equipmentImage.src = imageUrl;
        equipImageContainer.style.display = 'block';
    } else {
        equipmentImage.src = "";
        equipImageContainer.style.display = 'none';
    }
}
equipSelect.addEventListener('change', updateEquipmentImage);

function handleFormDisplay() {
    const selectedRadio = document.querySelector('input[name="rtype"]:checked');
    const requestType = selectedRadio.value;
    hnWrap.hidden = (requestType !== 'normal');
}

rtypeRadios.forEach(r => {
    r.onchange = handleFormDisplay;
});
handleFormDisplay();

function rebuildHN(preserve = []) {
    const qty = Math.max(1, Number(qtyEl.value || 1));
    hnBox.innerHTML = '';
    for (let i = 0; i < qty; i++) {
        const v = preserve[i] || '';
        const ip = document.createElement('input');
        ip.type = "text";
        ip.placeholder = `HN #${i + 1} (9 digits)`;
        ip.maxLength = 9;
        ip.inputMode = 'numeric';
        ip.value = v;
        ip.oninput = () => { ip.value = ip.value.replace(/\D/g, '').slice(0, 9); };
        hnBox.appendChild(ip);
    }
}
qtyEl.addEventListener('input', () => rebuildHN([...hnBox.querySelectorAll('input')].map(i => i.value)));
rebuildHN();

(function setMin() {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    const minDate = d.toISOString().slice(0, 16);
    $('#need').min = minDate;
})();

borrowForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const borrower = $('#borrower').value.trim();
    const dept = $('#dept').value.trim();
    const equip = $('#equip').value.trim();
    const qty = Math.max(1, Number(qtyEl.value || 1));
    const rtype = document.querySelector('input[name="rtype"]:checked').value;
    const need = $('#need').value;
    const notes = $('#notes').value.trim();
    let hns = [];

    if (rtype === 'normal') {
        hns = [...hnBox.querySelectorAll('input')].map(i => i.value.trim());
        if (hns.length !== qty) { return msg('จำนวน HN ต้องเท่ากับจำนวนเครื่อง', true); }
        if (hns.some(h => h.length !== 9 || !/^\d{9}$/.test(h))) { return msg('HN ต้องมี 9 หลักทุกช่อง', true); }
    }
    if (!borrower || !dept || !equip || !need) { return msg('กรุณากรอกข้อมูลให้ครบ', true); }

    const payload = {
        id: 'REQ-' + Date.now().toString(36).toUpperCase(),
        borrowerName: borrower,
        department: dept,
        equipmentType: equip,
        requestType: rtype,
        quantity: qty,
        hnNumbers: hns.join(', '),
        requiredTime: need,
        notes
    };

    disableForm(true);
    msg('กำลังส่ง...');

    try {
        const res = await fetch(`${API_BASE}?action=createRequest&key=${encodeURIComponent(API_KEY)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const js = await res.json();
        if (!js.success) throw new Error(js.message || 'ส่งไม่สำเร็จ');
        msg('ส่งคำขอสำเร็จ! หมายเลข: ' + payload.id, false, true);
        borrowForm.reset();
        rebuildHN();
    } catch (err) {
        msg('ผิดพลาด: ' + err.message, true);
    } finally {
        disableForm(false);
    }
});

/* ---------- Check Tab ---------- */
async function loadRequests() {
    const tableBody = $('#requestsTable tbody');

    $('#status').textContent = 'กำลังโหลด...';
    tableBody.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}?action=getAllRequests&key=${encodeURIComponent(API_KEY)}`);

        const js = await res.json();

        ALL_REQUESTS = (js && js.data) ? js.data : [];

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentRequests = ALL_REQUESTS.filter(item => {
            const reqTime = new Date(item.timestamp);
            return reqTime > twentyFourHoursAgo;
        });

        renderList(recentRequests);
        setupFilters(recentRequests);
        $('#status').textContent = `แสดง ${recentRequests.length} รายการ (ใน 24 ชม.) • อัปเดต ${new Date().toLocaleTimeString('th-TH')}`;
    } catch (err) {
        $('#status').textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + err.message;
    }
}

function setupFilters(requests) {
    $$('.table-filter-dropdown').forEach(select => {
        const column = select.parentElement.dataset.column;
        if (!column) return;

        let options = new Set();
        requests.forEach(item => {
            const value = item[column];
            if (value) {
                if (Array.isArray(value)) {
                    value.forEach(v => options.add(v));
                } else {
                    options.add(value);
                }
            }
        });

        select.innerHTML = '<option value="">ทั้งหมด</option>' + [...options].map(option => `<option value="${option}">${option}</option>`).join('');

        select.onchange = () => {
            currentFilters[column] = select.value;
            applyFilters();
        };
    });
}

function applyFilters() {
    const filteredRequests = ALL_REQUESTS.filter(item => {
        return Object.entries(currentFilters).every(([column, filterValue]) => {
            if (!filterValue) return true;
            const itemValue = item[column];
            if (Array.isArray(itemValue)) {
                return itemValue.includes(filterValue);
            }
            return itemValue === filterValue;
        });
    });
    renderList(filteredRequests);
}

function renderList(requests) {
    const tableBody = $('#requestsTable tbody');
    tableBody.innerHTML = '';

    if (requests.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">ไม่มีรายการที่ตรงกับเงื่อนไข</td></tr>';
        return;
    }

    requests.forEach(item => {
        const row = document.createElement('tr');
        const hnString = Array.isArray(item.hnNumbers) && item.hnNumbers.length > 0 ? item.hnNumbers.join(', ') : '-';
        row.innerHTML = `
            <td data-label="ID">${item.id || '-'}</td>
            <td data-label="Requestor">${item.borrowerName || '-'}</td>
            <td data-label="Department">${item.department || '-'}</td>
            <td data-label="Equipment">${item.equipmentType || '-'}</td>
            <td data-label="Quantity">${item.quantity || '-'}</td>
            <td data-label="HN">${hnString}</td> 
            <td data-label="Require Before">${item.requiredTime || '-'}</td>
            <td data-label="Status" class="status-cell">
                ${item.status === 'Pending' ?
                `<span>${item.status}</span>` :
                `<span>${item.status}</span>`
            }
            </td>
        `;
        tableBody.appendChild(row);
    });

    $$('.btn-accept').forEach(button => {
        button.addEventListener('click', async (event) => {
            const requestId = event.target.dataset.id;
            const itemToUpdate = ALL_REQUESTS.find(r => r.id === requestId);

            if (confirm(`คุณต้องการรับเครื่องสำหรับคำขอ ${itemToUpdate.id} หรือไม่?`)) {
                try {
                    const response = await postData('acceptRequest', { requestId: requestId, status: 'Accepted' });
                    if (response.success) {
                        alert('รับเครื่องสำเร็จ!');
                        loadRequests();
                    } else {
                        alert('เกิดข้อผิดพลาด: ' + response.message);
                    }
                } catch (error) {
                    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
                }
            }
        });
    });
}

async function postData(action, payload) {
    const url = `${API_BASE}?action=${action}&key=${encodeURIComponent(API_KEY)}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return res.json();
    } catch (err) {
        console.error('Post data error:', err);
        return { success: false, message: 'การส่งข้อมูลล้มเหลว' };
    }
}

/* ---------- Return Tab ---------- */
const departmentList = [
    "Ambulance", "Bone Marrow Transplant", "Cardiac Care Unit", "Cardiac Catheterization Laboratory",
    "Cardiology Center", "Cardiovascular Assessment", "Central Sterile Supply Department", "Dental Center",
    "Dermatology And Aesthetic Clinic", "Emergency Department", "Emerging Infectious Diseases And Acute Respiratory Infection Clinic",
    "Engineering Office", "ENT Clinic", "Equipment Store (B1)", "Eye Care Center", "Gastrointestinal And Liver Center",
    "Genotech Lab Center", "Health Screening Center", "Hemodialysis Center", "Hyperbaric", "Infection Control",
    "Intensive Care Unit", "Internal Medicine 1 (8B)", "Internal Medicine 2 (8C)", "IVF", "Labor And Delivery Room",
    "Laboratory", "Main Store (Fl.4)", "Medical Equipment", "Medical Imaging Center", "Medical Record",
    "Neonatal Intensive Care Unit & Nursery", "Neurology Clinic", "Nuclear Medicine", "Nutrition",
    "Obstetrics And Gynecology Clinic", "Oncology Center", "Operating Theatre", "Orthopedic Center",
    "Pediatric Center", "Pharmacy Department", "Physical Medicine And Rehabilitation Center", "Porter",
    "Post - Anesthetic Care Unit", "Preoperative Assessment And Pain Clinic", "Radiation Oncology Center",
    "Simulation Center", "Support Services", "Surgery And Urology Clinic", "Ward 16B", "Ward 17AB", "Ward 20B",
    "Ward 21AB", "Ward 22 (VIP)", "."
];

const returnForm = $('#returnForm');
const returnDeptSelect = $('#returnDept');
const mpcCodeList = $('#mpcCodeList');
const addMpcBtn = $('#addMpcBtn');
const scanQrBtn = $('#scanQrBtn');
const qrReaderContainer = $('#qr-reader-container');

function createMpcInput(value = "MPC-") {
    const div = document.createElement('div');
    div.className = 'mpc-input-group';
    div.innerHTML = `
        <input type="text" class="mpc-code-input" value="${value}" required>
        <button type="button" class="btn secondary btn-remove-mpc">Delete</button>
    `;
    mpcCodeList.appendChild(div);

    div.querySelector('.btn-remove-mpc').addEventListener('click', () => {
        div.remove();
    });
}

function setupReturnPage() {
    returnDeptSelect.innerHTML = '<option value="">เลือก</option>' + departmentList.map(dept => `<option>${dept}</option>`).join('');
    mpcCodeList.innerHTML = '';
    createMpcInput();
}

returnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const returnerName = $('#returner').value.trim();
    const returnerDept = $('#returnDept').value.trim();
    const notes = $('#returnNotes').value.trim();

    const mpcCodes = [...$$('.mpc-code-input')].map(input => input.value.trim()).filter(code => code !== '' && code !== 'MPC-');

    if (!returnerName || !returnerDept || mpcCodes.length === 0) {
        alert('กรุณากรอกข้อมูลให้ครบ: ชื่อผู้คืน, แผนก, และ MPC Code อย่างน้อย 1 รายการ');
        return;
    }

    const payload = {
        employeeNo: returnerName,
        mpcCodes: mpcCodes,
        by: returnerName,
        department: returnerDept,
        note: notes
    };

    const res = await postData('recordReturn', payload);
    if (res.success) {
        alert('บันทึกการคืนสำเร็จ');
        returnForm.reset();
        setupReturnPage();
    } else {
        alert('เกิดข้อผิดพลาด: ' + res.message);
    }
});

addMpcBtn.addEventListener('click', () => {
    if (html5QrCodeScanner) {
        html5QrCodeScanner.stop();
        qrReaderContainer.style.display = 'none';
    }
    createMpcInput();
});

let html5QrCodeScanner = null;

function getFixedCamera(cameras) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    console.log(isMobile);


    if (isMobile) {
        // กล้องหลัง (พยายามหา "back")
        const backCam = cameras.find(cam => cam.label.toLowerCase().includes("back"));
        return backCam ? backCam.id : null; // fallback: ตัวแรก
    } else {
        // Desktop → กล้องหน้า (พยายามหา "front" หรือ "integrated")
        const frontCam = cameras.find(cam =>
            cam.label.toLowerCase().includes("front") ||
            cam.label.toLowerCase().includes("integrated")
        );
        return frontCam ? frontCam.id : cameras[0].id; // fallback: ตัวแรก
    }
}

scanQrBtn.addEventListener('click', async () => {
    if (qrReaderContainer.style.display === 'none') {
        qrReaderContainer.style.display = 'block';

        if (!html5QrCodeScanner) {
            html5QrCodeScanner = new Html5Qrcode("qr-reader");
        }

        try {
            const cameras = await Html5Qrcode.getCameras();

            if (cameras.length > 0) {
                const cameraId = getFixedCamera(cameras);
                console.log("Using fixed camera:", cameraId);

                html5QrCodeScanner.start(
                    cameraId,
                    { qrbox: 250, fps: 10 },
                    (decodedText) => {
                        console.log("QR code detected: ", decodedText);
                        createMpcInput(decodedText);

                        html5QrCodeScanner.stop().then(() => {
                            qrReaderContainer.style.display = 'none';
                        });
                    },
                    (errorMessage) => {
                        console.error("QR Scan error: ", errorMessage);
                    }
                );
            } else {
                alert('ไม่พบกล้องในอุปกรณ์');
                qrReaderContainer.style.display = 'none';
            }
        } catch (err) {
            console.error("Camera access error: ", err);
            alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการตั้งค่าของเบราว์เซอร์');
            qrReaderContainer.style.display = 'none';
        }
    } else {
        html5QrCodeScanner.stop().then(() => {
            qrReaderContainer.style.display = 'none';
        });
    }
});




document.addEventListener('DOMContentLoaded', () => {
    const activeTab = document.querySelector('.tab.active');
    const deptSelect = $('#dept');
    deptSelect.innerHTML = '<option value="">เลือก</option>' + departmentList.map(dept => `<option>${dept}</option>`).join('');

    if (activeTab) {
        if (activeTab.dataset.tab === 'check') {
            loadRequests();
        } else if (activeTab.dataset.tab === 'return') {
            setupReturnPage();
        }
    } else {
        document.getElementById('panel-borrow').hidden = false;
    }
});