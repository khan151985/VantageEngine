/* ========================================
   Sirah Maps - AI Integration (OpenAI)
   ======================================== */

const AI = {
    // Default API key (will be overridden by user settings)
    apiKey: '',
    
    // API endpoint
    endpoint: 'https://api.openai.com/v1/chat/completions',
    
    // Model to use
    model: 'gpt-4o-mini',
    
    // Initialize
    init() {
        // Load saved API key
        const savedKey = Storage.get('openai_key');
        if (savedKey) {
            this.apiKey = savedKey;
        }
    },
    
    // Set API key
    setApiKey(key) {
        this.apiKey = key;
    },
    
    // Test API connection
    async testConnection() {
        try {
            const response = await this.chat([
                { role: 'user', content: 'Say "OK" if you can read this.' }
            ], { max_tokens: 10 });
            
            return response.toLowerCase().includes('ok');
        } catch (err) {
            console.error('API test failed:', err);
            return false;
        }
    },
    
    // Generic chat completion
    async chat(messages, options = {}) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: options.model || this.model,
                messages,
                max_tokens: options.max_tokens || 2000,
                temperature: options.temperature || 0.7
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    },
    
    // Translate text to target language
    async translateText(text, targetLang) {
        const langNames = {
            'ar': 'Arabic',
            'ur': 'Urdu',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'tr': 'Turkish',
            'id': 'Indonesian',
            'ms': 'Malay',
            'bn': 'Bengali',
            'hi': 'Hindi',
            'zh': 'Chinese (Simplified)',
            'ja': 'Japanese',
            'ko': 'Korean',
            'ru': 'Russian',
            'pt': 'Portuguese',
            'it': 'Italian',
            'nl': 'Dutch',
            'pl': 'Polish',
            'th': 'Thai',
            'vi': 'Vietnamese'
        };
        
        const targetName = langNames[targetLang] || targetLang;
        
        const prompt = `Translate the following text to ${targetName}. 
Preserve any formatting markers like "---" as separators.
Keep the same structure and tone.
If the text contains Islamic or historical terms, use appropriate translations.

Text to translate:
${text}

Provide only the translation, no explanations.`;
        
        return this.chat([
            { role: 'system', content: 'You are a professional translator specializing in Islamic historical content. Provide accurate, culturally appropriate translations.' },
            { role: 'user', content: prompt }
        ]);
    },
    
    // Translate to all project languages
    async translateToAllLanguages(text, sourceLang = 'en') {
        const languages = State.getProject('languages');
        const translations = { [sourceLang]: text };
        
        for (const lang of languages) {
            if (lang.code === sourceLang) continue;
            
            try {
                translations[lang.code] = await this.translateText(text, lang.code);
            } catch (err) {
                console.error(`Translation to ${lang.code} failed:`, err);
                translations[lang.code] = null;
            }
        }
        
        return translations;
    },
    
    // Enhance/improve content
    async enhanceContent(text, options = {}) {
        const style = options.style || 'informative';
        const context = options.context || 'Islamic historical content';
        
        const prompt = `Enhance the following ${context} text to be more ${style} and engaging.
Improve clarity, flow, and readability while maintaining accuracy.
Keep the same general length unless asked otherwise.
Preserve any important facts and details.

Original text:
${text}

Provide only the enhanced text, no explanations.`;
        
        return this.chat([
            { role: 'system', content: 'You are an expert content editor specializing in Islamic history and educational content. Improve texts while maintaining historical accuracy and respect.' },
            { role: 'user', content: prompt }
        ]);
    },
    
    // Generate description from topic
    async generateDescription(topic, options = {}) {
        const length = options.length || 'medium'; // short, medium, long
        const style = options.style || 'educational';
        
        const lengthGuide = {
            short: '2-3 sentences',
            medium: '1-2 paragraphs',
            long: '3-4 paragraphs'
        };
        
        const prompt = `Write a ${style} description about "${topic}" for an interactive historical map.
Length: ${lengthGuide[length]}
Style: Engaging, informative, respectful of Islamic traditions.
Include relevant historical context and significance.

Provide only the description, no titles or headers.`;
        
        return this.chat([
            { role: 'system', content: 'You are an expert in Islamic history, particularly the Seerah (life of Prophet Muhammad PBUH) and early Islamic period. Write accurate, engaging, and respectful content.' },
            { role: 'user', content: prompt }
        ]);
    },
    
    // Suggest category/tags for content
    async suggestTags(content) {
        const prompt = `Analyze this historical content and suggest 3-5 relevant tags/categories.
Return tags as a comma-separated list.

Content:
${content}

Tags:`;
        
        const response = await this.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: 100 });
        
        return response.split(',').map(tag => tag.trim());
    },
    
    // Generate alt text for images
    async generateAltText(imageDescription) {
        const prompt = `Write a concise alt text description for an image showing: ${imageDescription}
The image is part of an Islamic historical map.
Keep it under 125 characters.`;
        
        return this.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: 50 });
    },
    
    // Summarize long content
    async summarize(text, maxLength = 100) {
        const prompt = `Summarize this text in ${maxLength} words or less, preserving key historical information:

${text}`;
        
        return this.chat([
            { role: 'user', content: prompt }
        ], { max_tokens: maxLength * 2 });
    },
    
    // Generate audio narration script
    async generateNarrationScript(content) {
        const prompt = `Convert this written content into a natural-sounding narration script.
Make it suitable for audio narration, with natural pacing.
Keep the same information but make it more conversational.

Content:
${content}

Narration script:`;
        
        return this.chat([
            { role: 'system', content: 'You are a scriptwriter for educational audio content. Create engaging, clear narration that sounds natural when spoken.' },
            { role: 'user', content: prompt }
        ]);
    },
    
    // Semantic search across content
    async semanticSearch(query, contents) {
        const prompt = `Given this search query: "${query}"
        
Rate the relevance of each content item (0-100) and return as JSON:
${contents.map((c, i) => `[${i}]: ${c.substring(0, 200)}...`).join('\n')}

Return format: {"scores": [score1, score2, ...]}`;
        
        try {
            const response = await this.chat([
                { role: 'user', content: prompt }
            ], { temperature: 0 });
            
            const result = JSON.parse(response);
            return result.scores;
        } catch (err) {
            // Fallback to simple keyword matching
            return contents.map(c => {
                const lower = c.toLowerCase();
                const queryWords = query.toLowerCase().split(' ');
                return queryWords.filter(w => lower.includes(w)).length * 20;
            });
        }
    },
    
    // Batch translate (more efficient for multiple texts)
    async batchTranslate(texts, targetLang) {
        const combined = texts.map((t, i) => `[${i}] ${t}`).join('\n---\n');
        
        const prompt = `Translate each numbered item to ${targetLang}. Keep the same numbering format.

${combined}`;
        
        const response = await this.chat([
            { role: 'system', content: 'You are a professional translator. Translate each numbered item, preserving the format.' },
            { role: 'user', content: prompt }
        ]);
        
        // Parse response back to array
        const translations = response.split(/\n---\n|\[\d+\]/).filter(t => t.trim());
        return translations.map(t => t.trim());
    },
    
    // Check content for issues
    async reviewContent(content) {
        const prompt = `Review this historical content for:
1. Factual accuracy (Islamic history)
2. Respectfulness
3. Clarity
4. Spelling/grammar

Content:
${content}

Provide brief feedback in JSON format:
{"issues": ["issue1", ...], "suggestions": ["suggestion1", ...], "score": 1-10}`;
        
        try {
            const response = await this.chat([
                { role: 'system', content: 'You are an Islamic history expert and content reviewer. Provide constructive feedback.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.3 });
            
            return JSON.parse(response);
        } catch (err) {
            return { issues: [], suggestions: [], score: 7 };
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    AI.init();
});

// Export
window.AI = AI;
