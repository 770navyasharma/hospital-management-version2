document.addEventListener('DOMContentLoaded', () => {
    let charts = {};
    let dashboardData = {};
    let allDoctors = [];
    let selectedDoctorId = null;
    let selectedSchedDates = [new Date().toISOString().split('T')[0]];

    // 1. Initialize Date Range Picker for Global Stats
    const fpGlobal = flatpickr("#dashboardRange", {
        mode: "range",
        defaultDate: [new Date(new Date().setDate(new Date().getDate() - 30)), new Date()],
        dateFormat: "Y-m-d",
        onClose: (dates) => {
            if (dates.length === 2) {
                updateDashboard(dates[0].toISOString().split('T')[0], dates[1].toISOString().split('T')[0]);
            }
        }
    });

    // 2. Initialize Scheduler Components
    const fpSched = flatpickr("#schedDatePicker", {
        mode: "multiple",
        defaultDate: ["today"],
        dateFormat: "Y-m-d",
        onChange: (dates, dateStr) => {
            selectedSchedDates = dateStr.split(', ').filter(d => d);
            if (selectedDoctorId) fetchDoctorSchedule(selectedDoctorId);
        }
    });

    // 3. Main Dashboard Updater
    async function updateDashboard(start, end) {
        document.querySelectorAll('.chart-card').forEach(c => c.style.opacity = '0.6');
        try {
            const res = await fetch(`/api/admin/dashboard-stats?start_date=${start}&end_date=${end}`);
            dashboardData = await res.json();
            
            if (dashboardData.totals) {
                document.querySelector('.card-patients .stat-number').innerText = dashboardData.totals.patients;
                document.querySelector('.card-doctors .stat-number').innerText = dashboardData.totals.doctors;
                document.querySelector('.card-appointments .stat-number').innerText = dashboardData.totals.appointments;
            }

            renderCharts(dashboardData);
        } finally {
            document.querySelectorAll('.chart-card').forEach(c => c.style.opacity = '1');
        }
    }

    // 4. Chart Rendering Logic
    function renderCharts(data) {
        // --- Status Doughnut Chart ---
        const statusCtx = document.getElementById('statusDoughnutChart').getContext('2d');
        const statusLabels = Object.keys(data.status_distribution);
        const statusValues = Object.values(data.status_distribution);
        const hasStatusData = statusValues.some(v => v > 0);

        if (charts.status) charts.status.destroy();
        charts.status = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: hasStatusData ? statusLabels : ['No Data'],
                datasets: [{
                    data: hasStatusData ? statusValues : [1],
                    backgroundColor: hasStatusData ? ['#4e73df', '#1cc88a', '#f6c23e', '#e74a3b', '#36b9cc'] : ['#f1f5f9'],
                    borderWidth: 0,
                    cutout: '75%',
                    borderRadius: 8
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { weight: 'bold' } } }
                }
            }
        });

        // --- Department Horizontal Bar Chart ---
        const deptCtx = document.getElementById('deptHorizontalBarChart').getContext('2d');
        const deptLabels = data.dept_stats.map(d => d.name);
        
        if (charts.dept) charts.dept.destroy();
        charts.dept = new Chart(deptCtx, {
            type: 'bar',
            data: {
                labels: deptLabels,
                datasets: [
                    {
                        label: 'Specialists',
                        data: data.dept_stats.map(d => d.doctors),
                        backgroundColor: '#4e73df',
                        borderRadius: 6
                    },
                    {
                        label: 'Clinical Patients',
                        data: data.dept_stats.map(d => d.patients),
                        backgroundColor: '#1cc88a',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { weight: 'bold' } } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { stepSize: 1 } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // 5. Scheduler Logic
    async function initScheduler() {
        try {
            const res = await fetch('/api/admin/doctors-list');
            allDoctors = await res.json();
            const selector = document.getElementById('doctorSelector');
            allDoctors.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.name;
                selector.appendChild(opt);
            });

            selector.addEventListener('change', (e) => {
                selectedDoctorId = e.target.value;
                if (selectedDoctorId) {
                    document.getElementById('schedulerEmptyState').style.display = 'none';
                    document.getElementById('schedulerContent').style.display = 'block';
                    fetchDoctorSchedule(selectedDoctorId);
                } else {
                    document.getElementById('schedulerEmptyState').style.display = 'block';
                    document.getElementById('schedulerContent').style.display = 'none';
                }
            });
        } catch (e) {
            console.error("Failed to init scheduler", e);
        }
    }

    async function fetchDoctorSchedule(id) {
        const container = document.getElementById('slotsResultsContainer');
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
        
        try {
            const res = await fetch(`/api/admin/doctor-schedule/${id}`);
            const data = await res.json();
            currentLoadedSchedule = data;
            
            const doctor = data.doctor_info;
            document.getElementById('schedDocName').textContent = doctor.name;
            document.getElementById('schedDocDept').textContent = doctor.dept;
            document.getElementById('schedDocPic').src = doctor.pic || '/static/images/default-profile.svg';
            
            container.innerHTML = '';

            if (selectedSchedDates.length === 0) {
                container.innerHTML = '<div class="text-center py-5 text-muted fw-bold">Select one or more dates to view availability.</div>';
                return;
            }

            // Iterate over selected dates
            selectedSchedDates.forEach(dateStr => {
                const availability = data.availability[dateStr] || [];
                const appointments = data.appointments.filter(a => a.date === dateStr);
                
                const dateParts = dateStr.split('-');
                const displayTitle = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                const section = document.createElement('div');
                section.className = 'date-section-card shadow-sm animate-fade-in';
                
                let slotsHtml = '';
                if (availability.length === 0) {
                    slotsHtml = '<div class="smallest fw-bold text-muted py-2 italic">Not available on this date.</div>';
                } else {
                    slotsHtml = '<div class="sched-grid">';
                    availability.forEach(slot => {
                        const [start, end] = slot.split('-');
                        const isBooked = appointments.some(a => a.time === start);
                        slotsHtml += `
                            <div class="sched-slot-item ${isBooked ? 'busy' : 'available'}">
                                <div class="status-indicator ${isBooked ? 'busy' : 'open'}">${isBooked ? 'OCCUPIED' : 'OPEN'}</div>
                                <div class="time-range">${start} - ${end}</div>
                            </div>
                        `;
                    });
                    slotsHtml += '</div>';
                }

                section.innerHTML = `
                    <div class="date-section-header">
                        <span class="smallest fw-black text-primary text-uppercase ls-1">${displayTitle}</span>
                        <span class="smallest fw-bold text-muted">${availability.length} Slots</span>
                    </div>
                    ${slotsHtml}
                `;
                container.appendChild(section);
            });

        } catch (e) {
            console.error("Scheduler fetch error:", e);
            container.innerHTML = '<div class="alert alert-danger mx-3">Error loading schedule data.</div>';
        }
    }

    let currentLoadedSchedule = null;

    // 6. Global Exports
    window.exportAppointmentStats = () => {
        if (!dashboardData.status_distribution) return;
        let csv = "data:text/csv;charset=utf-8,Status,Count\n";
        Object.entries(dashboardData.status_distribution).forEach(([status, count]) => {
            csv += `${status},${count}\n`;
        });
        downloadCSV(csv, "Appointment_Status.csv");
    };

    window.exportDeptStats = () => {
        if (!dashboardData.dept_stats) return;
        let csv = "data:text/csv;charset=utf-8,Department,Specialists,Clinical Patients\n";
        dashboardData.dept_stats.forEach(d => {
            csv += `${d.name},${d.doctors},${d.patients}\n`;
        });
        downloadCSV(csv, "Department_Stats.csv");
    };

    window.exportAvailabilityData = () => {
        if (!currentLoadedSchedule || !selectedSchedDates.length) {
            alert("No schedule data loaded to export.");
            return;
        }
        let csv = "data:text/csv;charset=utf-8,Doctor,Department,Date,Time Slot,Status\n";
        const doc = currentLoadedSchedule.doctor_info;
        
        selectedSchedDates.forEach(date => {
            const slots = currentLoadedSchedule.availability[date] || [];
            const appointments = currentLoadedSchedule.appointments.filter(a => a.date === date);
            
            if (slots.length === 0) {
                csv += `${doc.name},${doc.dept},${date},N/A,No slots configured\n`;
            } else {
                slots.forEach(slot => {
                    const [start] = slot.split('-');
                    const isBooked = appointments.some(a => a.time === start);
                    csv += `${doc.name},${doc.dept},${date},${slot},${isBooked ? 'Occupied' : 'Open'}\n`;
                });
            }
        });
        downloadCSV(csv, `${doc.name.replace(/\s+/g, '_')}_Schedule.csv`);
    };

    function downloadCSV(csvContent, filename) {
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Initial Trigger
    initScheduler();
    updateDashboard(fpGlobal.selectedDates[0].toISOString().split('T')[0], fpGlobal.selectedDates[1].toISOString().split('T')[0]);
});