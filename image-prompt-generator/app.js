/**
 * Image Prompt Generator
 * Aplicación para describir imágenes y generar prompts para Gemini AI
 */

// ========================================
// DOM Elements
// ========================================
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImage');
const imageName = document.getElementById('imageName');
const imageSize = document.getElementById('imageSize');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const generateBtn = document.getElementById('generateBtn');
const resultsSection = document.getElementById('resultsSection');
const descriptionText = document.getElementById('descriptionText');
const simplePrompt = document.getElementById('simplePrompt');
const detailedPrompt = document.getElementById('detailedPrompt');
const creativePrompt = document.getElementById('creativePrompt');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// ========================================
// State
// ========================================
let currentImage = null;
let imageBase64 = null;

// ========================================
// Event Listeners
// ========================================

// Upload area click
uploadArea.addEventListener('click', () => fileInput.click());

// File input change
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Remove image
removeImageBtn.addEventListener('click', removeImage);

// Toggle API key visibility
toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);

// API key input
apiKeyInput.addEventListener('input', updateGenerateButton);

// Generate button
generateBtn.addEventListener('click', generatePrompts);

// Copy buttons
document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        const targetElement = document.getElementById(targetId);
        copyToClipboard(targetElement.textContent);
    });
});

// ========================================
// Functions
// ========================================

/**
 * Handle file selection from input
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

/**
 * Process the selected file
 */
function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen válida', 'error');
        return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('La imagen es demasiado grande (máx. 10MB)', 'error');
        return;
    }

    currentImage = file;

    // Update file info
    imageName.textContent = file.name;
    imageSize.textContent = formatFileSize(file.size);

    // Read and display preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        // Extract base64 data (remove the data:image/...;base64, prefix)
        imageBase64 = e.target.result.split(',')[1];
        uploadArea.style.display = 'none';
        previewContainer.style.display = 'block';
        updateGenerateButton();
    };
    reader.readAsDataURL(file);
}

/**
 * Remove the current image
 */
function removeImage() {
    currentImage = null;
    imageBase64 = null;
    previewImage.src = '';
    fileInput.value = '';
    previewContainer.style.display = 'none';
    uploadArea.style.display = 'block';
    resultsSection.style.display = 'none';
    updateGenerateButton();
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
}

/**
 * Update generate button state
 */
function updateGenerateButton() {
    const hasImage = currentImage !== null;
    const hasApiKey = apiKeyInput.value.trim().length > 0;
    generateBtn.disabled = !(hasImage && hasApiKey);
}

/**
 * Generate prompts using Gemini API
 */
async function generatePrompts() {
    const apiKey = apiKeyInput.value.trim();

    if (!imageBase64 || !apiKey) {
        showToast('Por favor sube una imagen e ingresa tu API Key', 'error');
        return;
    }

    // Update UI to loading state
    setLoading(true);

    try {
        // Get image description
        const description = await analyzeImage(apiKey, imageBase64, currentImage.type);
        descriptionText.textContent = description;

        // Generate prompts based on description
        const prompts = await generateImagePrompts(apiKey, description);

        simplePrompt.textContent = prompts.simple;
        detailedPrompt.textContent = prompts.detailed;
        creativePrompt.textContent = prompts.creative;

        // Show results
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        showToast('¡Análisis completado!');
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message || 'Error al procesar la imagen', 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Analyze image using Gemini Vision API
 */
async function analyzeImage(apiKey, base64Data, mimeType) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [
                {
                    text: `Analiza esta imagen en detalle. Describe:
1. El tema principal y sujeto de la imagen
2. Los colores predominantes y la paleta de colores
3. El estilo visual (fotográfico, artístico, minimalista, etc.)
4. La composición y encuadre
5. La iluminación y atmósfera
6. Los elementos de fondo y contexto
7. Cualquier texto, símbolos o elementos distintivos
8. El estado de ánimo o emoción que transmite

Proporciona una descripción completa y detallada en español.`
                },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error al analizar la imagen');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Generate image prompts based on description
 */
async function generateImagePrompts(apiKey, description) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: `Basándote en la siguiente descripción de una imagen, genera 3 prompts optimizados para crear imágenes similares usando Gemini Imagen o modelos similares de generación de imágenes.

DESCRIPCIÓN DE LA IMAGEN:
${description}

Genera exactamente 3 prompts con diferentes niveles de detalle:

1. **PROMPT SIMPLE**: Un prompt corto y directo (1-2 oraciones) que capture la esencia principal.

2. **PROMPT DETALLADO**: Un prompt más elaborado (3-4 oraciones) que incluya detalles sobre estilo, colores, composición e iluminación.

3. **PROMPT CREATIVO**: Un prompt artístico (3-4 oraciones) que añada elementos creativos, estilos artísticos específicos, o variaciones interesantes mientras mantiene la esencia.

IMPORTANTE: 
- Escribe los prompts en inglés (los modelos de generación funcionan mejor en inglés)
- No incluyas explicaciones, solo los prompts
- Separa cada prompt claramente

Formato de respuesta:
SIMPLE:
[prompt simple aquí]

DETAILED:
[prompt detallado aquí]

CREATIVE:
[prompt creativo aquí]`
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error al generar prompts');
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;

    // Parse the response to extract prompts
    return parsePrompts(responseText);
}

/**
 * Parse the API response to extract individual prompts
 */
function parsePrompts(text) {
    const result = {
        simple: '',
        detailed: '',
        creative: ''
    };

    // Try to extract prompts using various patterns
    const simpleMatch = text.match(/SIMPLE:\s*\n?([\s\S]*?)(?=DETAILED:|$)/i);
    const detailedMatch = text.match(/DETAILED:\s*\n?([\s\S]*?)(?=CREATIVE:|$)/i);
    const creativeMatch = text.match(/CREATIVE:\s*\n?([\s\S]*?)$/i);

    if (simpleMatch) {
        result.simple = simpleMatch[1].trim();
    }
    if (detailedMatch) {
        result.detailed = detailedMatch[1].trim();
    }
    if (creativeMatch) {
        result.creative = creativeMatch[1].trim();
    }

    // Fallback: if parsing fails, split by double newlines
    if (!result.simple && !result.detailed && !result.creative) {
        const parts = text.split(/\n\n+/).filter(p => p.trim());
        if (parts.length >= 3) {
            result.simple = parts[0].replace(/^[\d\.\*]+\s*/, '').trim();
            result.detailed = parts[1].replace(/^[\d\.\*]+\s*/, '').trim();
            result.creative = parts[2].replace(/^[\d\.\*]+\s*/, '').trim();
        } else {
            // Last resort: use the full text for all
            result.simple = text;
            result.detailed = text;
            result.creative = text;
        }
    }

    return result;
}

/**
 * Set loading state
 */
function setLoading(isLoading) {
    const buttonContent = generateBtn.querySelector('.button-content');
    const buttonLoader = generateBtn.querySelector('.button-loader');

    generateBtn.disabled = isLoading;
    buttonContent.style.display = isLoading ? 'none' : 'flex';
    buttonLoader.style.display = isLoading ? 'flex' : 'none';
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('¡Copiado al portapapeles!');
    } catch (error) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('¡Copiado al portapapeles!');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    toastMessage.textContent = message;

    // Update icon color based on type
    const icon = toast.querySelector('svg');
    if (type === 'error') {
        icon.style.color = 'var(--color-error)';
    } else {
        icon.style.color = 'var(--color-success)';
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Format file size to human readable
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========================================
// Initialize
// ========================================

// Load saved API key from localStorage
const savedApiKey = localStorage.getItem('gemini_api_key');
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    updateGenerateButton();
}

// Save API key to localStorage when changed
apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
});
