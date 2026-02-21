/**
 * admin_appointments.js
 * Analytics, Filtering, Searching, Local Pagination, and CSV Export.
 */

document.addEventListener('DOMContentLoaded', () => {
    let trendChart, statusChart;
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    const tableBody = document.getElementById('apptTableBody');
    const patientSearch = document.getElementById('patientSearch');
    
    // State management
    let currentData = []; // Full filtered list
    let filteredData = []; // Data after search
    let currentPage = 1;
    const entriesPerPage = 10;

    // --- 1. INITIALIZE FILTERS ---
    const fp = flatpickr("#dateRangePicker", {
        mode: "range",
        dateFormat: "Y-m-d",
        onClose: (selectedDates) => {
            if (selectedDates.length === 2) {
                const start = selectedDates[0].toISOString().split('T')[0];
                const end = selectedDates[1].toISOString().split('T')[0];
                document.getElementById('presetFilters').value = "";
                refreshData(null, start, end);
            }
        }
    });

    document.getElementById('presetFilters').addEventListener('change', (e) => {
        if (e.target.value) {
            fp.clear();
            refreshData(e.target.value);
        }
    });

    // --- 2. DATA FETCHING ---
    async function refreshData(days = 30, start = null, end = null) {
        let url = `/api/admin/appointment-stats?days=${days}`;
        if (start && end) {
            url = `/api/admin/appointment-stats?start_date=${start}&end_date=${end}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            currentData = data.appointments || [];
            filteredData = [...currentData]; // Initially no search filter
            currentPage = 1;
            
            renderCharts(data);
            displayTablePage();
        } catch (error) {
            console.error("Error loading analytics data:", error);
        }
    }

    // --- 3. PAGINATION & TABLE LOGIC ---
    function displayTablePage() {
        tableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * entriesPerPage;
        const endIndex = startIndex + entriesPerPage;
        const pageItems = filteredData.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No records found.</td></tr>';
            updatePaginationControls(0);
            return;
        }

        pageItems.forEach(appt => {
            const row = `
                <tr>
                    <td>${appt.date}</td>
                    <td><strong>${appt.patient}</strong></td>
                    <td>${appt.doctor}</td>
                    <td><span class="status-badge status-${appt.status.toLowerCase()}">${appt.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewDetails(${appt.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

        updatePaginationControls(filteredData.length);
    }

    function updatePaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / entriesPerPage);
        const controls = document.getElementById('paginationControls');
        const info = document.getElementById('paginationInfo');
        
        controls.innerHTML = '';
        const start = totalItems === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1;
        const end = Math.min(currentPage * entriesPerPage, totalItems);
        info.textContent = `Showing ${start} to ${end} of ${totalItems} entries`;

        if (totalPages <= 1) return;

        // Previous Button
        controls.insertAdjacentHTML('beforeend', `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Prev</a>
            </li>
        `);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                controls.insertAdjacentHTML('beforeend', `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                    </li>
                `);
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                controls.insertAdjacentHTML('beforeend', `<li class="page-item disabled"><span class="page-link">...</span></li>`);
            }
        }

        // Next Button
        controls.insertAdjacentHTML('beforeend', `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
            </li>
        `);
    }

    window.changePage = (page) => {
        const totalPages = Math.ceil(filteredData.length / entriesPerPage);
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        displayTablePage();
    };

    // --- 4. SEARCH ---
    patientSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredData = currentData.filter(appt => 
            appt.patient.toLowerCase().includes(term) || 
            appt.doctor.toLowerCase().includes(term)
        );
        currentPage = 1;
        displayTablePage();
    });

    // --- 5. CSV EXPORT (Targeted Data) ---
    document.getElementById('downloadCSV').addEventListener('click', () => {
        if (filteredData.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = ["Date & Time", "Patient Name", "Doctor Name", "Status"];
        const rows = filteredData.map(appt => [
            `"${appt.date}"`,
            `"${appt.patient}"`,
            `"${appt.doctor}"`,
            `"${appt.status}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `HMS_Appointments_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // --- 6. CHARTS ---
    function renderCharts(data) {
        if (trendChart) trendChart.destroy();
        if (statusChart) statusChart.destroy();

        trendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: data.line_chart.map(d => d.date),
                datasets: [{
                    label: 'Appointments',
                    data: data.line_chart.map(d => d.count),
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }
            }
        });

        // FIX: Match colors specifically to labels
        const statusLabels = Object.keys(data.status_pie);
        const colorMap = {
            'Booked': '#4e73df',    // Blue
            'Completed': '#1cc88a', // Green
            'Cancelled': '#e74a3b'  // Red
        };
        const backgroundColors = statusLabels.map(label => colorMap[label] || '#858796');

        statusChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: Object.values(data.status_pie),
                    backgroundColor: backgroundColors // Applied fixed colors
                }]
            },
            options: { maintainAspectRatio: false, cutout: '70%' }
        });
    }


    window.viewDetails = async (id) => {
        const modal = new bootstrap.Modal(document.getElementById('apptDetailModal'));
        document.getElementById('modalContentLoader').style.display = 'block';
        document.getElementById('modalActualContent').style.display = 'none';
        modal.show();
        try {
            const res = await fetch(`/api/admin/appointment-details/${id}`);
            const d = await res.json(); // FIXED loading bug
            document.getElementById('modalContentLoader').style.display = 'none';
            const content = document.getElementById('modalActualContent');
            content.style.display = 'block';
            content.innerHTML = `
                <div class="modal-header bg-primary text-white border-0">
                    <h5 class="modal-title fw-bold">Appointment Record #${d.id}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="row mb-4">
                        <div class="col-6 border-end text-center">
                            <img src="${d.patient.pic}" class="rounded-circle mb-2" style="width:60px;height:60px;object-fit:cover;border:2px solid #eee;">
                            <h6 class="fw-bold mb-0">${d.patient.name}</h6>
                            <p class="small text-muted">${d.patient.email}</p>
                        </div>
                        <div class="col-6 text-center">
                            <img src="${d.doctor.pic}" class="rounded-circle mb-2" style="width:60px;height:60px;object-fit:cover;border:2px solid #eee;">
                            <h6 class="fw-bold mb-0">${d.doctor.name}</h6>
                            <p class="small text-muted">${d.doctor.dept}</p>
                        </div>
                    </div>
                    <div class="bg-light p-3 rounded-3 mb-3"><h6>Diagnosis</h6><p>${d.treatment.diagnosis}</p></div>
                    <div class="bg-light p-3 rounded-3"><h6>Prescription</h6><p class="text-success fw-bold">${d.treatment.prescription}</p></div>
                </div>
                <div class="modal-footer bg-light border-0">
                    <button class="btn btn-dark rounded-pill px-4" onclick="exportAppointmentPDF(${JSON.stringify(d).replace(/"/g, '&quot;')})">Export PDF</button>
                </div>`;
        } catch (err) { console.error(err); }
    };

    const toBase64 = url => fetch(url)
        .then(res => res.blob())
        .then(blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        })).catch(() => "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    window.exportAppointmentPDF = async (data) => {
        const element = document.getElementById('pdfExportTemplate');
        const toast = document.createElement('div');
        toast.innerHTML = '<div style="position:fixed;top:20px;right:20px;padding:15px;background:#333;color:white;border-radius:8px;z-index:10000;">Generating Sharp PDF...</div>';
        document.body.appendChild(toast);

        try {
            document.getElementById('pdfApptId').innerText = data.id;
            document.getElementById('pdfDate').innerText = data.date;
            document.getElementById('pdfStatus').innerText = data.status.toUpperCase();
            document.getElementById('pdfPatientName').innerText = data.patient.name;
            document.getElementById('pdfPatientEmail').innerText = data.patient.email;
            document.getElementById('pdfPatientContact').innerText = data.patient.contact;
            document.getElementById('pdfClinicalNotes').innerText = data.patient.clinical_notes;
            document.getElementById('pdfDocName').innerText = data.doctor.name;
            document.getElementById('pdfDocEmail').innerText = data.doctor.email;
            document.getElementById('pdfDocDept').innerText = data.doctor.dept;
            document.getElementById('pdfDiagnosis').innerText = data.treatment.diagnosis;
            document.getElementById('pdfPrescription').innerText = data.treatment.prescription;

            // Load images as Base64 to prevent cutting/missing
            const [pBase64, dBase64] = await Promise.all([toBase64(data.patient.pic), toBase64(data.doctor.pic)]);
            document.getElementById('pdfPatientImg').src = pBase64;
            document.getElementById('pdfDocImg').src = dBase64;

            element.style.display = 'block';

            const opt = {
                margin: 0,
                filename: `HMS_Report_${data.patient.name.replace(/\s+/g, '_')}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 794 },
                jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait', hotfixes: ['px_scaling'] }
            };

            await html2pdf().set(opt).from(element).save();
        } finally {
            element.style.display = 'none';
            document.body.removeChild(toast);
        }
    };

    refreshData(30);
});