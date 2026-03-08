(function () {
    const { createApp } = Vue;

    const app = createApp({
        delimiters: ['[[', ']]'],
        data() {
            const shared = window.HMS_DOCTOR_SHARED || { globalState: {}, sharedMethods: {} };
            return {
                globalState: shared.globalState,
                sharedMethods: shared.sharedMethods,
                profileData: {
                    full_name: '',
                    email: '',
                    phone_number: '',
                    department: '',
                    profile_pic: '',
                    degree: '',
                    experience: 0,
                    tagline: '',
                    about_me: '',
                    bio: '',
                    fees: 0,
                    unique_patients: 0
                },
                editing: false,
                showCropModal: false,
                cropImageSrc: '',
                cropper: null
            }
        },
        async mounted() {
            console.log("Profile Page Mounted.");
            if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                await this.sharedMethods.fetchGlobalData();
            }
            await this.fetchProfile();
        },
        methods: {
            async fetchProfile() {
                try {
                    const res = await fetch('/doctor/api/doctor/profile-data');
                    if (!res.ok) {
                        if (res.status === 401 || res.status === 302) {
                            window.location.href = "/login";
                            return;
                        }
                    }
                    this.profileData = await res.json();
                } catch (e) {
                    console.error("Profile Fetch Error:", e);
                }
            },
            async saveProfile() {
                try {
                    const res = await fetch('/doctor/api/doctor/profile-update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.profileData)
                    });
                    if (res.ok) {
                        this.editing = false;
                        this.sharedMethods.showToast('Profile updated successfully!', 'success');
                    }
                } catch (e) {
                    this.sharedMethods.showToast('Failed to save profile', 'error');
                }
            },
            triggerImageUpload() {
                this.$refs.imageInput.click();
            },
            onImageSelect(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.cropImageSrc = event.target.result;
                        this.showCropModal = true;
                        this.$nextTick(() => {
                            this.initCropper();
                        });
                    };
                    reader.readAsDataURL(file);
                }
            },
            initCropper() {
                if (this.cropper) {
                    this.cropper.destroy();
                }
                const img = this.$refs.cropImg;
                this.cropper = new Cropper(img, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    guides: true,
                    center: true,
                    autoCropArea: 1,
                    movable: true,
                    zoomable: true,
                    rotatable: false,
                    scalable: false
                });
            },
            applyCrop() {
                const canvas = this.cropper.getCroppedCanvas({
                    width: 512,
                    height: 512
                });
                const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                this.sharedMethods.showToast('Uploading image...', 'warning');

                fetch('/doctor/api/doctor/profile-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: croppedDataUrl })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            this.profileData.profile_pic = data.profile_pic;
                            this.showCropModal = false;
                            this.sharedMethods.showToast('Profile picture saved!', 'success');
                        } else {
                            this.sharedMethods.showToast(data.message || 'Upload failed', 'error');
                        }
                    })
                    .catch(e => {
                        this.sharedMethods.showToast('Connection error during upload', 'error');
                    });
            },
            getStatusColor(status) {
                if (this.sharedMethods && this.sharedMethods.getStatusColor) {
                    return this.sharedMethods.getStatusColor(status);
                }
                return '#858796';
            }
        }
    });

    // Register shared directives
    if (window.HMS_DOCTOR_SHARED && window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives) {
        window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives(app);
    }

    app.mount('#doctor-app');
})();
