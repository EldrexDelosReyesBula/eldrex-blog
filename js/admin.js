// admin-manager.js - Handles admin panel functionality

import { db, auth } from './firebase-config.js';

class AdminManager {
    constructor(auth) {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.editingPost = null;
        this.editingComment = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Check auth state
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    await this.showDashboard();
                    await this.loadStats();
                    await this.loadPosts();
                    this.setupEventListeners();
                } else {
                    this.showLogin();
                }
            });
            
            // Auto-check if already logged in
            const currentUser = this.auth.currentUser;
            if (currentUser) {
                this.currentUser = currentUser;
                await this.showDashboard();
                await this.loadStats();
                await this.loadPosts();
                this.setupEventListeners();
            }
            
        } catch (error) {
            console.error('Admin initialization error:', error);
            this.showMessage('Failed to initialize admin panel', 'error');
        }
    }
    
    async login(email, password) {
        const loginBtn = document.getElementById('login-btn');
        const originalText = loginBtn.textContent;
        
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
            
            await this.auth.signInWithEmailAndPassword(email, password);
            this.showMessage('Login successful!', 'success');
            
            // The auth state change will handle the rest
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Login failed. ';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage += 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += 'No user found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += 'Incorrect password.';
                    break;
                default:
                    errorMessage += 'Please check your credentials.';
            }
            
            this.showMessage(errorMessage, 'error');
            
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    }
    
    async logout() {
        try {
            await this.auth.signOut();
            this.showLogin();
            this.showMessage('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showMessage('Logout failed', 'error');
        }
    }
    
    showLogin() {
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('dashboard-container').classList.add('hidden');
        document.getElementById('email-input').value = '';
        document.getElementById('password-input').value = '';
    }
    
    async showDashboard() {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        
        // Update welcome message
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage && this.currentUser?.email) {
            welcomeMessage.textContent = `Welcome, ${this.currentUser.email}`;
        }
    }
    
    async loadStats() {
        try {
            // Get post stats
            const postsSnapshot = await this.db.collection('posts').get();
            const totalPosts = postsSnapshot.size;
            const publishedPosts = postsSnapshot.docs.filter(doc => doc.data().published).length;
            const draftPosts = totalPosts - publishedPosts;
            
            // Get comments stats (approximate - could be optimized)
            let totalComments = 0;
            for (const doc of postsSnapshot.docs) {
                const commentsSnapshot = await this.db.collection('posts').doc(doc.id).collection('comments').get();
                totalComments += commentsSnapshot.size;
            }
            
            // Update UI
            document.getElementById('total-posts').textContent = totalPosts;
            document.getElementById('published-posts').textContent = publishedPosts;
            document.getElementById('draft-posts').textContent = draftPosts;
            document.getElementById('total-comments').textContent = totalComments;
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadPosts() {
        try {
            const postsList = document.getElementById('posts-list');
            postsList.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Loading posts...</p>
                </div>
            `;
            
            const snapshot = await this.db.collection('posts')
                .orderBy('createdAt', 'desc')
                .get();
            
            if (snapshot.empty) {
                postsList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No posts yet.</p>';
                return;
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                const date = post.createdAt?.toDate() || new Date();
                const updatedDate = post.updatedAt?.toDate() || date;
                
                html += `
                    <div class="post-item" data-id="${doc.id}">
                        <div class="post-info">
                            <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
                            <div class="post-meta">
                                <span>${date.toLocaleDateString()}</span>
                                <span>•</span>
                                <span>${this.timeAgo(updatedDate)}</span>
                                <span class="post-status ${post.published ? 'status-published' : 'status-draft'}">
                                    ${post.published ? 'Published' : 'Draft'}
                                </span>
                            </div>
                            ${post.categories?.length ? `
                                <div class="category-tags">
                                    ${post.categories.map(cat => `
                                        <span class="category-tag">${this.escapeHtml(cat)}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="post-actions">
                            <button class="btn-sm btn-view" onclick="window.open('/?post=${doc.id}', '_blank')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-sm btn-edit" data-id="${doc.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-sm btn-toggle" data-id="${doc.id}">
                                <i class="fas fa-toggle-${post.published ? 'on' : 'off'}"></i>
                            </button>
                            <button class="btn-sm btn-delete" data-id="${doc.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            postsList.innerHTML = html;
            this.setupPostActionListeners();
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showMessage('Failed to load posts', 'error');
        }
    }
    
    async loadComments() {
        try {
            const commentsList = document.getElementById('comments-list');
            commentsList.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Loading comments...</p>
                </div>
            `;
            
            // Get all posts
            const postsSnapshot = await this.db.collection('posts').get();
            
            if (postsSnapshot.empty) {
                commentsList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No comments yet.</p>';
                return;
            }
            
            let allComments = [];
            
            // Fetch comments for each post
            for (const postDoc of postsSnapshot.docs) {
                const commentsSnapshot = await this.db.collection('posts')
                    .doc(postDoc.id)
                    .collection('comments')
                    .orderBy('createdAt', 'desc')
                    .get();
                
                commentsSnapshot.forEach(commentDoc => {
                    allComments.push({
                        id: commentDoc.id,
                        postId: postDoc.id,
                        postTitle: postDoc.data().title,
                        ...commentDoc.data()
                    });
                });
            }
            
            if (allComments.length === 0) {
                commentsList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No comments yet.</p>';
                return;
            }
            
            // Sort by date
            allComments.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || new Date(0);
                const dateB = b.createdAt?.toDate() || new Date(0);
                return dateB - dateA;
            });
            
            let html = '';
            allComments.forEach(comment => {
                const date = comment.createdAt?.toDate() || new Date();
                const content = comment.content.length > 200 
                    ? comment.content.substring(0, 200) + '...' 
                    : comment.content;
                
                html += `
                    <div class="post-item" data-id="${comment.id}" data-post-id="${comment.postId}">
                        <div class="post-info">
                            <h3 class="post-title">On: ${this.escapeHtml(comment.postTitle)}</h3>
                            <div class="post-meta">
                                <span>By: ${comment.authorName || 'Anonymous'}</span>
                                <span>•</span>
                                <span>${date.toLocaleDateString()}</span>
                                ${comment.isAdmin ? '<span class="post-status status-published">Admin</span>' : ''}
                            </div>
                            <p style="margin-top: 0.5rem; color: var(--text-secondary);">
                                ${this.escapeHtml(content)}
                            </p>
                        </div>
                        <div class="post-actions">
                            <button class="btn-sm btn-view" onclick="window.open('/?post=${comment.postId}#comments', '_blank')">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                            <button class="btn-sm btn-delete delete-comment" data-id="${comment.id}" data-post-id="${comment.postId}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            commentsList.innerHTML = html;
            
            // Add delete listeners for comments
            document.querySelectorAll('.delete-comment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const commentId = e.currentTarget.dataset.id;
                    const postId = e.currentTarget.dataset.postId;
                    this.deleteComment(postId, commentId);
                });
            });
            
        } catch (error) {
            console.error('Error loading comments:', error);
            this.showMessage('Failed to load comments', 'error');
        }
    }
    
    async savePost(e) {
        e.preventDefault();
        
        const saveBtn = document.getElementById('save-post-btn');
        const originalText = saveBtn.querySelector('#save-btn-text').textContent;
        
        try {
            saveBtn.disabled = true;
            saveBtn.querySelector('#save-btn-text').textContent = 'Saving...';
            
            const postData = {
                title: document.getElementById('post-title').value.trim(),
                slug: document.getElementById('post-slug').value.trim().toLowerCase().replace(/\s+/g, '-'),
                excerpt: document.getElementById('post-excerpt').value.trim(),
                content: document.getElementById('post-content').value.trim(),
                categories: document.getElementById('post-categories').value
                    .split(',')
                    .map(cat => cat.trim())
                    .filter(cat => cat),
                imageUrl: document.getElementById('post-image').value.trim(),
                contentType: document.getElementById('post-content-type').value,
                published: document.getElementById('post-published').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (!postData.title || !postData.content) {
                throw new Error('Title and content are required');
            }
            
            if (!postData.slug) {
                throw new Error('Slug is required');
            }
            
            if (this.editingPost) {
                // Update existing post
                await this.db.collection('posts').doc(this.editingPost).update(postData);
                this.showMessage('Post updated successfully!', 'success');
            } else {
                // Create new post
                postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                postData.authorId = this.currentUser.uid;
                postData.authorEmail = this.currentUser.email;
                
                await this.db.collection('posts').add(postData);
                this.showMessage('Post created successfully!', 'success');
            }
            
            // Clear form
            this.clearForm();
            
            // Reload posts and stats
            await this.loadPosts();
            await this.loadStats();
            
            // Switch to posts tab
            this.switchTab('posts');
            
        } catch (error) {
            console.error('Error saving post:', error);
            this.showMessage(`Failed to save post: ${error.message}`, 'error');
            
        } finally {
            saveBtn.disabled = false;
            saveBtn.querySelector('#save-btn-text').textContent = originalText;
        }
    }
    
    async editPost(postId) {
        try {
            const doc = await this.db.collection('posts').doc(postId).get();
            
            if (doc.exists) {
                const post = doc.data();
                this.editingPost = postId;
                
                // Update form title
                document.getElementById('form-title').textContent = 'Edit Post';
                document.getElementById('save-btn-text').textContent = 'Update Post';
                document.getElementById('cancel-edit').classList.remove('hidden');
                
                // Fill form
                document.getElementById('post-title').value = post.title || '';
                document.getElementById('post-slug').value = post.slug || '';
                document.getElementById('post-excerpt').value = post.excerpt || '';
                document.getElementById('post-content').value = post.content || '';
                document.getElementById('post-categories').value = post.categories?.join(', ') || '';
                document.getElementById('post-image').value = post.imageUrl || '';
                document.getElementById('post-content-type').value = post.contentType || 'html';
                document.getElementById('post-published').checked = post.published || false;
                
                // Switch to create post tab
                this.switchTab('create-post');
                
                // Scroll to form
                document.getElementById('post-form').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading post:', error);
            this.showMessage('Failed to load post', 'error');
        }
    }
    
    async togglePublish(postId) {
        try {
            const doc = await this.db.collection('posts').doc(postId).get();
            
            if (doc.exists) {
                const post = doc.data();
                const newStatus = !post.published;
                
                await this.db.collection('posts').doc(postId).update({
                    published: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                this.showMessage(`Post ${newStatus ? 'published' : 'unpublished'}`, 'success');
                await this.loadPosts();
                await this.loadStats();
            }
        } catch (error) {
            console.error('Error toggling publish:', error);
            this.showMessage('Failed to update post', 'error');
        }
    }
    
    async deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }
        
        try {
            // Delete post comments first
            const commentsRef = this.db.collection('posts').doc(postId).collection('comments');
            const commentsSnapshot = await commentsRef.get();
            const deleteComments = commentsSnapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deleteComments);
            
            // Delete the post
            await this.db.collection('posts').doc(postId).delete();
            
            this.showMessage('Post deleted successfully', 'success');
            await this.loadPosts();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showMessage('Failed to delete post', 'error');
        }
    }
    
    async deleteComment(postId, commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) {
            return;
        }
        
        try {
            await this.db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
            this.showMessage('Comment deleted', 'success');
            await this.loadComments();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showMessage('Failed to delete comment', 'error');
        }
    }
    
    clearForm() {
        document.getElementById('post-form').reset();
        document.getElementById('form-title').textContent = 'Create New Post';
        document.getElementById('save-btn-text').textContent = 'Create Post';
        document.getElementById('cancel-edit').classList.add('hidden');
        document.getElementById('post-content-type').value = 'html';
        document.getElementById('post-published').checked = true;
        this.editingPost = null;
    }
    
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Show corresponding content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        // Load content if needed
        if (tabName === 'comments') {
            this.loadComments();
        }
    }
    
    setupEventListeners() {
        // Login
        document.getElementById('login-btn')?.addEventListener('click', () => {
            const email = document.getElementById('email-input').value;
            const password = document.getElementById('password-input').value;
            
            if (!email || !password) {
                this.showMessage('Please enter email and password', 'error');
                return;
            }
            
            this.login(email, password);
        });
        
        // Enter key in login form
        ['email-input', 'password-input'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('login-btn').click();
                }
            });
        });
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
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
        
        // Cancel edit
        document.getElementById('cancel-edit')?.addEventListener('click', () => {
            this.clearForm();
        });
        
        // Auto-generate slug from title
        document.getElementById('post-title')?.addEventListener('blur', () => {
            const title = document.getElementById('post-title').value;
            const slugInput = document.getElementById('post-slug');
            
            if (title && (!slugInput.value || slugInput.value === this.editingPost)) {
                const slug = title.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/--+/g, '-')
                    .trim();
                slugInput.value = slug;
            }
        });
        
        // Save settings
        document.getElementById('save-settings')?.addEventListener('click', () => {
            this.showMessage('Settings saved (demo - not implemented)', 'success');
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
        document.querySelectorAll('.btn-delete:not(.delete-comment)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.deletePost(postId);
            });
        });
    }
    
    showMessage(message, type = 'info') {
        const errorEl = document.getElementById('error-message');
        const successEl = document.getElementById('success-message');
        
        if (type === 'error') {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            successEl.classList.add('hidden');
        } else {
            successEl.textContent = message;
            successEl.classList.remove('hidden');
            errorEl.classList.add('hidden');
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.classList.add('hidden');
            successEl.classList.add('hidden');
        }, 5000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
        
        return 'just now';
    }
}

export default AdminManager;
