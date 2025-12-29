// js/app.js
import { 
    auth, db, analytics,
    signInAnonymously, signOut, onAuthStateChanged,
    collection, query, where, orderBy, limit, startAfter, getDocs,
    doc, getDoc, updateDoc, addDoc, deleteDoc, runTransaction, serverTimestamp,
    arrayUnion, arrayRemove
} from './firebase-config.js';

class BlogApp {
    constructor() {
        this.currentUser = null;
        this.currentPostId = null;
        this.posts = [];
        this.filteredPosts = [];
        this.categories = new Set();
        this.years = new Set();
        this.lastVisible = null;
        this.isLoading = false;
        this.currentCategory = '';
        this.currentYear = '';
        this.currentSearch = '';
        this.userLikes = new Set();
        
        this.init();
    }
    
    async init() {
        // Check authentication state
        onAuthStateChanged(auth, async (user) => {
            this.currentUser = user;
            this.updateAuthUI();
            
            // Load user likes if logged in
            if (user) {
                await this.loadUserLikes();
            }
            
            // Load posts if not already loaded
            if (this.posts.length === 0) {
                await this.loadPosts();
                this.renderPosts();
                this.updateFilters();
            }
        });
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check URL for post ID
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        if (postId) {
            setTimeout(() => this.openFullscreenPost(postId), 500);
        }
        
        // Show auth modal for new visitors
        if (!localStorage.getItem('auth_shown') && !this.currentUser) {
            setTimeout(() => {
                this.showAuthModal();
            }, 1000);
        }
    }
    
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentSearch = e.target.value.trim();
                this.filterPosts();
                this.updateClearSearchButton();
            }, 300);
        });
        
        // Year filter
        document.getElementById('year-filter').addEventListener('change', (e) => {
            this.currentYear = e.target.value;
            this.filterPosts();
        });
        
        // Close auth dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const authDropdown = document.getElementById('auth-dropdown');
            const authStatus = document.getElementById('auth-status');
            if (!authDropdown.contains(e.target) && !authStatus.contains(e.target)) {
                authDropdown.classList.add('hidden');
            }
        });
    }
    
    updateClearSearchButton() {
        const clearBtn = document.getElementById('clear-search');
        clearBtn.classList.toggle('hidden', !this.currentSearch);
    }
    
    async loadPosts(loadMore = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const loadingEl = document.getElementById('loading');
        const postsGrid = document.getElementById('posts-grid');
        
        if (!loadMore) {
            postsGrid.classList.add('hidden');
            loadingEl.classList.remove('hidden');
            this.filteredPosts = [];
        }
        
        try {
            let postsQuery = query(
                collection(db, 'posts'),
                where('published', '==', true),
                orderBy('createdAt', 'desc'),
                limit(loadMore ? 6 : 12)
            );
            
            if (loadMore && this.lastVisible) {
                postsQuery = query(
                    collection(db, 'posts'),
                    where('published', '==', true),
                    orderBy('createdAt', 'desc'),
                    startAfter(this.lastVisible),
                    limit(6)
                );
            }
            
            const snapshot = await getDocs(postsQuery);
            
            if (!loadMore) {
                this.posts = [];
            }
            
            snapshot.forEach(doc => {
                const postData = doc.data();
                const post = {
                    id: doc.id,
                    ...postData,
                    createdAt: postData.createdAt?.toDate() || new Date()
                };
                
                if (!this.posts.find(p => p.id === post.id)) {
                    this.posts.push(post);
                    
                    // Extract categories
                    if (post.category) {
                        this.categories.add(post.category);
                    }
                    
                    // Extract year
                    const year = post.createdAt.getFullYear();
                    this.years.add(year);
                }
            });
            
            // Update last visible document for pagination
            if (snapshot.docs.length > 0) {
                this.lastVisible = snapshot.docs[snapshot.docs.length - 1];
            }
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showNotification('Failed to load posts. Please try again.', 'error');
        } finally {
            this.isLoading = false;
            loadingEl.classList.add('hidden');
            postsGrid.classList.remove('hidden');
        }
    }
    
    async loadUserLikes() {
        if (!this.currentUser) return;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.userLikes = new Set(userData.likedPosts || []);
            }
        } catch (error) {
            console.error('Error loading user likes:', error);
        }
    }
    
    filterPosts() {
        this.filteredPosts = this.posts.filter(post => {
            // Category filter
            if (this.currentCategory && post.category !== this.currentCategory) {
                return false;
            }
            
            // Year filter
            if (this.currentYear) {
                const postYear = post.createdAt.getFullYear();
                if (postYear.toString() !== this.currentYear) {
                    return false;
                }
            }
            
            // Search filter
            if (this.currentSearch) {
                const searchTerm = this.currentSearch.toLowerCase();
                const titleMatch = post.title?.toLowerCase().includes(searchTerm);
                const excerptMatch = post.excerpt?.toLowerCase().includes(searchTerm);
                const categoryMatch = post.category?.toLowerCase().includes(searchTerm);
                const contentMatch = post.content?.toLowerCase().includes(searchTerm);
                return titleMatch || excerptMatch || categoryMatch || contentMatch;
            }
            
            return true;
        });
        
        this.renderPosts();
        this.updateLoadMoreButton();
    }
    
    renderPosts() {
        const postsGrid = document.getElementById('posts-grid');
        const noResults = document.getElementById('no-results');
        
        if (this.filteredPosts.length === 0) {
            postsGrid.classList.add('hidden');
            noResults.classList.remove('hidden');
            return;
        }
        
        postsGrid.classList.remove('hidden');
        noResults.classList.add('hidden');
        
        postsGrid.innerHTML = this.filteredPosts.map(post => `
            <article class="bg-white dark:bg-emberflare-900 rounded-2xl border border-emberflare-200 dark:border-emberflare-800 overflow-hidden post-card-hover group cursor-pointer"
                     onclick="blogApp.openFullscreenPost('${post.id}')">
                
                ${post.imageUrl ? `
                    <div class="h-48 overflow-hidden relative">
                        <img src="${post.imageUrl}" 
                             alt="${post.title}"
                             class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                             loading="lazy"
                             onerror="this.src='/images/placeholder.jpg'">
                        <div class="absolute top-3 left-3">
                            <span class="px-3 py-1 bg-emberflare-500 text-white text-xs font-semibold rounded-full">
                                ${post.category || 'Uncategorized'}
                            </span>
                        </div>
                    </div>
                ` : `
                    <div class="h-48 bg-gradient-to-br from-emberflare-400 to-emberflare-600 flex items-center justify-center">
                        <span class="material-symbols-outlined text-white text-6xl">
                            article
                        </span>
                    </div>
                `}
                
                <div class="p-6">
                    <div class="flex items-center gap-2 text-sm text-emberflare-500 mb-3">
                        <span class="material-symbols-outlined text-base">calendar_today</span>
                        <span>${this.formatDate(post.createdAt)}</span>
                    </div>
                    
                    <h3 class="text-xl font-bold mb-3 text-gray-900 dark:text-white line-clamp-2">
                        ${this.escapeHtml(post.title)}
                    </h3>
                    
                    <p class="text-gray-600 dark:text-emberflare-300 mb-4 line-clamp-3">
                        ${this.escapeHtml(post.excerpt || '')}
                    </p>
                    
                    <div class="flex items-center justify-between pt-4 border-t border-emberflare-100 dark:border-emberflare-800">
                        <button class="flex items-center gap-2 text-emberflare-600 dark:text-emberflare-400 group-hover:text-emberflare-800 dark:group-hover:text-emberflare-200 transition-colors">
                            <span class="material-symbols-outlined">arrow_forward</span>
                            <span class="font-medium">Read More</span>
                        </button>
                        
                        <div class="flex items-center gap-4">
                            <button onclick="event.stopPropagation(); blogApp.toggleLike('${post.id}', event)"
                                    class="flex items-center gap-1 ${this.userLikes.has(post.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition-colors">
                                <span class="material-symbols-outlined ${this.userLikes.has(post.id) ? 'fill' : ''}">
                                    favorite
                                </span>
                                <span class="text-sm" id="like-count-${post.id}">${post.likes || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `).join('');
    }
    
    updateFilters() {
        // Update category filters
        const categoryContainer = document.getElementById('category-container');
        const categoryButtons = Array.from(this.categories).map(category => `
            <button onclick="blogApp.filterByCategory('${this.escapeHtml(category)}')" 
                    class="category-btn px-4 py-2 bg-emberflare-100 dark:bg-emberflare-800 hover:bg-emberflare-200 dark:hover:bg-emberflare-700 text-emberflare-700 dark:text-emberflare-300 rounded-xl whitespace-nowrap transition-colors">
                ${this.escapeHtml(category)}
            </button>
        `).join('');
        
        categoryContainer.innerHTML += categoryButtons;
        
        // Update year filters
        const yearFilter = document.getElementById('year-filter');
        const yearOptions = Array.from(this.years)
            .sort((a, b) => b - a)
            .map(year => `<option value="${year}">${year}</option>`)
            .join('');
        
        yearFilter.innerHTML += yearOptions;
    }
    
    updateLoadMoreButton() {
        const container = document.getElementById('load-more-container');
        // Show load more if we have posts and there might be more
        const hasMore = this.filteredPosts.length === this.posts.length && 
                       this.posts.length > 0 && 
                       this.posts.length % 12 === 0;
        container.classList.toggle('hidden', !hasMore);
    }
    
    async filterByCategory(category) {
        this.currentCategory = category;
        this.filterPosts();
        
        // Update active category button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('bg-emberflare-500', 'text-white');
            btn.classList.add('bg-emberflare-100', 'dark:bg-emberflare-800', 'text-emberflare-700', 'dark:text-emberflare-300');
        });
        
        if (category) {
            const activeBtn = Array.from(document.querySelectorAll('.category-btn'))
                .find(btn => btn.textContent.trim() === category);
            if (activeBtn) {
                activeBtn.classList.remove('bg-emberflare-100', 'dark:bg-emberflare-800', 'text-emberflare-700', 'dark:text-emberflare-300');
                activeBtn.classList.add('bg-emberflare-500', 'text-white');
            }
        } else {
            const allPostsBtn = document.querySelector('.category-btn');
            if (allPostsBtn) {
                allPostsBtn.classList.remove('bg-emberflare-100', 'dark:bg-emberflare-800', 'text-emberflare-700', 'dark:text-emberflare-300');
                allPostsBtn.classList.add('bg-emberflare-500', 'text-white');
            }
        }
    }
    
    async loadMorePosts() {
        await this.loadPosts(true);
        this.filterPosts();
    }
    
    async openFullscreenPost(postId) {
        try {
            this.currentPostId = postId;
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                throw new Error('Post not found');
            }
            
            const post = {
                id: postSnap.id,
                ...postSnap.data(),
                createdAt: postSnap.data().createdAt?.toDate() || new Date()
            };
            
            // Update URL without reload
            history.pushState({ postId }, '', `?post=${postId}`);
            
            // Show fullscreen view
            const fullscreen = document.getElementById('post-fullscreen');
            fullscreen.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
            
            // Update like button
            document.getElementById('like-count').textContent = post.likes || 0;
            document.getElementById('like-icon').classList.toggle('fill', this.userLikes.has(postId));
            
            // Render post content
            this.renderFullscreenPost(post);
            
            // Load comments
            await this.loadComments(postId);
            
        } catch (error) {
            console.error('Error opening post:', error);
            this.showNotification('Failed to load post. Please try again.', 'error');
        }
    }
    
    renderFullscreenPost(post) {
        const contentEl = document.getElementById('fullscreen-content');
        
        contentEl.innerHTML = `
            <div class="animate-fade-in">
                ${post.imageUrl ? `
                    <div class="mb-8 rounded-2xl overflow-hidden">
                        <img src="${post.imageUrl}" 
                             alt="${post.title}"
                             class="w-full h-96 object-cover"
                             loading="lazy"
                             onerror="this.src='/images/placeholder.jpg'">
                    </div>
                ` : ''}
                
                <div class="mb-8">
                    <div class="flex items-center gap-4 text-sm text-emberflare-500 mb-4">
                        <span class="px-3 py-1 bg-emberflare-100 dark:bg-emberflare-800 rounded-full">
                            ${post.category || 'Uncategorized'}
                        </span>
                        <span class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">calendar_today</span>
                            ${this.formatDate(post.createdAt)}
                        </span>
                    </div>
                    
                    <h1 class="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
                        ${this.escapeHtml(post.title)}
                    </h1>
                    
                    <div class="prose prose-lg dark:prose-invert max-w-none">
                        ${post.content || ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    closeFullscreenPost() {
        const fullscreen = document.getElementById('post-fullscreen');
        fullscreen.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        history.replaceState(null, '', window.location.pathname);
        this.currentPostId = null;
    }
    
    async loadComments(postId) {
        const commentsSection = document.getElementById('comments-section');
        
        try {
            const commentsQuery = query(
                collection(db, 'posts', postId, 'comments'),
                where('visible', '==', true),
                orderBy('createdAt', 'desc')
            );
            
            const snapshot = await getDocs(commentsQuery);
            const comments = [];
            
            snapshot.forEach(doc => {
                comments.push({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                });
            });
            
            this.renderComments(commentsSection, postId, comments);
            
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsSection.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    Failed to load comments
                </div>
            `;
        }
    }
    
    renderComments(container, postId, comments) {
        const isLoggedIn = !!this.currentUser;
        const username = localStorage.getItem('username') || 'Anonymous';
        
        container.innerHTML = `
            <div class="animate-slide-up">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold">Comments</h2>
                    <span class="text-gray-500">${comments.length} comment${comments.length !== 1 ? 's' : ''}</span>
                </div>
                
                ${isLoggedIn ? `
                    <div class="mb-8 bg-emberflare-50 dark:bg-emberflare-900 rounded-2xl p-6">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 bg-emberflare-100 dark:bg-emberflare-800 rounded-full flex items-center justify-center">
                                <span class="material-symbols-outlined text-emberflare-500">
                                    person
                                </span>
                            </div>
                            <span class="font-medium">${this.escapeHtml(username)}</span>
                        </div>
                        <textarea id="comment-input" 
                                  placeholder="Share your thoughts..."
                                  class="w-full bg-transparent border-none focus:outline-none resize-none mb-4 min-h-[100px] p-2"
                                  rows="3"></textarea>
                        <div class="flex justify-end">
                            <button onclick="blogApp.postComment('${postId}')"
                                    class="px-6 py-2 bg-emberflare-500 hover:bg-emberflare-600 text-white font-semibold rounded-xl transition-colors">
                                Post Comment
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="mb-8 bg-emberflare-50 dark:bg-emberflare-900 rounded-2xl p-6 text-center">
                        <p class="text-gray-600 dark:text-emberflare-300 mb-4">
                            Please log in to post comments
                        </p>
                        <button onclick="blogApp.showAuthModal()"
                                class="px-6 py-2 bg-emberflare-500 hover:bg-emberflare-600 text-white font-semibold rounded-xl transition-colors">
                            Log In
                        </button>
                    </div>
                `}
                
                <div id="comments-list" class="space-y-6">
                    ${comments.length > 0 ? comments.map(comment => `
                        <div class="bg-emberflare-50 dark:bg-emberflare-900 rounded-2xl p-6 comment-enter">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-emberflare-100 dark:bg-emberflare-800 rounded-full flex items-center justify-center">
                                        <span class="material-symbols-outlined text-emberflare-500">
                                            person
                                        </span>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-semibold">${this.escapeHtml(comment.authorName || 'Anonymous')}</span>
                                            ${comment.isAdmin ? `
                                                <img src="/images/admin-badge.png" alt="Admin" class="w-4 h-4">
                                            ` : ''}
                                        </div>
                                        <span class="text-xs text-gray-500">
                                            ${this.formatRelativeTime(comment.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                
                                ${comment.userId === this.currentUser?.uid ? `
                                    <button onclick="blogApp.deleteComment('${postId}', '${comment.id}')"
                                            class="text-gray-400 hover:text-red-500 p-1">
                                        <span class="material-symbols-outlined">delete</span>
                                    </button>
                                ` : ''}
                            </div>
                            
                            ${comment.moderated ? `
                                <div class="blurred relative rounded-lg overflow-hidden">
                                    <div class="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                                        <div class="text-center p-4 bg-white/80 dark:bg-black/80 rounded-lg">
                                            <span class="material-symbols-outlined text-4xl text-emberflare-400 mb-2">
                                                warning
                                            </span>
                                            <p class="text-sm text-gray-600 dark:text-gray-300">Content moderated for respectful communication</p>
                                            ${comment.moderatedReason ? `
                                                <p class="text-xs text-gray-500 mt-1">Reason: ${comment.moderatedReason}</p>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <p class="text-gray-700 dark:text-emberflare-300 whitespace-pre-wrap">${this.escapeHtml(comment.content)}</p>
                            `}
                            
                            ${comment.reply ? `
                                <div class="mt-4 pl-4 border-l-2 border-emberflare-300">
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="font-medium text-emberflare-700 dark:text-emberflare-300">Admin Reply</span>
                                        <img src="/images/admin-badge.png" alt="Admin" class="w-4 h-4">
                                    </div>
                                    <p class="text-gray-700 dark:text-emberflare-300">${this.escapeHtml(comment.reply)}</p>
                                </div>
                            ` : ''}
                        </div>
                    `).join('') : `
                        <div class="text-center py-12 text-gray-500">
                            <span class="material-symbols-outlined text-6xl mb-4">
                                forum
                            </span>
                            <p>No comments yet. Be the first to share your thoughts!</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    
    async toggleLike(postId, event = null) {
        if (!this.currentUser) {
            this.showAuthModal();
            return;
        }
        
        try {
            const postRef = doc(db, 'posts', postId);
            const userRef = doc(db, 'users', this.currentUser.uid);
            
            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                const userDoc = await transaction.get(userRef);
                
                if (!postDoc.exists()) {
                    throw new Error('Post not found');
                }
                
                const post = postDoc.data();
                const userData = userDoc.exists() ? userDoc.data() : { likedPosts: [] };
                
                const liked = userData.likedPosts?.includes(postId) || false;
                const newLikes = liked ? (post.likes || 0) - 1 : (post.likes || 0) + 1;
                const newLikedPosts = liked 
                    ? (userData.likedPosts || []).filter(id => id !== postId)
                    : [...(userData.likedPosts || []), postId];
                
                // Update post likes
                transaction.update(postRef, {
                    likes: newLikes
                });
                
                // Update user liked posts
                transaction.set(userRef, {
                    likedPosts: newLikedPosts,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                
                // Update local state
                if (liked) {
                    this.userLikes.delete(postId);
                } else {
                    this.userLikes.add(postId);
                }
                
                // Update UI
                if (postId === this.currentPostId) {
                    document.getElementById('like-count').textContent = newLikes;
                    document.getElementById('like-icon').classList.toggle('fill', !liked);
                }
                
                const likeCountEl = document.getElementById(`like-count-${postId}`);
                if (likeCountEl) {
                    likeCountEl.textContent = newLikes;
                }
                
                if (event) {
                    const button = event.currentTarget;
                    button.classList.toggle('text-red-500', !liked);
                    button.classList.toggle('text-gray-500', liked);
                    button.querySelector('.material-symbols-outlined').classList.toggle('fill', !liked);
                }
                
                this.showNotification(liked ? 'Like removed' : 'Post liked!', 'success');
            });
            
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showNotification('Failed to update like', 'error');
        }
    }
    
    async postComment(postId) {
        if (!this.currentUser) {
            this.showAuthModal();
            return;
        }
        
        const commentInput = document.getElementById('comment-input');
        const content = commentInput.value.trim();
        
        if (!content) {
            this.showNotification('Please enter a comment', 'error');
            return;
        }
        
        // Check for restricted content
        const moderationResult = this.moderateContent(content);
        if (moderationResult.blocked) {
            this.showNotification(moderationResult.reason, 'error');
            return;
        }
        
        try {
            const username = localStorage.getItem('username') || 'Anonymous';
            
            const commentData = {
                content,
                userId: this.currentUser.uid,
                authorName: username,
                isAdmin: false,
                moderated: moderationResult.moderated,
                moderatedReason: moderationResult.reason,
                visible: !moderationResult.blocked,
                createdAt: serverTimestamp()
            };
            
            await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
            
            commentInput.value = '';
            this.showNotification('Comment posted successfully', 'success');
            
            // Reload comments
            await this.loadComments(postId);
            
        } catch (error) {
            console.error('Error posting comment:', error);
            this.showNotification('Failed to post comment', 'error');
        }
    }
    
    moderateContent(content) {
        const restrictedPatterns = [
            { pattern: /eldrex.*delos.*reyes.*bula/i, reason: 'Admin impersonation', action: 'block' },
            { pattern: /admin.*password/i, reason: 'Security concern', action: 'block' },
            { pattern: /hack|hacking|exploit/i, reason: 'Security concern', action: 'block' },
            { pattern: /spam.*link|http.*:\/\//i, reason: 'No links allowed', action: 'block' },
            { pattern: /@.*\..*/, reason: 'No email addresses', action: 'block' }
        ];
        
        const moderatedPatterns = [
            { pattern: /idiot|stupid|dumb|ugly/i, reason: 'Disrespectful language' },
            { pattern: /hate|kill|die|suicide/i, reason: 'Harmful content' },
            { pattern: /shit|fuck|damn|asshole/i, reason: 'Profanity' },
            { pattern: /racist|sexist|homophobic/i, reason: 'Discriminatory language' },
            { pattern: /cunt|bitch|whore/i, reason: 'Offensive language' }
        ];
        
        // Check for blocked content
        for (const { pattern, reason, action } of restrictedPatterns) {
            if (pattern.test(content)) {
                return { blocked: true, moderated: false, reason };
            }
        }
        
        // Check for moderated content
        for (const { pattern, reason } of moderatedPatterns) {
            if (pattern.test(content)) {
                return { blocked: false, moderated: true, reason };
            }
        }
        
        return { blocked: false, moderated: false, reason: null };
    }
    
    async deleteComment(postId, commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        
        try {
            await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
                visible: false,
                deletedAt: serverTimestamp()
            });
            
            this.showNotification('Comment deleted', 'success');
            await this.loadComments(postId);
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            this.showNotification('Failed to delete comment', 'error');
        }
    }
    
    showAuthModal() {
        document.getElementById('auth-modal').classList.remove('hidden');
    }
    
    closeAuthModal() {
        document.getElementById('auth-modal').classList.add('hidden');
    }
    
    showUsernameModal() {
        document.getElementById('username-modal').classList.remove('hidden');
    }
    
    closeUsernameModal() {
        document.getElementById('username-modal').classList.add('hidden');
    }
    
    async loginAnonymously() {
        try {
            const result = await signInAnonymously(auth);
            this.closeAuthModal();
            this.showNotification('Logged in anonymously', 'success');
            
            // Show username modal
            setTimeout(() => this.showUsernameModal(), 500);
            
        } catch (error) {
            console.error('Anonymous login error:', error);
            this.showNotification('Failed to log in', 'error');
        }
    }
    
    continueWithoutLogin() {
        this.closeAuthModal();
        this.showNotification('You can still read posts and comments', 'info');
    }
    
    setUsername() {
        const input = document.getElementById('username-input');
        const username = input.value.trim();
        
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            return;
        }
        
        if (this.isUsernameRestricted(username)) {
            this.showNotification('This username is not allowed', 'error');
            return;
        }
        
        localStorage.setItem('username', username);
        this.closeUsernameModal();
        this.showNotification('Username set successfully', 'success');
        this.updateAuthUI();
    }
    
    skipUsername() {
        this.closeUsernameModal();
        this.showNotification('You can set a username later in settings', 'info');
    }
    
    openSettings() {
        const panel = document.getElementById('settings-panel');
        const username = localStorage.getItem('username') || '';
        document.getElementById('settings-username').value = username;
        panel.classList.remove('hidden');
        setTimeout(() => {
            panel.querySelector('.absolute.bottom-0').style.transform = 'translateY(0)';
        }, 10);
    }
    
    closeSettings() {
        const panel = document.getElementById('settings-panel');
        panel.querySelector('.absolute.bottom-0').style.transform = 'translateY(100%)';
        setTimeout(() => {
            panel.classList.add('hidden');
        }, 300);
    }
    
    updateAuthUI() {
        const authInfo = document.getElementById('auth-info');
        const logoutBtn = document.getElementById('logout-btn');
        const authStatus = document.getElementById('auth-status');
        
        if (this.currentUser) {
            authInfo.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            
            const username = localStorage.getItem('username') || 'Anonymous';
            document.getElementById('current-username').textContent = username;
            
            authStatus.innerHTML = '<span class="material-symbols-outlined text-emberflare-500">account_circle</span>';
        } else {
            authInfo.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            authStatus.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
        }
    }
    
    toggleAuthMenu() {
        document.getElementById('auth-dropdown').classList.toggle('hidden');
    }
    
    updateUsername() {
        const input = document.getElementById('settings-username');
        const username = input.value.trim();
        
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            return;
        }
        
        if (this.isUsernameRestricted(username)) {
            this.showNotification('This username is not allowed', 'error');
            return;
        }
        
        localStorage.setItem('username', username);
        this.showNotification('Username updated', 'success');
        this.updateAuthUI();
        this.closeSettings();
    }
    
    removeUsername() {
        localStorage.removeItem('username');
        document.getElementById('settings-username').value = '';
        this.showNotification('Username removed', 'success');
        this.updateAuthUI();
    }
    
    isUsernameRestricted(username) {
        const restricted = [
            'admin',
            'administrator',
            'eldrex',
            'moderator',
            'system',
            'root',
            'superuser'
        ];
        
        const usernameLower = username.toLowerCase();
        return restricted.some(name => usernameLower.includes(name));
    }
    
    async logout() {
        try {
            await signOut(auth);
            localStorage.removeItem('username');
            this.userLikes.clear();
            this.updateAuthUI();
            this.showNotification('Logged out successfully', 'success');
            document.getElementById('auth-dropdown').classList.add('hidden');
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Failed to log out', 'error');
        }
    }
    
    sharePost() {
        const postTitle = document.querySelector('#fullscreen-content h1')?.textContent || 'Eldrex Writings Post';
        const postUrl = window.location.href;
        
        const shareData = {
            title: postTitle,
            text: `Check out this post on Eldrex Writings: ${postTitle}`,
            url: postUrl
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            navigator.clipboard.writeText(postUrl);
            this.showNotification('Link copied to clipboard', 'success');
        }
    }
    
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        
        return this.formatDate(date);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-emberflare-500'
        }[type];
        
        notification.className = `${bgColor} text-white px-6 py-3 rounded-xl shadow-lg animate-slide-up flex items-center justify-between min-w-[300px]`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-4 hover:opacity-80">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('opacity-0', 'translate-x-4');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// Initialize app
window.blogApp = new BlogApp();

// Global helper functions
window.closeAuthModal = () => blogApp.closeAuthModal();
window.loginAnonymously = () => blogApp.loginAnonymously();
window.continueWithoutLogin = () => blogApp.continueWithoutLogin();
window.setUsername = () => blogApp.setUsername();
window.skipUsername = () => blogApp.skipUsername();
window.openSettings = () => blogApp.openSettings();
window.closeSettings = () => blogApp.closeSettings();
window.updateUsername = () => blogApp.updateUsername();
window.removeUsername = () => blogApp.removeUsername();
window.logout = () => blogApp.logout();
window.toggleAuthMenu = () => blogApp.toggleAuthMenu();
window.filterByCategory = (category) => blogApp.filterByCategory(category);
window.loadMorePosts = () => blogApp.loadMorePosts();
window.sharePost = () => blogApp.sharePost();
window.toggleLike = () => blogApp.toggleLike(blogApp.currentPostId);
window.closeFullscreenPost = () => blogApp.closeFullscreenPost();
window.clearSearch = () => {
    document.getElementById('search-input').value = '';
    blogApp.currentSearch = '';
    blogApp.filterPosts();
    blogApp.updateClearSearchButton();
};

// Handle browser back button for fullscreen post
window.addEventListener('popstate', (event) => {
    if (event.state?.postId) {
        blogApp.openFullscreenPost(event.state.postId);
    } else {
        blogApp.closeFullscreenPost();
    }
});
