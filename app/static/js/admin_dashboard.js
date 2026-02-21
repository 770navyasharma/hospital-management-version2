document.addEventListener('DOMContentLoaded', () => {
    let charts = {};
    let rawData = {};

    const fp = flatpickr("#dashboardRange", {
        mode: "range",
        defaultDate: [new Date().setDate(new Date().getDate() - 30), new Date()],
        dateFormat: "Y-m-d",
        onClose: (dates) => {
            if (dates.length === 2) {
                updateDashboard(dates[0].toISOString().split('T')[0], dates[1].toISOString().split('T')[0]);
            }
        }
    });

    async function updateDashboard(start, end) {
        // Soft fade animation for cards during data update
        document.querySelectorAll('.chart-card').forEach(c => c.style.opacity = '0.6');
        try {
            const res = await fetch(`/api/admin/dashboard-stats?start_date=${start}&end_date=${end}`);
            rawData = await res.json();
            renderCharts(rawData);
        } finally {
            document.querySelectorAll('.chart-card').forEach(c => c.style.opacity = '1');
        }
    }

    function renderCharts(data) {
        // --- 1. Line Chart with Interaction ---
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        const lineGrad = lineCtx.createLinearGradient(0, 0, 0, 350);
        lineGrad.addColorStop(0, 'rgba(78, 115, 223, 0.2)');
        lineGrad.addColorStop(1, 'rgba(78, 115, 223, 0)');

        if (charts.line) charts.line.destroy();
        charts.line = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: data.appointments.map(d => d.date),
                datasets: [{
                    label: 'Visits',
                    data: data.appointments.map(d => d.count),
                    borderColor: '#4e73df',
                    backgroundColor: lineGrad,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#4e73df',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#4e73df',
                    pointHoverBorderWidth: 3
                }]
            },
            options: { 
                maintainAspectRatio: false,
                // 🟢 ENABLED INTERACTION
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a202c',
                        padding: 12,
                        cornerRadius: 10,
                        titleFont: { size: 14, weight: 'bold' }
                    }
                },
                scales: { 
                    y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });

        // --- 2. Doughnut with Hover Pop ---
        if (charts.doughnut) charts.doughnut.destroy();
        charts.doughnut = new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.patients),
                datasets: [{
                    data: Object.values(data.patients).length ? Object.values(data.patients) : [1],
                    backgroundColor: ['#4e73df', '#1cc88a', '#f6c23e'],
                    hoverOffset: 18,
                    borderWidth: 0
                }]
            },
            options: { 
                maintainAspectRatio: false, 
                cutout: '78%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 25, font: { weight: 'bold' } } } }
            }
        });

        // --- 3. Multi-Bar Chart: Doctor Workload by Status ---
        const barCtx = document.getElementById('barChart').getContext('2d');
        
        // Define Statuses and Colors
        const statuses = ['New', 'Under Treatment', 'Recovered'];
        const colors = ['#4e73df', '#f6c23e', '#1cc88a']; // Blue, Yellow, Green
        
        // Prepare Datasets
        const datasets = statuses.map((status, index) => ({
            label: status,
            data: data.doctors.map(d => d.statuses[status] || 0),
            backgroundColor: colors[index],
            borderRadius: 8,
            barPercentage: 0.9,      // High width
            categoryPercentage: 0.8  // High width
        }));

        if (charts.bar) charts.bar.destroy();
        charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.doctors.map(d => d.name),
                datasets: datasets
            },
            options: { 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { usePointStyle: true, font: { weight: 'bold' } } 
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1a202c',
                        padding: 12,
                        cornerRadius: 10
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        ticks: { stepSize: 1, font: { weight: '600' } } 
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { font: { weight: 'bold' } }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    window.exportToCSV = (type) => {
        let csv = "data:text/csv;charset=utf-8,";
        if (type === 'appointments') {
            csv += "Date,Count\n" + rawData.appointments.map(d => `${d.date},${d.count}`).join("\n");
        } else if (type === 'patients') {
            csv += "Status,Total\n" + Object.entries(rawData.patients).map(([k,v]) => `${k},${v}`).join("\n");
        } else {
            csv = "Doctor Name,New,Under Treatment,Recovered\n" + 
            rawData.doctors.map(d => 
                `${d.name},${d.statuses['New'] || 0},${d.statuses['Under Treatment'] || 0},${d.statuses['Recovered'] || 0}`
            ).join("\n");
        }
        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `HMS_Analytics_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    updateDashboard(fp.selectedDates[0].toISOString().split('T')[0], fp.selectedDates[1].toISOString().split('T')[0]);
});