
const { createApp } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    directives: { 'click-outside': clickOutside },
    data() {
        return {
            globalState,
            sharedMethods,
            showBookingModal: false,
            showCancelModal: false,
            cancelApptId: null,
            cancelReason: '',
            selectedDoctor: null,
            selectedDate: '',
            selectedSlot: '',
            availableSlots: [],
            bookedIntervals: [],
            isUrgent: false,
            urgentNote: '',
            medicalHistory: '',
            loading: false,
            myAppointments: [],
            sliderIndex: 0,
            selectedTime: '',
            timePicker: null,
            showDetailModal: false,
            selectedDoc: null,
            todaySlots: [],
            selectedHistoryAppt: null,
            previewState: {
                show: false,
                path: '',
                type: '',
                name: ''
            }
        }
    },
    watch: {
        selectedSlot(newSlot) {
            if (newSlot) {
                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                let minTime = newSlot.start;

                
                if (this.selectedDate === todayStr) {
                    const currentH = now.getHours().toString().padStart(2, '0');
                    const currentM = now.getMinutes().toString().padStart(2, '0');
                    const currentTime = `${currentH}:${currentM}`;
                    if (currentTime > minTime) {
                        minTime = currentTime;
                    }
                }

                this.selectedTime = minTime;

                this.$nextTick(() => {
                    const el = document.getElementById("specificTime");
                    if (el) {
                        if (this.timePicker) this.timePicker.destroy();
                        this.timePicker = flatpickr("#specificTime", {
                            enableTime: true,
                            noCalendar: true,
                            dateFormat: "H:i",
                            time_24hr: true,
                            defaultDate: minTime,
                            minTime: minTime,
                            maxTime: newSlot.end,
                            onChange: (selectedDates, timeStr) => {
                                this.selectedTime = timeStr;
                            }
                        });
                    }
                });
            } else {
                this.selectedTime = '';
                if (this.timePicker) {
                    this.timePicker.destroy();
                    this.timePicker = null;
                }
            }
        }
    },
    computed: {
        activeAppointments() {
            return this.myAppointments.filter(a => ['Booked', 'Ongoing', 'Completed'].includes(a.status));
        },
        requestedAppointments() {
            return this.myAppointments.filter(a => a.status === 'Requested');
        },
        completedAppointments() {
            return this.myAppointments.filter(a => a.status === 'Completed').sort((a,b) => new Date(b.raw_datetime) - new Date(a.raw_datetime));
        },
        currentActiveAppt() {
            return this.activeAppointments[this.sliderIndex] || null;
        }
    },
    mounted() {
        this.doctors = window.doctorData || [];
        this.loadAppointments();
    },
    methods: {
        async loadAppointments() {
            try {
                const res = await fetch('/patient/api/appointments');
                if (res.ok) {
                    this.myAppointments = await res.json();
                    if (this.sliderIndex >= this.activeAppointments.length) {
                        this.sliderIndex = 0;
                    }
                }
            } catch (e) {
                console.error("Failed to load appointments:", e);
            }
        },

        nextSlide() {
            if (this.sliderIndex < this.activeAppointments.length - 1) {
                this.sliderIndex++;
            } else {
                this.sliderIndex = 0;
            }
        },

        prevSlide() {
            if (this.sliderIndex > 0) {
                this.sliderIndex--;
            } else {
                this.sliderIndex = this.activeAppointments.length - 1;
            }
        },

        async seeFullDetails(doctor) {
            this.selectedDoc = doctor;
            this.todaySlots = [];
            
            
            const modalEl = document.getElementById('doctorDetailModal');
            let modalBus = bootstrap.Modal.getInstance(modalEl);
            if (!modalBus) modalBus = new bootstrap.Modal(modalEl);
            modalBus.show();
            
            
            const today = new Date().toISOString().split('T')[0];
            try {
                const res = await fetch(`/patient/api/doctor-availability/${doctor.id}/${today}`);
                if (res.ok) {
                    const data = await res.json();
                    this.todaySlots = data.available_slots || [];
                }
            } catch (e) {
                console.error("Failed to fetch today's slots:", e);
            }
        },

        openBookingModal(doctor) {
            this.selectedDoctor = doctor;
            this.selectedDate = '';
            this.selectedSlot = '';
            this.availableSlots = [];
            this.bookedIntervals = []; 
            this.isUrgent = false;
            this.urgentNote = '';
            this.medicalHistory = '';
            this.showBookingModal = true;

            
            const detailModalEl = document.getElementById('doctorDetailModal');
            if (detailModalEl) {
                const modalBus = bootstrap.Modal.getInstance(detailModalEl);
                if (modalBus) modalBus.hide();
            }

            this.$nextTick(() => {
                flatpickr("#inlineBookingCalendar", {
                    inline: true,
                    minDate: "today",
                    dateFormat: "Y-m-d",
                    onChange: (selectedDates, dateStr) => {
                        this.selectedDate = dateStr;
                        this.selectedSlot = null;
                        this.fetchAvailableSlots();
                    }
                });
            });
        },

        async fetchAvailableSlots() {
            if (!this.selectedDoctor || !this.selectedDate) return;

            try {
                const res = await fetch(`/patient/api/doctor-availability/${this.selectedDoctor.id}/${this.selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    this.availableSlots = data.available_slots || [];
                    this.bookedIntervals = data.booked_intervals || [];
                } else {
                    this.availableSlots = [];
                    this.bookedIntervals = [];
                }
            } catch (e) {
                console.error("Failed to fetch slots:", e);
                this.availableSlots = [];
                this.bookedIntervals = [];
            }
        },

        selectSlot(slot) {
            this.selectedSlot = slot;
            
            this.selectedTime = slot.start;
        },

        
        timeToMinutes(timeStr) {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        },

        getSlotDurationString(slot) {
            const mins = this.timeToMinutes(slot.end) - this.timeToMinutes(slot.start);
            if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
            return `${mins}m`;
        },

        getBusyIntervalsForSlot(slot) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);

            return this.bookedIntervals.filter(b => {
                const bStart = this.timeToMinutes(b.start);
                const bEnd = this.timeToMinutes(b.end);
                
                return bStart < sEnd && bEnd > sStart;
            });
        },

        getBusyBlockStyle(slot, busy) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const totalWidth = sEnd - sStart;

            const bStart = Math.max(this.timeToMinutes(busy.start), sStart);
            const bEnd = Math.min(this.timeToMinutes(busy.end), sEnd);

            const left = ((bStart - sStart) / totalWidth) * 100;
            const width = ((bEnd - bStart) / totalWidth) * 100;

            return {
                left: `${left}%`,
                width: `${width}%`
            };
        },

        getBusyBlockWidth(slot, busy) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const bStart = Math.max(this.timeToMinutes(busy.start), sStart);
            const bEnd = Math.min(this.timeToMinutes(busy.end), sEnd);
            return ((bEnd - bStart) / (sEnd - sStart)) * 100;
        },

        getSelectionPreviewStyle(slot) {
            if (!this.selectedTime) return { display: 'none' };

            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const totalWidth = sEnd - sStart;

            const selStart = this.timeToMinutes(this.selectedTime);
            const duration = 30; 

            const left = ((selStart - sStart) / totalWidth) * 100;
            const width = (duration / totalWidth) * 100;

            return {
                left: `${left}%`,
                width: `${width}%`,
                borderLeft: '2px solid #4e73df'
            };
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
        },

        formatTime(timeStr) {
            if (!timeStr) return '--:--';
            const [h, m] = timeStr.split(':');
            const hh = parseInt(h);
            const suffix = hh >= 12 ? 'PM' : 'AM';
            const hr = hh % 12 || 12;
            return `${hr}:${m} ${suffix}`;
        },

        async submitBooking() {
            if (!this.selectedSlot) return sharedMethods.showToast("Please select a time slot.", "warning");
            const finalTime = this.selectedTime || this.selectedSlot.start;

            this.loading = true;
            try {
                const res = await fetch('/patient/api/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctor_id: this.selectedDoctor.id,
                        datetime: `${this.selectedDate}T${finalTime}`,
                        is_urgent: this.isUrgent,
                        note: this.urgentNote,
                        medical_history: this.medicalHistory
                    })
                });

                const result = await res.json();
                if (res.ok) {
                    sharedMethods.showToast("Appointment requested successfully!");
                    this.showBookingModal = false;
                    this.loadAppointments();
                } else {
                    sharedMethods.showToast(result.message, "error");
                }
            } catch (e) {
                sharedMethods.showToast("Connection error. Try again.", "error");
            } finally {
                this.loading = false;
            }
        },

        openCancelModal(apptId) {
            this.cancelApptId = apptId;
            this.cancelReason = '';
            this.showCancelModal = true;
        },

        openHistoryModal(appt) {
            this.selectedHistoryAppt = appt;
            this.$nextTick(() => {
                const modalEl = document.getElementById('medicalHistoryModal');
                let modalBus = bootstrap.Modal.getInstance(modalEl);
                if (!modalBus) modalBus = new bootstrap.Modal(modalEl);
                modalBus.show();
            });
        },

        openPreview(file) {
            console.log("HMS_DEBUG: openPreview called with:", JSON.stringify(file));
            if (!file || !file.path) {
                console.error("HMS_DEBUG: Cannot preview - missing path in file:", file);
                sharedMethods.showToast("Attachment path missing.", "error");
                return;
            }

            sharedMethods.showToast("Opening document preview...");
            
            this.previewState.show = false;
            setTimeout(() => {
                this.previewState.path = file.path;
                this.previewState.type = file.type || 'image';
                this.previewState.name = file.name || file.filename || 'Document';
                this.previewState.show = true;
            }, 50);
        },

        closePreview() {
            this.previewState.show = false;
            this.previewState.path = '';
            this.previewState.type = '';
            this.previewState.name = '';
        },

        async generatePDF(appt) {
            try {
                if (!window.jspdf) {
                    return sharedMethods.showToast("PDF Library loading, please try again in a moment.", "warning");
                }
                
                
                const data = {
                    patient_name: "Patient (Self)",
                    patient_pic: '', 
                    patient_gender: '',
                    patient_age: '',
                    doctor_pic: appt.doctor_profile_pic,
                    doctor_name: `Dr. ${appt.doctor_name || "Assigned Doctor"}`,
                    doctor_dept: appt.doctor_dept,
                    date: appt.raw_date || 'N/A',
                    id: appt.id,
                    complaint: appt.urgent_note || 'General Consultation',
                    patient_history: appt.patient_history,
                    diagnosis: appt.diagnosis,
                    notes: appt.clinical_notes,
                    prescription: appt.prescriptions || []
                };

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const mg = 18;
                let y = 0;

                
                doc.setFillColor(26, 46, 100);
                doc.rect(0, 0, pageW, 40, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text('CLINICAL VISIT REPORT', mg, 18);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text('HMS · Hospital Management System', mg, 26);
                doc.text('Generated: ' + new Date().toLocaleString('en-IN'), mg, 32);

                
                y = 52;
                const photoW = 32;
                const photoH = 32;

                
                doc.setFillColor(240, 242, 248);
                doc.roundedRect(mg, y, photoW, photoH, 3, 3, 'F');
                doc.setFontSize(7);
                doc.setTextColor(140, 150, 190);
                doc.text('PATIENT', mg + photoW / 2, y + photoH / 2, { align: 'center' });

                const pPic = data.patient_pic;
                if (pPic) {
                    try {
                        const absP = pPic.startsWith('http') ? pPic : (window.location.origin + pPic);
                        if (!absP.toLowerCase().endsWith('.svg')) {
                            const b64P = await sharedMethods._fetchImageAsBase64(absP);
                            if (b64P) doc.addImage(b64P, 'JPEG', mg, y, photoW, photoH);
                        }
                    } catch (e) { console.warn("PDF_DEBUG: Patient photo error:", e); }
                }

                
                const dPhotoX = pageW - mg - photoW;
                doc.setFillColor(240, 242, 248);
                doc.roundedRect(dPhotoX, y, photoW, photoH, 3, 3, 'F');
                doc.text('DOCTOR', dPhotoX + photoW / 2, y + photoH / 2, { align: 'center' });

                const dPic = data.doctor_pic;
                if (dPic) {
                    try {
                        const absD = dPic.startsWith('http') ? dPic : (window.location.origin + dPic);
                        if (!absD.toLowerCase().endsWith('.svg')) {
                            const b64D = await sharedMethods._fetchImageAsBase64(absD);
                            if (b64D) doc.addImage(b64D, 'JPEG', dPhotoX, y, photoW, photoH);
                        }
                    } catch (e) { console.warn("PDF_DEBUG: Doctor photo error:", e); }
                }

                
                const centerX = pageW / 2;
                doc.setTextColor(26, 46, 100);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(data.patient_name || 'Patient', centerX, y + 8, { align: 'center' });

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 80, 110);
                const pMeta = [data.patient_gender, data.patient_age ? data.patient_age + ' yrs' : ''].filter(Boolean).join('  ·  ');
                doc.text(pMeta, centerX, y + 16, { align: 'center' });

                doc.setTextColor(26, 46, 100);
                doc.setFont('helvetica', 'bold');
                doc.text('Treated By:', centerX, y + 24, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.text(data.doctor_name || 'Assigned Doctor', centerX, y + 29, { align: 'center' });
                if (data.doctor_dept) {
                    doc.setFontSize(8);
                    doc.setTextColor(120, 120, 140);
                    doc.text(data.doctor_dept, centerX, y + 33, { align: 'center' });
                }

                y = y + photoH + 12;

                
                doc.setDrawColor(210, 215, 235);
                doc.setLineWidth(0.4);
                doc.line(mg, y, pageW - mg, y);
                y += 6;
                doc.setFontSize(8.5);
                doc.setTextColor(100, 100, 120);
                doc.text('Visit Date: ' + (data.date || 'N/A'), mg, y);
                doc.text('Report ID: #CMS-' + data.id + '-' + Math.floor(Math.random() * 1000), pageW - mg, y, { align: 'right' });
                y += 10;

                
                const secHeader = (title, r, g, b) => {
                    if (y > pageH - 35) { doc.addPage(); y = 20; }
                    doc.setFillColor(r || 26, g || 46, b || 100);
                    doc.roundedRect(mg, y, pageW - mg * 2, 8, 1.5, 1.5, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(title.toUpperCase(), mg + 4, y + 5.5);
                    y += 13;
                    doc.setTextColor(40, 40, 60);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                };

                const txtBlock = (txt, bold = false) => {
                    if (!txt || String(txt).trim() === '') return;
                    doc.setFont('helvetica', bold ? 'bold' : 'normal');
                    const lines = doc.splitTextToSize(String(txt), pageW - mg * 2);
                    lines.forEach(ln => {
                        if (y > pageH - 22) { doc.addPage(); y = 20; }
                        doc.text(ln, mg, y);
                        y += 5.5;
                    });
                    y += 3;
                };

                
                const complaint = data.complaint || '';
                if (complaint) { secHeader('Reason for Visit', 70, 80, 160); doc.setFont('helvetica', 'italic'); txtBlock('"' + complaint + '"'); }

                const history = data.patient_history || '';
                if (history) { secHeader('Medical background', 30, 110, 70); txtBlock(history); }

                const diagnosis = data.diagnosis || '';
                if (diagnosis) { secHeader('Diagnosis', 170, 50, 30); txtBlock(diagnosis, true); }

                const notes = data.notes || '';
                if (notes) { secHeader("Clinical Notes", 60, 80, 150); txtBlock(notes); }

                const rxRaw = data.prescription;
                const rxList = Array.isArray(rxRaw) ? rxRaw
                    : (typeof rxRaw === 'string' && rxRaw.length > 0 ? rxRaw.split(/,\s*/) : []);
                if (rxList.length > 0) {
                    secHeader('Prescribed Medications', 28, 140, 90);
                    rxList.forEach((med, i) => {
                        if (y > pageH - 22) { doc.addPage(); y = 20; }
                        doc.setFont('helvetica', 'bold'); doc.text((i + 1) + '.', mg + 2, y);
                        doc.setFont('helvetica', 'normal');
                        const ls = doc.splitTextToSize(med, pageW - mg * 2 - 12);
                        ls.forEach(ln => { doc.text(ln, mg + 9, y); y += 5.5; });
                        y += 1;
                    });
                }

                
                const total = doc.internal.getNumberOfPages();
                for (let i = 1; i <= total; i++) {
                    doc.setPage(i);
                    doc.setFillColor(248, 249, 253);
                    doc.rect(0, pageH - 14, pageW, 14, 'F');
                    doc.setFontSize(7.5);
                    doc.setTextColor(150, 150, 170);
                    doc.text('This clinical report is computer-generated and verified by HMS encrypted systems.', mg, pageH - 7);
                    doc.text('Page ' + i + ' / ' + total, pageW - mg, pageH - 7, { align: 'right' });
                }

                const safeName = (data.patient_name || 'Report').replace(/\s+/g, '_');
                const safeDate = (data.date || new Date().toLocaleDateString('en-IN')).replace(/[\s/]/g, '-');
                doc.save('Clinical_Report_' + safeName + '_' + safeDate + '.pdf');
                sharedMethods.showToast("PDF Downloaded successfully!");
                
            } catch (err) {
                console.error("PDF generation failed:", err);
                sharedMethods.showToast("Failed to generate PDF.", "error");
            }
        },

        async submitCancelAppointment() {
            if (!this.cancelReason.trim()) return;

            this.loading = true;
            try {
                const res = await fetch(`/patient/api/cancel/${this.cancelApptId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: this.cancelReason })
                });

                if (res.ok) {
                    sharedMethods.showToast("Appointment successfully cancelled.");
                    this.showCancelModal = false;
                    this.cancelApptId = null;
                    this.cancelReason = '';
                    this.loadAppointments();
                } else {
                    const data = await res.json();
                    sharedMethods.showToast(data.message || "Failed to cancel.", "error");
                }
            } catch (e) {
                sharedMethods.showToast("Connection error. Try again.", "error");
            } finally {
                this.loading = false;
            }
        },

        convert12to24(time12h) {
            const [time, modifier] = time12h.split(' ');
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
            return `${hours}:${minutes}`;
        }
    }
}).mount('#patient-app');
