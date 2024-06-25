
import { OpenAIChatProvider, ClaudeChatProvider } from './api.js';
import { Logger } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const promptNameInput = document.getElementById('promptName');
    const gptModelsSelect = document.getElementById('gptModels');
    const contextTextarea = document.getElementById('context');
    const promptTextarea = document.getElementById('prompt');
    const imageContainer = document.getElementById('imageContainer');
    const clearImageButton = document.getElementById('clearImage');
    const usePromptButton = document.getElementById('query');
    const responseContentDiv = document.getElementById('responseContentDiv');
    const responseDiv = document.getElementById('response');

    const savePromptButton = document.getElementById('savePrompt');
    const savedPromptsSelect = document.getElementById('savedPrompts');
    const loadPromptButton = document.getElementById('loadPrompt');
    const setAsDefaultButton = document.getElementById('setAsDefault');
    const clearAllPresetsButton = document.getElementById('clearAllPresets');

    const clearDebugMessagesButton = document.getElementById('clearDebugMessages');
    const logger = Logger.getInstance(document.getElementById('debugMessages'));


    // Load saved prompts from storage
    chrome.storage.local.get(['prompts', 'defaultPromptIndex'], (result) => {
        const prompts = result.prompts || [];
        const defaultPromptIndex = result.defaultPromptIndex;

        logger.logDebugMessage('Loaded prompts:', prompts);
        logger.logDebugMessage('Default prompt index:', defaultPromptIndex);
        prompts.forEach((prompt, index) => {
            logger.logDebugMessage('Adding prompt to select:', {
                index,
                name: prompt.name
            });
            const option = document.createElement('option');
            option.value = index;
            option.text = prompt.name;
            savedPromptsSelect.appendChild(option);
        });

        if (defaultPromptIndex !== undefined && prompts[defaultPromptIndex]) {
            logger.logDebugMessage('Setting default prompt:', prompts[defaultPromptIndex]);
            savedPromptsSelect.value = defaultPromptIndex;
            loadPrompt(prompts[defaultPromptIndex]);
        }
    });

    // Save a new prompt or update existing prompt
    savePromptButton.addEventListener('click', () => {
        const promptName = promptNameInput.value;
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const selectedModel = gptModelsSelect.value;

        logger.logDebugMessage('Saving prompt:', {
            name: promptName,
            context: context,
            prompt: prompt,
            model: selectedModel
        });

        if (promptName) {
            chrome.storage.local.get('prompts', (result) => {
                let prompts = result.prompts || [];
                const existingPromptIndex = prompts.findIndex(p => p.name === promptName);

                if (existingPromptIndex !== -1) {
                    // Update existing prompt
                    prompts[existingPromptIndex] = {
                        name: promptName,
                        context: context,
                        prompt: prompt,
                        model: selectedModel
                    };
                    logger.logDebugMessage('Prompt updated:', prompts[existingPromptIndex]);
                } else {
                    // Add new prompt
                    prompts.push({
                        name: promptName,
                        context: context,
                        prompt: prompt,
                        model: selectedModel
                    });
                    logger.logDebugMessage('Prompt added:', prompts[prompts.length - 1]);
                }

                chrome.storage.local.set({
                    prompts
                }, () => {
                    logger.logDebugMessage('Prompts saved:', prompts);

                    // Update the dropdown menu
                    const optionExists = Array.from(savedPromptsSelect.options).some(option => option.value == existingPromptIndex);
                    if (!optionExists) {
                        const option = document.createElement('option');
                        option.value = prompts.length - 1;
                        option.text = promptName;
                        savedPromptsSelect.appendChild(option);
                    } else {
                        savedPromptsSelect.options[existingPromptIndex].text = promptName;
                    }
                });
            });
        }
    });


    // Load selected prompt
    loadPromptButton.addEventListener('click', () => {
        const selectedIndex = savedPromptsSelect.value;
        if (selectedIndex !== '') {
            chrome.storage.local.get('prompts', (result) => {
                const prompts = result.prompts || [];
                const selectedPrompt = prompts[selectedIndex];
                if (selectedPrompt) {
                    logger.logDebugMessage('Loading prompt:', selectedPrompt);
                    loadPrompt(selectedPrompt);
                }
            });
        }
    });

    // Set as default prompt
    setAsDefaultButton.addEventListener('click', () => {
        const selectedIndex = savedPromptsSelect.value;
        if (selectedIndex !== '') {
            chrome.storage.local.set({
                defaultPromptIndex: selectedIndex
            }, () => {
                logger.logDebugMessage('Set default prompt index:', selectedIndex);
            });
        }
    });


    clearAllPresetsButton.addEventListener('click', () => {
        chrome.storage.local.remove('prompts', () => {
            logger.logDebugMessage('All prompts cleared');
            savedPromptsSelect.innerHTML = '<option value="">Select a saved prompt</option>';
        });
    });


    // Handle image paste event
    imageContainer.addEventListener('paste', (event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    logger.logDebugMessage('Image pasted:', img.src);
                    imageContainer.innerHTML = ''; // Clear the container
                    imageContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        }
    });

    // Clear image
    clearImageButton.addEventListener('click', () => {
        logger.logDebugMessage('Clearing image');
        imageContainer.innerHTML = 'Paste image here (Ctrl+V)';
    });

    // Load prompt into input fields
    function loadPrompt(prompt) {
        promptNameInput.value = prompt.name;
        contextTextarea.value = prompt.context;
        promptTextarea.value = prompt.prompt;
        gptModelsSelect.value = prompt.model || 'gpt-3.5-turbo'; // Default if model is not defined
    }

    // Use the current prompt
    usePromptButton.addEventListener('click', () => {
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const model = gptModelsSelect.value;
        let imageData = null;

        const imgElement = imageContainer.querySelector('img');
        if (imgElement) {
            imageData = imgElement.src;
        }

        logger.logDebugMessage('Using context:', context);
        logger.logDebugMessage('Using prompt:', prompt);
        logger.logDebugMessage('Selected model:', model);
        logger.logDebugMessage('Image data:', imageData);

        let AIName;
        if (model.startsWith("claude")) {
            AIName = ClaudeChatProvider.getClassName();
        } else if (model.startsWith("gpt")) {
            AIName = OpenAIChatProvider.getClassName();
        } else {
            logger.logDebugMessage('Invalid model:', model);
            throw new Error("Invalid model");
        }

        handleResponseDiv(true);
        sendApiRequest(AIName, model, context, prompt, imageData)
            .then(data => handleProviderResponse(AIName, data))
            .catch(error => handleProviderError(AIName, error))
    });

    function sendApiRequest(AIName, model, context, prompt, imageUrl) {
        logger.logDebugMessage('sendApiRequest:', AIName, model, context, prompt, imageUrl);
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: "sendApiRequest",
                AIName: AIName,
                model: model,
                context: context,
                prompt: prompt,
                imageUrl: imageUrl
            }, response => {
                logger.logDebugMessage('sendApiRequest response:', response);
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    function handleResponseDiv(isActive) {
        if (isActive) {
            responseDiv.classList.add('active');
            responseDiv.textContent = "";
            responseContentDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            responseContentDiv.style.scrollMarginTop = '20px'; // Adjust the margin as needed
        } else {
            responseDiv.classList.remove('active');
        }
    };

    function handleProviderResponse(providerName, data) {
        handleResponseDiv(false);
        if (data.error) {
            throw new Error(data.error.message);
        }
        if (providerName === OpenAIChatProvider.getClassName()) {
            if (data.choices && data.choices[0] && data.choices[0].message) {
                document.getElementById('response').textContent = data.choices[0].message.content;
            } else {
                document.getElementById('response').textContent = 'Unexpected API response structure.';
            }
        } else if (providerName === ClaudeChatProvider.getClassName()) {
            if (data.content && data.content[0] && data.content[0].text) {
                document.getElementById('response').textContent = data.content[0].text;
            } else {
                document.getElementById('response').textContent = 'Unexpected API response structure.';
            }
        } else {
            logger.logDebugMessage('Handler not implemented for provider:', providerName);
            throw new Error("Handler not implemented for provider");
        }
    }

    function handleProviderError(providerName, error) {
        handleResponseDiv(false);
        if (providerName === OpenAIChatProvider.getClassName() || providerName === ClaudeChatProvider.getClassName()) {
            console.error('Error:', error);
            logger.logDebugMessage(error);
            document.getElementById('response').textContent = 'Error: ' + error.message;
        } else {
            logger.logDebugMessage('Error handler not implemented for provider:', providerName);
            throw new Error("Error handler not implemented for provider");
        }
    }

    clearDebugMessagesButton.addEventListener('click', () => {
        logger.clearDebugMessages();
    });
});