class BlogPlatform {
    constructor() {
        this.posts = [];
        this.filteredPosts = [];
        this.categories = new Set(['all']);
        this.years = new Set();
        this.currentPage = 1;
        this.postsPerPage = 9;
        this.currentPost = null;
        this.currentCategory = 'all';
        this.currentYear = '';
        this.searchTerm = '';
        this.userId = this.generateUserId();
        this.userName = localStorage.getItem('blog_username') || null;
        this.commentingPostId = null;
        
        this.init();
    }

    async init() {
        // Check for post in URL
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        
        this.setupEventListeners();
        await this.loadPosts();
        
        if (postId) {
            setTimeout(() => this.openFullscreenPost(postId), 500);
        }
        
        // Track active user
        this.trackActiveUser();
    }

    generateUserId() {
        let userId = localStorage.getItem('blog_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('blog_user_id', userId);
        }
        return userId;
    }

    trackActiveUser() {
        const userRef = activeUsersRef.child(this.userId);
        userRef.set({
            userId: this.userId,
            userName: this.userName,
            lastActive: Date.now()
        });
        
        userRef.onDisconnect().remove();
    }

    setupEventListeners() {
        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.toggleSettingsPanel(true);
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.toggleSettingsPanel(false);
        });
        
        // Username management
        document.getElementById('updateUsername').addEventListener('click', () => {
            this.updateUsername();
        });
        
        document.getElementById('removeUsername').addEventListener('click', () => {
            this.removeUsername();
        });
        
        document.getElementById('clearCache').addEventListener('click', () => {
            this.clearCache();
        });
        
        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.filterPosts();
        });
        
        document.getElementById('yearFilter').addEventListener('change', (e) => {
            this.currentYear = e.target.value;
            this.filterPosts();
        });
        
        // Category scrolling
        document.querySelectorAll('.scroll-arrow').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                const scrollContainer = document.querySelector('.categories-scroll');
                const scrollAmount = 200;
                
                if (e.currentTarget.classList.contains('left')) {
                    scrollContainer.scrollLeft -= scrollAmount;
                } else {
                    scrollContainer.scrollLeft += scrollAmount;
                }
            });
        });
        
        // Close fullscreen
        document.getElementById('closeFullscreen').addEventListener('click', () => {
            this.closeFullscreenPost();
        });
        
        // Like button
        document.getElementById('likeBtn').addEventListener('click', () => {
            if (this.currentPost) {
                this.toggleLike(this.currentPost.id);
            }
        });
        
        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => {
            if (this.currentPost) {
                this.sharePost(this.currentPost.id);
            }
        });
        
        // Comments
        document.getElementById('addCommentBtn').addEventListener('click', () => {
            this.showCommentForm();
        });
        
        document.getElementById('cancelComment').addEventListener('click', () => {
            this.hideCommentForm();
        });
        
        document.getElementById('submitComment').addEventListener('click', () => {
            this.submitComment();
        });
        
        // Username modal
        document.getElementById('cancelUsername').addEventListener('click', () => {
            this.hideUsernameModal();
        });
        
        document.getElementById('saveUsername').addEventListener('click', () => {
            this.saveUsername();
        });
        
        // Back button
        document.getElementById('backButton').addEventListener('click', () => {
            window.history.back();
        });
        
        // Close settings when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settingsPanel');
            const btn = document.getElementById('settingsBtn');
            
            if (panel.classList.contains('active') && 
                !panel.contains(e.target) && 
                !btn.contains(e.target)) {
                this.toggleSettingsPanel(false);
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('fullscreenPost').classList.contains('active')) {
                    this.closeFullscreenPost();
                }
                this.toggleSettingsPanel(false);
            }
        });
    }

    async loadPosts() {
        try {
            const snapshot = await postsCollection
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .get();
            
            this.posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.extractCategoriesAndYears();
            this.filteredPosts = [...this.posts];
            this.renderPosts();
            this.renderCategories();
            this.renderYearFilter();
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts. Please try again.');
        }
    }

    extractCategoriesAndYears() {
        this.categories.clear();
        this.categories.add('all');
        this.years.clear();
        
        this.posts.forEach(post => {
            if (post.category) {
                this.categories.add(post.category);
            }
            
            if (post.createdAt) {
                const year = new Date(post.createdAt.toDate()).getFullYear();
                this.years.add(year);
            }
        });
    }

    filterPosts() {
        let filtered = this.posts;
        
        // Filter by category
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(post => post.category === this.currentCategory);
        }
        
        // Filter by year
        if (this.currentYear) {
            filtered = filtered.filter(post => {
                const year = new Date(post.createdAt.toDate()).getFullYear();
                return year === parseInt(this.currentYear);
            });
        }
        
        // Filter by search term
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(post => 
                post.title.toLowerCase().includes(term) ||
                post.excerpt.toLowerCase().includes(term) ||
                post.content.toLowerCase().includes(term) ||
                post.category.toLowerCase().includes(term)
            );
        }
        
        this.filteredPosts = filtered;
        this.currentPage = 1;
        this.renderPosts();
    }

    renderPosts() {
        const container = document.getElementById('postsGrid');
        const start = (this.currentPage - 1) * this.postsPerPage;
        const end = start + this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(start, end);
        
        if (postsToShow.length === 0) {
            container.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-search fa-3x"></i>
                    <h3>No posts found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            document.getElementById('pagination').innerHTML = '';
            return;
        }
        
        container.innerHTML = postsToShow.map((post, index) => this.createPostCard(post, index)).join('');
        this.renderPagination();
        
        // Add click listeners
        document.querySelectorAll('.read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                this.openFullscreenPost(postId);
            });
        });
    }

    createPostCard(post, index) {
        const date = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'No date';
        
        const imageUrl = post.image || post.coverImage || '';
        
        return `
            <article class="post-card" style="animation-delay: ${index * 0.1}s">
                ${imageUrl ? `
                    <img src="${imageUrl}" 
                         alt="${post.title}" 
                         class="post-media"
                         loading="lazy"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\"no-image\"><i class=\"fas fa-image\"></i></div>'">
                ` : `
                    <div class="post-media no-image">
                        <i class="fas fa-image"></i>
                    </div>
                `}
                <div class="post-content">
                    <h2 class="post-title">${this.escapeHtml(post.title)}</h2>
                    <p class="post-excerpt">${this.escapeHtml(post.excerpt || post.content.substring(0, 150) + '...')}</p>
                    <div class="post-meta">
                        <div class="post-date">
                            <i class="far fa-calendar"></i>
                            ${date}
                        </div>
                        <span class="post-category">${post.category || 'Uncategorized'}</span>
                    </div>
                    <button class="read-btn" data-id="${post.id}">
                        Read More <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </article>
        `;
    }

    renderCategories() {
        const container = document.querySelector('.categories-scroll');
        const categories = Array.from(this.categories);
        
        container.innerHTML = categories.map(category => `
            <button class="category-btn ${category === this.currentCategory ? 'active' : ''}" 
                    data-category="${category}">
                ${category === 'all' ? 'All Posts' : category}
            </button>
        `).join('');
        
        // Add click listeners
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.currentCategory = category;
                this.filterPosts();
                
                // Update active state
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.category === category);
                });
            });
        });
    }

    renderYearFilter() {
        const select = document.getElementById('yearFilter');
        const years = Array.from(this.years).sort((a, b) => b - a);
        
        select.innerHTML = `
            <option value="">All Years</option>
            ${years.map(year => `
                <option value="${year}" ${year === parseInt(this.currentYear) ? 'selected' : ''}>
                    ${year}
                </option>
            `).join('')}
        `;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        const container = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = `
            <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    ${this.currentPage === 1 ? 'disabled' : ''}
                    data-page="${this.currentPage - 1}">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                html += `
                    <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                            data-page="${i}">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                html += `<span class="page-dots">...</span>`;
            }
        }
        
        html += `
            <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    ${this.currentPage === totalPages ? 'disabled' : ''}
                    data-page="${this.currentPage + 1}">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        container.innerHTML = html;
        
        // Add click listeners
        container.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderPosts();
                    window.scrollTo({
                        top: document.querySelector('.posts-grid').offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    async openFullscreenPost(postId) {
        try {
            const doc = await postsCollection.doc(postId).get();
            if (!doc.exists) {
                throw new Error('Post not found');
            }
            
            this.currentPost = {
                id: doc.id,
                ...doc.data()
            };
            
            this.showFullscreenPost();
            await this.loadPostLikes();
            await this.loadPostComments();
            
            // Update URL
            history.pushState({ postId }, '', `?post=${postId}`);
            
            // Track view
            analytics.logEvent('post_view', { post_id: postId });
        } catch (error) {
            console.error('Error loading post:', error);
            this.showError('Failed to load post. Please try again.');
        }
    }

    showFullscreenPost() {
        const container = document.getElementById('fullscreenPost');
        const content = container.querySelector('.fullscreen-content');
        
        const date = this.currentPost.createdAt ? 
            new Date(this.currentPost.createdAt.toDate()).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'No date';
        
        content.innerHTML = `
            <h1 class="fullscreen-title">${this.escapeHtml(this.currentPost.title)}</h1>
            <div class="fullscreen-meta">
                <span><i class="far fa-calendar"></i> ${date}</span>
                <span class="post-category">${this.currentPost.category || 'Uncategorized'}</span>
            </div>
            ${this.currentPost.image || this.currentPost.coverImage ? `
                <img src="${this.currentPost.image || this.currentPost.coverImage}" 
                     alt="${this.currentPost.title}" 
                     class="post-fullscreen-image"
                     loading="lazy">
            ` : ''}
            <div class="fullscreen-body">
                ${this.currentPost.content || 'No content available.'}
            </div>
        `;
        
        container.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeFullscreenPost() {
        document.getElementById('fullscreenPost').classList.remove('active');
        document.body.style.overflow = '';
        history.replaceState(null, '', window.location.pathname);
        this.currentPost = null;
        this.commentingPostId = null;
        this.hideCommentForm();
    }

    async loadPostLikes() {
        if (!this.currentPost) return;
        
        try {
            const likeDoc = await likesCollection.doc(this.currentPost.id).get();
            const likes = likeDoc.exists ? likeDoc.data().users || [] : [];
            const likeCount = likes.length;
            const hasLiked = likes.includes(this.userId);
            
            document.getElementById('likeCount').textContent = likeCount;
            const likeIcon = document.querySelector('#likeBtn i');
            likeIcon.className = hasLiked ? 'fas fa-heart' : 'far fa-heart';
            likeIcon.style.color = hasLiked ? 'var(--primary)' : '';
        } catch (error) {
            console.error('Error loading likes:', error);
        }
    }

    async toggleLike(postId) {
        try {
            const likeRef = likesCollection.doc(postId);
            const likeDoc = await likeRef.get();
            
            let likes = [];
            if (likeDoc.exists) {
                likes = likeDoc.data().users || [];
            }
            
            const hasLiked = likes.includes(this.userId);
            
            if (hasLiked) {
                // Unlike
                likes = likes.filter(id => id !== this.userId);
            } else {
                // Like
                likes.push(this.userId);
            }
            
            await likeRef.set({
                users: likes,
                postId: postId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await this.loadPostLikes();
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    async loadPostComments() {
        if (!this.currentPost) return;
        
        try {
            const snapshot = await commentsCollection
                .where('postId', '==', this.currentPost.id)
                .where('status', '==', 'approved')
                .orderBy('createdAt', 'desc')
                .get();
            
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.renderComments(comments);
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    renderComments(comments) {
        const container = document.getElementById('commentsList');
        
        if (comments.length === 0) {
            container.innerHTML = `
                <div class="no-comments">
                    <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = comments.map(comment => this.createCommentElement(comment)).join('');
        
        // Add delete listeners for user's own comments
        document.querySelectorAll('.delete-comment').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const commentId = e.currentTarget.dataset.id;
                await this.deleteComment(commentId);
            });
        });
    }

    createCommentElement(comment) {
        const date = comment.createdAt ? 
            new Date(comment.createdAt.toDate()).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Just now';
        
        const isAdmin = comment.userId === 'admin' || comment.isAdmin;
        const isOwnComment = comment.userId === this.userId;
        
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-author">
                        <span class="author-name">
                            ${this.escapeHtml(comment.userName || 'Anonymous')}
                            ${isAdmin ? `<img src="https://eldrex.landecs.org/verified/badge.png" alt="Verified" class="admin-badge" style="width: 16px; height: 16px; vertical-align: middle; margin-left: 4px;">` : ''}
                        </span>
                        ${isAdmin ? '<span class="author-badge">Admin</span>' : ''}
                    </div>
                    <span class="comment-time">${date}</span>
                </div>
                <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                ${isOwnComment ? `
                    <div class="comment-actions">
                        <button class="delete-comment" data-id="${comment.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    showCommentForm() {
        if (!this.currentPost) return;
        
        // Check if user needs to set username
        if (!this.userName) {
            this.commentingPostId = this.currentPost.id;
            this.showUsernameModal();
            return;
        }
        
        document.getElementById('commentForm').classList.add('active');
        document.getElementById('commentInput').focus();
    }

    hideCommentForm() {
        document.getElementById('commentForm').classList.remove('active');
        document.getElementById('commentInput').value = '';
    }

    async submitComment() {
        if (!this.currentPost) return;
        
        const content = document.getElementById('commentInput').value.trim();
        if (!content) {
            this.showError('Please enter a comment.');
            return;
        }
        
        // Content moderation
        if (this.containsRestrictedContent(content)) {
            this.showError('Comment contains restricted content.');
            return;
        }
        
        try {
            const commentData = {
                postId: this.currentPost.id,
                userId: this.userId,
                userName: this.userName || 'Anonymous',
                content: content,
                status: 'pending', // Requires moderation
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await commentsCollection.add(commentData);
            
            this.hideCommentForm();
            await this.loadPostComments();
            
            // Show success message
            this.showMessage('Comment submitted for moderation.');
        } catch (error) {
            console.error('Error submitting comment:', error);
            this.showError('Failed to submit comment. Please try again.');
        }
    }

    async deleteComment(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        
        try {
            const commentRef = commentsCollection.doc(commentId);
            const commentDoc = await commentRef.get();
            
            if (commentDoc.exists && commentDoc.data().userId === this.userId) {
                await commentRef.delete();
                await this.loadPostComments();
                this.showMessage('Comment deleted.');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showError('Failed to delete comment.');
        }
    }

    showUsernameModal() {
        document.getElementById('usernameModal').classList.add('active');
        document.getElementById('commentUsername').focus();
    }

    hideUsernameModal() {
        document.getElementById('usernameModal').classList.remove('active');
        document.getElementById('commentUsername').value = '';
        this.commentingPostId = null;
    }

    saveUsername() {
        const username = document.getElementById('commentUsername').value.trim();
        
        // Username validation
        if (username && this.containsRestrictedUsername(username)) {
            this.showError('Username contains restricted words.');
            return;
        }
        
        if (username && username.length > 30) {
            this.showError('Username must be less than 30 characters.');
            return;
        }
        
        this.userName = username || null;
        
        if (this.userName) {
            localStorage.setItem('blog_username', this.userName);
        } else {
            localStorage.removeItem('blog_username');
        }
        
        this.hideUsernameModal();
        
        // If user was trying to comment, show comment form
        if (this.commentingPostId) {
            this.showCommentForm();
        }
    }

    updateUsername() {
        const username = document.getElementById('usernameInput').value.trim();
        
        if (username && this.containsRestrictedUsername(username)) {
            this.showError('Username contains restricted words.');
            return;
        }
        
        if (username && username.length > 30) {
            this.showError('Username must be less than 30 characters.');
            return;
        }
        
        this.userName = username || null;
        
        if (this.userName) {
            localStorage.setItem('blog_username', this.userName);
            this.showMessage('Username updated successfully.');
        } else {
            localStorage.removeItem('blog_username');
            this.showMessage('Username removed.');
        }
        
        this.toggleSettingsPanel(false);
    }

    removeUsername() {
        this.userName = null;
        localStorage.removeItem('blog_username');
        this.showMessage('Username removed.');
        this.toggleSettingsPanel(false);
    }

    clearCache() {
        localStorage.clear();
        sessionStorage.clear();
        this.userId = this.generateUserId();
        this.userName = null;
        this.showMessage('Cache cleared. You will be redirected.');
        setTimeout(() => location.reload(), 1000);
    }

    toggleSettingsPanel(show) {
        const panel = document.getElementById('settingsPanel');
        if (show) {
            document.getElementById('usernameInput').value = this.userName || '';
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    }

    sharePost(postId) {
        const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        const text = `Check out this post: ${this.currentPost.title}`;
        
        if (navigator.share) {
            navigator.share({
                title: this.currentPost.title,
                text: text,
                url: url
            });
        } else {
            navigator.clipboard.writeText(url);
            this.showMessage('Link copied to clipboard!');
        }
    }

    containsRestrictedContent(text) {
        const restrictedPatterns = [
            /\b(?:fuck|shit|asshole|bitch|bastard|damn|cunt|piss|dick)\b/i,
            /(?:\bkill\b|\bmurder\b|\bdie\b|\bsuicide\b)/i,
            /(?:http|https):\/\/[^\s]+/,
            /<script[\s\S]*?>[\s\S]*?<\/script>/gi
        ];
        
        return restrictedPatterns.some(pattern => pattern.test(text));
    }

    containsRestrictedUsername(username) {
        const restrictedNames = [
            'eldrex', 'bula', 'delos reyes', 'eldrex delos reyes bula',
            'admin', 'administrator', 'moderator', 'system'
        ];
        
        const lowerUsername = username.toLowerCase();
        return restrictedNames.some(name => lowerUsername.includes(name));
    }

    showError(message) {
        alert(message); // Replace with better notification system
    }

    showMessage(message) {
        alert(message); // Replace with better notification system
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize blog when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        document.getElementById('postsGrid').innerHTML = `
            <div class="error">
                <h3>Failed to load Firebase</h3>
                <p>Please check your internet connection and refresh the page.</p>
            </div>
        `;
        return;
    }
    
    // Initialize blog platform
    window.blog = new BlogPlatform();
    
    // Handle browser back/forward for posts
    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        
        if (postId && window.blog) {
            window.blog.openFullscreenPost(postId);
        } else if (window.blog) {
            window.blog.closeFullscreenPost();
        }
    });
});
