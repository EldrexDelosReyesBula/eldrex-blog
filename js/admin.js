class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.currentSection = 'posts';
        this.editingPost = null;
        this.editingComment = null;
        this.editingCategory = null;
        this.categories = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Check authentication state
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.showDashboard();
                await this.loadData();
            } else {
                this.showLogin();
            }
        });
        
        // Auto login if already authenticated
        if (localStorage.getItem('admin_auto_login') === 'true') {
            await this.autoLogin();
        }
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.login();
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });
        
        // Post management
        document.getElementById('newPostBtn').addEventListener('click', () => {
            this.openPostEditor();
        });
        
        document.getElementById('closeEditor').addEventListener('click', () => {
            this.closePostEditor();
        });
        
        document.getElementById('cancelPost').addEventListener('click', () => {
            this.closePostEditor();
        });
        
        document.getElementById('deletePost').addEventListener('click', () => {
            this.deletePost();
        });
        
        document.getElementById('postForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePost();
        });
        
        // Comment filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.currentTarget.dataset.status;
                this.filterComments(status);
            });
        });
        
        // Comment management
        document.querySelector('.close-comment-modal').addEventListener('click', () => {
            this.closeCommentModal();
        });
        
        document.getElementById('approveComment').addEventListener('click', () => {
            this.updateCommentStatus('approved');
        });
        
        document.getElementById('rejectComment').addEventListener('click', () => {
            this.updateCommentStatus('rejected');
        });
        
        document.getElementById('replyToComment').addEventListener('click', () => {
            this.showReplyForm();
        });
        
        document.getElementById('cancelReply').addEventListener('click', () => {
            this.hideReplyForm();
        });
        
        document.getElementById('submitReply').addEventListener('click', () => {
            this.submitReply();
        });
        
        // Category management
        document.getElementById('newCategoryBtn').addEventListener('click', () => {
            this.openCategoryEditor();
        });
        
        document.querySelector('.close-category-modal').addEventListener('click', () => {
            this.closeCategoryModal();
        });
        
        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });
        
        document.getElementById('deleteCategory').addEventListener('click', () => {
            this.deleteCategory();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePostEditor();
                this.closeCommentModal();
                this.closeCategoryModal();
            }
            
            // Ctrl/Cmd + N for new post
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.openPostEditor();
            }
        });
    }

    async autoLogin() {
        try {
            const email = localStorage.getItem('admin_email');
            const password = localStorage.getItem('admin_password');
            
            if (email && password) {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            console.error('Auto login failed:', error);
            localStorage.removeItem('admin_auto_login');
            localStorage.removeItem('admin_email');
            localStorage.removeItem('admin_password');
        }
    }

    async login() {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        if (!email || !password) {
            errorDiv.textContent = 'Please enter email and password.';
            return;
        }
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            
            // Store credentials for auto login (optional)
            if (document.getElementById('rememberMe')?.checked) {
                localStorage.setItem('admin_auto_login', 'true');
                localStorage.setItem('admin_email', email);
                localStorage.setItem('admin_password', password); // Note: This is not secure
            }
            
            errorDiv.textContent = '';
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = this.getErrorMessage(error);
        }
    }

    async logout() {
        try {
            await auth.signOut();
            localStorage.removeItem('admin_auto_login');
            localStorage.removeItem('admin_email');
            localStorage.removeItem('admin_password');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            default:
                return 'Login failed. Please try again.';
        }
    }

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    async showDashboard() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        document.getElementById('adminStatus').textContent = `Logged in as ${this.currentUser.email}`;
    }

    switchSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(`${section}Section`).classList.add('active');
        this.currentSection = section;
        
        // Load section data
        this.loadSectionData(section);
    }

    async loadData() {
        await this.loadCategories();
        await this.loadPosts();
        await this.loadComments();
        await this.loadAnalytics();
    }

    async loadSectionData(section) {
        switch (section) {
            case 'posts':
                await this.loadPosts();
                break;
            case 'comments':
                await this.loadComments();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
            case 'categories':
                await this.loadCategories();
                break;
        }
    }

    async loadCategories() {
        try {
            // Get unique categories from posts
            const snapshot = await postsCollection.get();
            const categories = new Set();
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.category) {
                    categories.add(data.category);
                }
            });
            
            this.categories = Array.from(categories).sort();
            this.renderCategories();
            
            // Update category dropdown in post editor
            const select = document.getElementById('postCategory');
            select.innerHTML = `
                <option value="">Select Category</option>
                ${this.categories.map(cat => `
                    <option value="${cat}">${cat}</option>
                `).join('')}
                <option value="new">+ Add New Category</option>
            `;
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    renderCategories() {
        const container = document.getElementById('categoriesGrid');
        
        if (this.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tags"></i>
                    <p>No categories yet</p>
                </div>
            `;
            return;
        }
        
        // Count posts per category
        const categoryCounts = {};
        this.categories.forEach(cat => {
            categoryCounts[cat] = this.categories.filter(c => c === cat).length;
        });
        
        container.innerHTML = this.categories.map(cat => `
            <div class="category-card" data-category="${cat}">
                <h3 class="category-name">${this.escapeHtml(cat)}</h3>
                <p class="category-count">${categoryCounts[cat]} posts</p>
                <div class="category-actions">
                    <button class="btn-secondary edit-category" data-category="${cat}">
                        Edit
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add edit listeners
        document.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.editCategory(category);
            });
        });
    }

    async loadPosts() {
        try {
            const snapshot = await postsCollection.orderBy('createdAt', 'desc').get();
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderPosts(posts);
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    renderPosts(posts) {
        const container = document.getElementById('postsList');
        
        if (posts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-newspaper"></i>
                    <p>No posts yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = posts.map(post => {
            const date = post.createdAt ? 
                new Date(post.createdAt.toDate()).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }) : 'No date';
            
            return `
                <div class="post-item" data-id="${post.id}">
                    <div class="post-info">
                        <h3>${this.escapeHtml(post.title)}</h3>
                        <div class="post-meta">
                            <span>${date}</span>
                            <span>${post.category || 'Uncategorized'}</span>
                            <span class="post-status status-${post.status || 'draft'}">
                                ${post.status || 'draft'}
                            </span>
                        </div>
                    </div>
                    <div class="post-actions">
                        <button class="btn-secondary edit-post" data-id="${post.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-secondary view-post" data-id="${post.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners
        document.querySelectorAll('.edit-post').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.editPost(postId);
            });
        });
        
        document.querySelectorAll('.view-post').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                window.open(`/?post=${postId}`, '_blank');
            });
        });
    }

    async loadComments() {
        try {
            const snapshot = await commentsCollection.orderBy('createdAt', 'desc').get();
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderComments(comments);
            this.updatePendingCount(comments);
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    renderComments(comments) {
        const container = document.getElementById('commentsListAdmin');
        const filteredComments = this.filterCommentsByStatus(comments);
        
        if (filteredComments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No comments in this category</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredComments.map(comment => {
            const date = comment.createdAt ? 
                new Date(comment.createdAt.toDate()).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Just now';
            
            return `
                <div class="comment-item-admin" data-id="${comment.id}">
                    <div class="comment-header-admin">
                        <div class="comment-author-admin">
                            <strong>${this.escapeHtml(comment.userName || 'Anonymous')}</strong>
                            <span class="comment-status status-${comment.status}">
                                ${comment.status}
                            </span>
                        </div>
                        <span class="comment-time">${date}</span>
                    </div>
                    <div class="comment-content-admin">
                        ${this.escapeHtml(comment.content)}
                    </div>
                    <div class="comment-actions-admin">
                        <button class="btn-secondary view-comment" data-id="${comment.id}">
                            <i class="fas fa-search"></i> Details
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add event listeners
        document.querySelectorAll('.view-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = e.currentTarget.dataset.id;
                this.viewComment(commentId);
            });
        });
    }

    filterCommentsByStatus(comments) {
        const activeFilter = document.querySelector('.filter-btn.active');
        const status = activeFilter ? activeFilter.dataset.status : 'pending';
        
        if (status === 'all') return comments;
        return comments.filter(comment => comment.status === status);
    }

    filterComments(status) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.status === status);
        });
        
        // Reload comments with new filter
        this.loadComments();
    }

    updatePendingCount(comments) {
        const pending = comments.filter(c => c.status === 'pending').length;
        const badge = document.getElementById('pendingComments');
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline-block' : 'none';
    }

    async loadAnalytics() {
        try {
            // Load post counts
            const postsSnapshot = await postsCollection.get();
            const posts = postsSnapshot.docs.map(doc => doc.data());
            
            const totalPosts = posts.length;
            const publishedPosts = posts.filter(p => p.status === 'published').length;
            const draftPosts = posts.filter(p => p.status === 'draft').length;
            
            document.getElementById('totalPosts').textContent = totalPosts;
            document.getElementById('publishedPosts').textContent = publishedPosts;
            document.getElementById('draftPosts').textContent = draftPosts;
            
            // Load comment count
            const commentsSnapshot = await commentsCollection.get();
            document.getElementById('totalComments').textContent = commentsSnapshot.size;
            
            // Load recent activity
            await this.loadRecentActivity();
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    async loadRecentActivity() {
        try {
            // Get recent posts and comments
            const recentPosts = await postsCollection
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
            
            const recentComments = await commentsCollection
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();
            
            const activities = [];
            
            recentPosts.docs.forEach(doc => {
                const post = doc.data();
                activities.push({
                    type: 'post',
                    text: `New post: "${post.title}"`,
                    time: post.createdAt
                });
            });
            
            recentComments.docs.forEach(doc => {
                const comment = doc.data();
                activities.push({
                    type: 'comment',
                    text: `New comment by ${comment.userName || 'Anonymous'}`,
                    time: comment.createdAt
                });
            });
            
            // Sort by time and limit to 10
            activities.sort((a, b) => b.time - a.time);
            activities.splice(10);
            
            this.renderRecentActivity(activities);
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = activities.map(activity => {
            const icon = activity.type === 'post' ? 'fa-newspaper' : 'fa-comment';
            const time = activity.time ? 
                new Date(activity.time.toDate()).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Just now';
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-text">${activity.text}</div>
                        <div class="activity-time">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openPostEditor(postId = null) {
        this.editingPost = postId;
        
        const title = postId ? 'Edit Post' : 'New Post';
        const deleteBtn = document.getElementById('deletePost');
        
        document.getElementById('editorTitle').textContent = title;
        deleteBtn.style.display = postId ? 'inline-flex' : 'none';
        
        if (postId) {
            this.loadPostData(postId);
        } else {
            this.resetPostForm();
        }
        
        document.getElementById('postEditor').classList.add('active');
    }

    closePostEditor() {
        document.getElementById('postEditor').classList.remove('active');
        this.editingPost = null;
        this.resetPostForm();
    }

    async loadPostData(postId) {
        try {
            const doc = await postsCollection.doc(postId).get();
            if (!doc.exists) {
                throw new Error('Post not found');
            }
            
            const post = doc.data();
            
            document.getElementById('postTitle').value = post.title || '';
            document.getElementById('postCategory').value = post.category || '';
            document.getElementById('postStatus').value = post.status || 'draft';
            document.getElementById('postImage').value = post.image || post.coverImage || '';
            document.getElementById('postExcerpt').value = post.excerpt || '';
            document.getElementById('postContent').value = post.content || '';
        } catch (error) {
            console.error('Error loading post:', error);
            alert('Failed to load post data.');
        }
    }

    resetPostForm() {
        document.getElementById('postForm').reset();
        document.getElementById('postCategory').value = '';
        document.getElementById('postStatus').value = 'draft';
    }

    async savePost() {
        const title = document.getElementById('postTitle').value.trim();
        const category = document.getElementById('postCategory').value;
        const status = document.getElementById('postStatus').value;
        const image = document.getElementById('postImage').value.trim();
        const excerpt = document.getElementById('postExcerpt').value.trim();
        const content = document.getElementById('postContent').value.trim();
        
        if (!title || !content) {
            alert('Please fill in all required fields.');
            return;
        }
        
        try {
            const postData = {
                title,
                category: category || 'Uncategorized',
                status,
                image: image || null,
                excerpt: excerpt || content.substring(0, 150) + '...',
                content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (this.editingPost) {
                // Update existing post
                await postsCollection.doc(this.editingPost).update(postData);
            } else {
                // Create new post
                postData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                postData.author = this.currentUser.email;
                await postsCollection.add(postData);
            }
            
            this.closePostEditor();
            await this.loadPosts();
            await this.loadCategories();
            alert('Post saved successfully!');
        } catch (error) {
            console.error('Error saving post:', error);
            alert('Failed to save post. Please try again.');
        }
    }

    async deletePost() {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }
        
        try {
            await postsCollection.doc(this.editingPost).delete();
            this.closePostEditor();
            await this.loadPosts();
            alert('Post deleted successfully!');
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post.');
        }
    }

    async editPost(postId) {
        this.openPostEditor(postId);
    }

    async viewComment(commentId) {
        try {
            const doc = await commentsCollection.doc(commentId).get();
            if (!doc.exists) {
                throw new Error('Comment not found');
            }
            
            this.editingComment = {
                id: doc.id,
                ...doc.data()
            };
            
            this.renderCommentDetails();
            document.getElementById('commentModal').classList.add('active');
        } catch (error) {
            console.error('Error loading comment:', error);
            alert('Failed to load comment.');
        }
    }

    renderCommentDetails() {
        const comment = this.editingComment;
        const date = comment.createdAt ? 
            new Date(comment.createdAt.toDate()).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Just now';
        
        document.getElementById('commentDetails').innerHTML = `
            <div class="comment-detail">
                <h4>User Information</h4>
                <p><strong>Name:</strong> ${this.escapeHtml(comment.userName || 'Anonymous')}</p>
                <p><strong>User ID:</strong> ${comment.userId}</p>
                <p><strong>Posted:</strong> ${date}</p>
                <p><strong>Status:</strong> <span class="status-${comment.status}">${comment.status}</span></p>
            </div>
            <div class="comment-detail">
                <h4>Comment Content</h4>
                <div class="comment-content">${this.escapeHtml(comment.content)}</div>
            </div>
            ${comment.postId ? `
                <div class="comment-detail">
                    <h4>Related Post</h4>
                    <p><a href="/?post=${comment.postId}" target="_blank">View Post</a></p>
                </div>
            ` : ''}
        `;
    }

    closeCommentModal() {
        document.getElementById('commentModal').classList.remove('active');
        this.editingComment = null;
        this.hideReplyForm();
    }

    async updateCommentStatus(status) {
        if (!this.editingComment) return;
        
        try {
            await commentsCollection.doc(this.editingComment.id).update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                moderatedBy: this.currentUser.email,
                moderatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.loadComments();
            this.closeCommentModal();
            alert(`Comment ${status} successfully.`);
        } catch (error) {
            console.error('Error updating comment:', error);
            alert('Failed to update comment.');
        }
    }

    showReplyForm() {
        document.getElementById('replyForm').style.display = 'block';
    }

    hideReplyForm() {
        document.getElementById('replyForm').style.display = 'none';
        document.getElementById('replyContent').value = '';
    }

    async submitReply() {
        const content = document.getElementById('replyContent').value.trim();
        if (!content) {
            alert('Please enter your reply.');
            return;
        }
        
        try {
            // Get the original comment to find the post ID
            const commentDoc = await commentsCollection.doc(this.editingComment.id).get();
            const commentData = commentDoc.data();
            
            // Create admin reply
            const replyData = {
                postId: commentData.postId,
                userId: 'admin',
                userName: 'Eldrex Delos Reyes Bula',
                content: content,
                status: 'approved',
                isAdmin: true,
                isReplyTo: this.editingComment.id,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await commentsCollection.add(replyData);
            
            // Update original comment status
            await this.updateCommentStatus('approved');
            
            this.hideReplyForm();
            alert('Reply posted successfully!');
        } catch (error) {
            console.error('Error submitting reply:', error);
            alert('Failed to submit reply.');
        }
    }

    openCategoryEditor(category = null) {
        this.editingCategory = category;
        
        const form = document.getElementById('categoryForm');
        const deleteBtn = document.getElementById('deleteCategory');
        
        if (category) {
            document.getElementById('categoryName').value = category;
            document.getElementById('categorySlug').value = this.slugify(category);
            deleteBtn.style.display = 'inline-block';
        } else {
            form.reset();
            deleteBtn.style.display = 'none';
        }
        
        document.getElementById('categoryModal').classList.add('active');
    }

    closeCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
        this.editingCategory = null;
        document.getElementById('categoryForm').reset();
    }

    async saveCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const slug = document.getElementById('categorySlug').value.trim();
        
        if (!name || !slug) {
            alert('Please fill in all fields.');
            return;
        }
        
        // Note: In this simple implementation, we're just updating posts
        // For a production app, you might want a separate categories collection
        
        this.categories.push(name);
        await this.loadCategories();
        this.closeCategoryModal();
        
        alert('Category saved. Note: You need to update posts manually to use this category.');
    }

    async deleteCategory() {
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        
        // Note: This is a simple implementation
        // In production, you should handle category deletion more carefully
        
        this.categories = this.categories.filter(c => c !== this.editingCategory);
        await this.loadCategories();
        this.closeCategoryModal();
        
        alert('Category removed. Note: Posts using this category will need to be updated.');
    }

    editCategory(category) {
        this.openCategoryEditor(category);
    }

    slugify(text) {
        return text.toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        document.getElementById('loginScreen').innerHTML = `
            <div class="login-container">
                <div class="error">
                    <h3>Failed to load Firebase</h3>
                    <p>Please check your internet connection and refresh the page.</p>
                </div>
            </div>
        `;
        return;
    }
    
    window.admin = new AdminDashboard();
});
