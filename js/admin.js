import { db, auth } from './firebase-config.js';

class AdminManager {
    constructor() {
        this.currentUser = null;
        this.editingPost = null;
        
        this.init();
    }
    
    async init() {
        // Check auth state
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.showDashboard();
                this.loadPosts();
                this.setupEventListeners();
            } else {
                this.showLogin();
            }
        });
    }
    
    async login(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async logout() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    showLogin() {
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('dashboard-container').classList.add('hidden');
    }
    
    showDashboard() {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
    }
    
    showError(message) {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 3000);
    }
    
    async loadPosts() {
        try {
            const snapshot = await db.collection('posts')
                .orderBy('createdAt', 'desc')
                .get();
            
            const postsList = document.getElementById('posts-list');
            let html = '';
            
            if (snapshot.empty) {
                html = '<p>No posts yet.</p>';
            } else {
                snapshot.forEach(doc => {
                    const post = doc.data();
                    const date = post.createdAt?.toDate().toLocaleDateString() || 'No date';
                    
                    html += `
                        <div class="post-item" data-id="${doc.id}">
                            <div>
                                <h3>${post.title}</h3>
                                <p>${date} • 
                                    <span class="post-status ${post.published ? 'status-published' : 'status-draft'}">
                                        ${post.published ? 'Published' : 'Draft'}
                                    </span>
                                </p>
                            </div>
                            <div class="post-actions">
                                <button class="btn-sm btn-edit" data-id="${doc.id}">Edit</button>
                                <button class="btn-sm btn-toggle" data-id="${doc.id}">
                                    ${post.published ? 'Unpublish' : 'Publish'}
                                </button>
                                <button class="btn-sm btn-delete" data-id="${doc.id}">Delete</button>
                            </div>
                        </div>
                    `;
                });
            }
            
            postsList.innerHTML = html;
            
            // Add action listeners
            this.setupPostActionListeners();
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts');
        }
    }
    
    async savePost(e) {
        e.preventDefault();
        
        const postData = {
            title: document.getElementById('post-title').value,
            slug: document.getElementById('post-slug').value,
            excerpt: document.getElementById('post-excerpt').value,
            content: document.getElementById('post-content').value,
            categories: document.getElementById('post-categories').value
                .split(',')
                .map(cat => cat.trim())
                .filter(cat => cat),
            imageUrl: document.getElementById('post-image').value,
            published: document.getElementById('post-published').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (!postData.title || !postData.content) {
            this.showError('Title and content are required');
            return;
        }
        
        try {
            if (this.editingPost) {
                // Update existing post
                await db.collection('posts').doc(this.editingPost).update(postData);
                this.showError('Post updated successfully');
            } else {
                // Create new post
                postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                postData.authorId = this.currentUser.uid;
                
                await db.collection('posts').add(postData);
                this.showError('Post created successfully');
            }
            
            // Clear form
            this.clearForm();
            
            // Reload posts
            this.loadPosts();
            
        } catch (error) {
            console.error('Error saving post:', error);
            this.showError('Failed to save post');
        }
    }
    
    async editPost(postId) {
        try {
            const doc = await db.collection('posts').doc(postId).get();
            
            if (doc.exists) {
                const post = doc.data();
                this.editingPost = postId;
                
                // Fill form
                document.getElementById('post-title').value = post.title || '';
                document.getElementById('post-slug').value = post.slug || '';
                document.getElementById('post-excerpt').value = post.excerpt || '';
                document.getElementById('post-content').value = post.content || '';
                document.getElementById('post-categories').value = post.categories?.join(', ') || '';
                document.getElementById('post-image').value = post.imageUrl || '';
                document.getElementById('post-published').checked = post.published || false;
                
                // Scroll to form
                document.getElementById('post-form').scrollIntoView();
            }
        } catch (error) {
            console.error('Error loading post:', error);
            this.showError('Failed to load post');
        }
    }
    
    async togglePublish(postId) {
        try {
            const doc = await db.collection('posts').doc(postId).get();
            
            if (doc.exists) {
                const post = doc.data();
                await db.collection('posts').doc(postId).update({
                    published: !post.published,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.loadPosts();
            }
        } catch (error) {
            console.error('Error toggling publish:', error);
            this.showError('Failed to update post');
        }
    }
    
    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            await db.collection('posts').doc(postId).delete();
            this.loadPosts();
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showError('Failed to delete post');
        }
    }
    
    clearForm() {
        document.getElementById('post-form').reset();
        this.editingPost = null;
    }
    
    setupEventListeners() {
        // Login
        document.getElementById('login-btn')?.addEventListener('click', () => {
            const email = document.getElementById('email-input').value;
            const password = document.getElementById('password-input').value;
            this.login(email, password);
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
            });
        });
        
        // Post form
        document.getElementById('post-form')?.addEventListener('submit', (e) => {
            this.savePost(e);
        });
        
        // Clear form
        document.getElementById('clear-form')?.addEventListener('click', () => {
            this.clearForm();
        });
    }
    
    setupPostActionListeners() {
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.editPost(postId);
            });
        });
        
        // Toggle publish buttons
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.togglePublish(postId);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.deletePost(postId);
            });
        });
    }
}

// Initialize admin when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const admin = new AdminManager();
    window.admin = admin; // For debugging
});