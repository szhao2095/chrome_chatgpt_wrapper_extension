
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

                    //                    promptNameInput.value = '';
                    //                    contextTextarea.value = '';
                    //                    promptTextarea.value = '';
                    //                    gptModelsSelect.value = 'gpt-3.5-turbo'; // Reset model to default or choose appropriate default
                    //                    imageContainer.innerHTML = 'Paste image here (Ctrl+V)';
                });
            });
        }
    });


    // Use the current prompt
    usePromptButton.addEventListener('click', () => {
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const model = gptModelsSelect.value;

        logger.logDebugMessage('Using context:', context);
        logger.logDebugMessage('Using prompt:', prompt);
        logger.logDebugMessage('Selected model:', model);

        const imgElement = imageContainer.querySelector('img');

        if (imgElement) {
            logger.logDebugMessage('Image found, adding to payload...');
            const imgSrc = imgElement.src;
            fetch(imgSrc)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result; // .split(',')[1];
                        logger.logDebugMessage('Image data:', base64data);
                        const requestBody = {
                            model: model,
                            messages: [{
                                    role: 'system',
                                    content: context
                                },
                                {
                                    role: 'user',
                                    content: [{
                                            type: "text",
                                            text: prompt
                                        },
                                        {
                                            type: "image_url",
                                            image_url: {
                                                url: base64data,
                                                detail: "low"
                                            }
                                        }
                                    ]
                                }
                            ]
                        };
                        sendRequest(JSON.stringify(requestBody));
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error('Error:', error);
                    responseDiv.textContent = 'Error: ' + error.message;
                });
        } else {
            const requestBody = {
                model: model,
                messages: [{
                        role: 'system',
                        content: context
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };
            logger.logDebugMessage('Request body without image:', requestBody);
            sendRequest(JSON.stringify(requestBody));
        }
    });


    function sendRequest(requestBody) {
        responseDiv.textContent = "";
        responseDiv.classList.add('active'); // Add active class
        responseContentDiv.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        responseContentDiv.style.scrollMarginTop = '20px'; // Adjust the margin as needed

        logger.logDebugMessage('\n\n===================== Sending payload: ', requestBody, " =====================\n\n");

        fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer sk-proj-byf35DMGz8sqL6Bh0CHsT3BlbkFJkVQYcPP8B0QbxGr4u6`
                },
                body: requestBody
            })
            .then(response => response.json())
            .then(data => {
                responseDiv.classList.remove('active'); // Remove active class

                if (data.error) {
                    throw new Error(data.error.message);
                }

                logger.logDebugMessage('API response:', data);

                if (data.choices && data.choices[0] && data.choices[0].message) {
                    responseDiv.textContent = data.choices[0].message.content;
                } else {
                    responseDiv.textContent = 'Unexpected API response structure.';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                responseDiv.classList.remove('active'); // Remove active class
                responseDiv.textContent = 'Error: ' + error.message;
            });
    }


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
        imageContainer.innerHTML = 'Paste image here (Ctrl+V)'; // Clear the image area
    }

    clearDebugMessagesButton.addEventListener('click', () => {
        logger.clearDebugMessages();
    });
});