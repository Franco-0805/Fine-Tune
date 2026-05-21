document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const personaInput = document.getElementById('persona-name');
    const chatTitle = document.getElementById('chat-title');
    const headerAvatar = document.getElementById('header-avatar');
    
    const uploadArea = document.getElementById('upload-area');
    const fileUpload = document.getElementById('file-upload');
    const corpusList = document.getElementById('corpus-list');
    
    const trainBtn = document.getElementById('train-btn');
    const btnText = trainBtn.querySelector('.btn-text');
    const loader = trainBtn.querySelector('.loader');
    const statusIndicator = document.getElementById('training-status');
    const statusText = statusIndicator.querySelector('.status-text');
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const welcomeModal = document.getElementById('welcome-modal');
    const welcomePersonaInput = document.getElementById('welcome-persona');
    const welcomeConfirm = document.getElementById('welcome-confirm');
    const personaSummary = document.getElementById('persona-summary');
    const personaProfileEl = document.getElementById('persona-profile');
    const newPersonaBtn = document.getElementById('new-persona-btn');

    let isTrained = false;
    let uploadedFiles = [];
    let isPersonaInitialized = false;
    let personaProfile = '';
    let personaName = 'Custom Persona';
    const API_BASE = 'http://localhost:8000/api';

    // 1. Persona Sync
    const updatePersona = (name = null, lock = false) => {
        personaName = name ? name.trim() : personaInput.value.trim() || 'Custom Persona';
        if (!personaName) personaName = 'Custom Persona';
        personaInput.value = personaName;
        chatTitle.textContent = personaName;
        
        if (lock) {
            personaInput.readOnly = true;
            personaInput.classList.add('readonly');
        }
        
        const initials = personaName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        headerAvatar.textContent = initials;
        
        // Update initial bot avatar if exists
        const firstBotMsg = document.querySelector('.bot-message .message-avatar');
        if (firstBotMsg) firstBotMsg.textContent = initials;
    };

    const showWelcomeModal = () => {
        welcomeModal.classList.remove('hidden');
        welcomePersonaInput.focus();
    };

    const hideWelcomeModal = () => {
        welcomeModal.classList.add('hidden');
    };

    const renderPersonaProfile = (profile) => {
        personaProfile = profile || '';
        if (personaProfile) {
            personaSummary.classList.remove('hidden');
            personaProfileEl.textContent = personaProfile;
        } else {
            personaSummary.classList.add('hidden');
            personaProfileEl.textContent = '';
        }
    };

    const clearChat = () => {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-avatar">${headerAvatar.textContent}</div>
                <div class="message-content">
                    <p>Welcome! Please choose a new persona to start a fresh tone mimic session.</p>
                    <span class="message-time">Just now</span>
                </div>
            </div>
        `;
    };

    const resetSession = () => {
        isTrained = false;
        uploadedFiles = [];
        isPersonaInitialized = false;
        personaProfile = '';
        personaName = 'Custom Persona';
        personaInput.readOnly = false;
        personaInput.classList.remove('readonly');
        renderPersonaProfile('');
        renderCorpusList();
        clearChat();
        updatePersona('Custom Persona', false);
        btnText.textContent = 'Start Learning';
        statusIndicator.className = 'status-indicator';
        statusText.textContent = 'Ready to learn';
    };

    const initPersona = async (name) => {
        personaName = name.trim() || 'Custom Persona';
        updatePersona(personaName, true);
        statusIndicator.className = 'status-indicator learning';
        statusText.textContent = 'Retrieving persona background...';
        
        try {
            const res = await fetch(`${API_BASE}/init_persona`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona_name: personaName })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Initialization failed');
            }

            const data = await res.json();
            isPersonaInitialized = true;
            renderPersonaProfile(data.profile);
            statusIndicator.className = 'status-indicator ready';
            statusText.textContent = 'Persona initialized. You can chat or upload corpus to enhance learning.';
            addBotMessage(`Persona profile for ${personaName} has been retrieved. You can chat now or upload additional corpus for second-stage learning.`);
        } catch (e) {
            console.error(e);
            statusIndicator.className = 'status-indicator';
            statusText.textContent = 'Initialization failed. Please refresh and try again.';
            alert(`Initialization failed: ${e.message}`);
            updatePersona('Custom Persona', false);
        }
    };
    
    welcomeConfirm.addEventListener('click', () => {
        const name = welcomePersonaInput.value.trim();
        if (!name) {
            alert('Please enter the name of the persona you want to mimic.');
            welcomePersonaInput.focus();
            return;
        }
        hideWelcomeModal();
        initPersona(name);
    });

    welcomePersonaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            welcomeConfirm.click();
        }
    });

    newPersonaBtn.addEventListener('click', () => {
        resetSession();
        showWelcomeModal();
    });

    personaInput.addEventListener('input', updatePersona);
    updatePersona(); // init
    showWelcomeModal();

    // 2. File Upload (Drag & Drop + Click)
    uploadArea.addEventListener('click', () => fileUpload.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    fileUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });
    
    async function handleFiles(files) {
        if (!isPersonaInitialized) {
            alert('Please initialize the persona first.');
            return;
        }

        for (const file of files) {
            if (file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.docx')) {
                // Upload to backend
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                    const res = await fetch(`${API_BASE}/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (res.ok) {
                        uploadedFiles.push(file.name);
                        renderCorpusList();
                    } else {
                        const err = await res.json();
                        alert(`Upload failed: ${err.detail}`);
                    }
                } catch (e) {
                    console.error(e);
                    alert('Network error while uploading.');
                }
            } else {
                alert('Only .txt, .md, .doc, and .docx files are allowed.');
            }
        }
    }
    
    function renderCorpusList() {
        corpusList.innerHTML = '';
        uploadedFiles.forEach((fileName, index) => {
            const div = document.createElement('div');
            div.className = 'corpus-item';
            div.innerHTML = `
                <div class="file-name">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    ${fileName}
                </div>
            `;
            corpusList.appendChild(div);
        });
    }

    // 3. Training API call
    trainBtn.addEventListener('click', async () => {
        if (!isPersonaInitialized) {
            alert('Please enter and initialize the persona you want to mimic first.');
            return;
        }

        if (uploadedFiles.length === 0) {
            alert('Please upload some corpus files before starting second-stage learning.');
            return;
        }
        
        trainBtn.disabled = true;
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        
        statusIndicator.className = 'status-indicator learning';
        statusText.textContent = 'Fusing uploaded corpus with persona background...';
        
        try {
            const res = await fetch(`${API_BASE}/train`, { method: 'POST' });
            if (res.ok) {
                isTrained = true;
                
                btnText.classList.remove('hidden');
                loader.classList.add('hidden');
                trainBtn.disabled = false;
                btnText.textContent = 'Retrain';
                
                statusIndicator.className = 'status-indicator ready';
                statusText.textContent = 'Persona and corpus fused. Ready to chat.';
                
                addBotMessage(`I have fused ${uploadedFiles.length} uploaded corpus files with ${personaName}'s persona profile. You can now start asking questions.`);
            } else {
                const err = await res.json();
                throw new Error(err.detail || 'Training failed');
            }
        } catch (e) {
            console.error(e);
            alert(`Second-stage learning failed: ${e.message}`);
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            trainBtn.disabled = false;
            statusIndicator.className = 'status-indicator';
            statusText.textContent = 'Error occurred';
        }
    });

    // 4. Chat Interactions
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = messageInput.value.trim().length === 0;
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    sendBtn.addEventListener('click', sendMessage);
    
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        
        addUserMessage(text);
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendBtn.disabled = true;
        
        if (!isPersonaInitialized) {
            setTimeout(() => {
                addBotMessage('Please enter and initialize the persona you want to mimic first.');
            }, 300);
            return;
        }

        // Show typing indicator or just wait for response
        const typingId = addTypingIndicator();
        
        try {
            const personaName = personaInput.value.trim() || 'Custom Persona';
            const res = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, persona_name: personaName })
            });
            
            removeTypingIndicator(typingId);
            
            if (res.ok) {
                const data = await res.json();
                addBotMessage(data.reply);
            } else {
                const err = await res.json();
                addBotMessage(`[Error: ${err.detail}]`);
            }
        } catch (e) {
            console.error(e);
            removeTypingIndicator(typingId);
            addBotMessage("[Network Error] Cannot reach backend server.");
        }
    }
    
    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'message user-message';
        div.innerHTML = `
            <div class="message-avatar">You</div>
            <div class="message-content">
                <p>${escapeHTML(text)}</p>
                <span class="message-time">Just now</span>
            </div>
        `;
        chatMessages.appendChild(div);
        scrollToBottom();
    }
    
    function addBotMessage(text) {
        const initials = headerAvatar.textContent;
        const div = document.createElement('div');
        div.className = 'message bot-message';
        div.innerHTML = `
            <div class="message-avatar">${initials}</div>
            <div class="message-content">
                <p>${escapeHTML(text)}</p>
                <span class="message-time">Just now</span>
            </div>
        `;
        chatMessages.appendChild(div);
        scrollToBottom();
    }
    
    function addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const initials = headerAvatar.textContent;
        const div = document.createElement('div');
        div.className = 'message bot-message typing-msg';
        div.id = id;
        div.innerHTML = `
            <div class="message-avatar">${initials}</div>
            <div class="message-content">
                <p>...</p>
            </div>
        `;
        chatMessages.appendChild(div);
        scrollToBottom();
        return id;
    }
    
    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
    
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
});
