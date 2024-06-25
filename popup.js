
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
    const responseTabsDiv = document.getElementById('responseTabs');

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
        const selectedModels = Array.from(gptModelsSelect.selectedOptions).map(option => option.value);

        logger.logDebugMessage('Saving prompt:', {
            name: promptName,
            context: context,
            prompt: prompt,
            models: selectedModels
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
                        models: selectedModels
                    };
                    logger.logDebugMessage('Prompt updated:', prompts[existingPromptIndex]);
                } else {
                    // Add new prompt
                    prompts.push({
                        name: promptName,
                        context: context,
                        prompt: prompt,
                        models: selectedModels
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

        // Clear previous selections
        Array.from(gptModelsSelect.options).forEach(option => option.selected = false);

        // Select the options that match the models in the prompt
        if (Array.isArray(prompt.models)) {
            logger.logDebugMessage('Multi model mode:', prompt.models);
            prompt.models.forEach(model => {
                const option = Array.from(gptModelsSelect.options).find(option => option.value === model);
                if (option) {
                    option.selected = true;
                }
            });
        } else {
            // For backward compatibility if `prompt.model` is a single string
            const option = Array.from(gptModelsSelect.options).find(option => option.value === prompt.model);
            if (option) {
                option.selected = true;
            }
        }
    }

    // Use the current prompt
    usePromptButton.addEventListener('click', () => {
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const models = Array.from(gptModelsSelect.selectedOptions).map(option => option.value);
        let imageData = null;

        const imgElement = imageContainer.querySelector('img');
        if (imgElement) {
            imageData = imgElement.src;
        }

        logger.logDebugMessage('Using context:', context);
        logger.logDebugMessage('Using prompt:', prompt);
        logger.logDebugMessage('Selected models:', models);
        logger.logDebugMessage('Image data:', imageData);

        // Create response tabs before making API requests
        createResponseTabs(models);

        // Clear any previous responses
        models.forEach(model => {
            const responseModelDiv = document.createElement('div');
            responseModelDiv.id = 'response-' + model;
            responseModelDiv.classList.add('response-content');
            responseModelDiv.style.display = 'none'; // Hide the response initially
            responseContentDiv.appendChild(responseModelDiv);
        });

        models.forEach(model => {
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
                .then(data => handleProviderResponse(AIName, model, model === models[0], data))
                .catch(error => handleProviderError(AIName, model, model === models[0], error));
        });
    });

    function createResponseTabs(models) {
        responseTabsDiv.innerHTML = ''; // Clear any existing tabs
        models.forEach(model => {
            const tab = document.createElement('button');
            tab.textContent = model;
            tab.id = 'tab-' + model;
            tab.classList.add('response-tab');
            tab.addEventListener('click', () => {
                switchResponse(model);
            });
            responseTabsDiv.appendChild(tab);
        });
    }

    // Function to switch the response content
    function switchResponse(model) {
        const content = document.getElementById('response-' + model).textContent;
        responseDiv.textContent = content;
        // Highlight the active tab
        document.querySelectorAll('.response-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById('tab-' + model).classList.add('active');
    }

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

    function handleProviderResponse(providerName, model, switchTo, data) {
        handleResponseDiv(false);
        if (data.error) {
            throw new Error(data.error.message);
        }
        let responseContent = 'Unexpected API response structure.';
        if (providerName === OpenAIChatProvider.getClassName()) {
            if (data.choices && data.choices[0] && data.choices[0].message) {
                responseContent = data.choices[0].message.content;
            }
        } else if (providerName === ClaudeChatProvider.getClassName()) {
            if (data.content && data.content[0] && data.content[0].text) {
                responseContent = data.content[0].text;
            }
        } else {
            logger.logDebugMessage('Handler not implemented for provider:', providerName);
            throw new Error("Handler not implemented for provider");
        }

        // Store the response in a hidden div
        document.getElementById('response-' + model).textContent = responseContent;

        // Automatically switch to the first tab's content
        if (switchTo) {
            switchResponse(model);
        }
    }

    function handleProviderError(providerName, model, switchTo, error) {
        handleResponseDiv(false);
        const errorMessage = 'Error: ' + error.message;
        document.getElementById('response-' + model).textContent = errorMessage;
        if (switchTo) {
            switchResponse(model);
        }
        logger.logDebugMessage(error);
    }

    clearDebugMessagesButton.addEventListener('click', () => {
        logger.clearDebugMessages();
    });
});