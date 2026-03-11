
const { createApp } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    data() {
        return {
            globalState, 
            sharedMethods,
            profileData: {
                full_name: '',
                email: '',
                phone_number: '',
                gender: '',
                date_of_birth: '',
                about_me: '',
                medical_history: '',
                profile_pic: '/static/images/default-profile.svg',
                age: ''
            },
            editing: false,
            
            
            showCropModal: false,
            cropImageSrc: '',
            cropperInstance: null
        };
    },
    mounted() {
        this.fetchProfile();
    },
    methods: {
        async fetchProfile() {
            try {
                const res = await fetch('/patient/api/profile');
                if (res.ok) {
                    const data = await res.json();
                    this.profileData = data;
                } else {
                    sharedMethods.showToast("Failed to load profile.", "error");
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
                sharedMethods.showToast("Connection error loading profile.", "error");
            }
        },
        async saveProfile() {
            try {
                const res = await fetch('/patient/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.profileData)
                });
                if (res.ok) {
                    const data = await res.json();
                    sharedMethods.showToast(data.message || "Profile updated successfully!");
                    this.editing = false;
                    this.fetchProfile();
                } else {
                    const err = await res.json();
                    sharedMethods.showToast(err.message || "Failed to update profile.", "error");
                }
            } catch (error) {
                console.error("Error saving profile:", error);
                sharedMethods.showToast("Connection error. Try again.", "error");
            }
        },
        triggerImageUpload() {
            this.$refs.imageInput.click();
        },
        onImageSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                sharedMethods.showToast("Please select an image file.", "warning");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.cropImageSrc = e.target.result;
                this.showCropModal = true;
                
                
                this.$nextTick(() => {
                    if (this.cropperInstance) {
                        this.cropperInstance.destroy();
                    }
                    this.cropperInstance = new Cropper(this.$refs.cropImg, {
                        aspectRatio: 1,
                        viewMode: 1,
                        autoCropArea: 1,
                    });
                });
            };
            reader.readAsDataURL(file);
        },
        async applyCrop() {
            if (!this.cropperInstance) return;

            const canvas = this.cropperInstance.getCroppedCanvas({
                width: 300,
                height: 300
            });

            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('profile_pic', blob, 'profile.jpg');

                try {
                    const res = await fetch('/patient/api/profile/upload-image', {
                        method: 'POST',
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        this.profileData.profile_pic = data.url;
                        
                        const sidebarImg = document.querySelector('.patient-avatar');
                        if (sidebarImg) sidebarImg.src = data.url;
                        
                        this.showCropModal = false;
                        sharedMethods.showToast("Profile picture updated!");
                    } else {
                        const err = await res.json();
                        sharedMethods.showToast(err.message || "Upload failed.", "error");
                    }
                } catch (error) {
                    console.error("Error uploading image:", error);
                    sharedMethods.showToast("Upload failed.", "error");
                }
            }, 'image/jpeg', 0.9);
        },
        async removeProfilePic() {
            if (!confirm("Remove profile picture?")) return;
            
            this.profileData.profile_pic = '/static/images/default-profile.svg';
            
            
            const sidebarImg = document.querySelector('.patient-avatar');
            if (sidebarImg) sidebarImg.src = this.profileData.profile_pic;
            
            this.saveProfile();
        }
    }
}).mount('#patient-app');
